"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireApprovedUser } from "@/lib/auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { recordAudit } from "@/lib/audit"

const Schema = z.object({
  brandId: z.string().uuid(),
  brandSlug: z.string(),
  title: z.string().min(2).max(255),
  sourceType: z.enum([
    "uploaded_file", "brand_guide", "strategy_doc", "meeting_notes", "campaign_debrief",
  ]),
  extractedText: z.string().max(200000).optional(),
})

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
])

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

export async function uploadKnowledgeFile(formData: FormData) {
  const user = await requireApprovedUser()
  const parsed = Schema.safeParse({
    brandId: formData.get("brandId"),
    brandSlug: formData.get("brandSlug"),
    title: formData.get("title"),
    sourceType: formData.get("sourceType"),
    extractedText: formData.get("extractedText") || undefined,
  })
  if (!parsed.success) throw new Error("Invalid input")

  const file = formData.get("file") as File | null
  if (!file || file.size === 0) throw new Error("Pick a file")
  if (file.size > MAX_BYTES) throw new Error("File too large (max 20 MB)")
  if (file.type && !ALLOWED_MIME.has(file.type) && !file.name.match(/\.(pdf|docx?|txt|md)$/i)) {
    throw new Error("Unsupported file type")
  }

  const supabase = await createSupabaseServerClient()

  // Insert the knowledge_item row first so we have a stable id for the path.
  const { data: row, error: rowError } = await supabase
    .from("knowledge_items")
    .insert({
      brand_id: parsed.data.brandId,
      source_type: parsed.data.sourceType,
      title: parsed.data.title,
      content: parsed.data.extractedText || null,
      review_status: "approved",
      added_by_user_id: user.id,
    })
    .select("id")
    .single()
  if (rowError || !row) throw new Error(rowError?.message ?? "Could not create knowledge item")

  const path = `${parsed.data.brandId}/${row.id}/${sanitize(file.name)}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { error: upErr } = await supabase.storage
    .from("knowledge-files")
    .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false })
  if (upErr) {
    // Roll back the row if storage failed
    await supabase.from("knowledge_items").delete().eq("id", row.id)
    throw new Error(upErr.message)
  }

  const { data: signed } = await supabase.storage
    .from("knowledge-files")
    .createSignedUrl(path, 60 * 60 * 24 * 30)

  await supabase
    .from("knowledge_items")
    .update({ file_url: signed?.signedUrl ?? null })
    .eq("id", row.id)

  await recordAudit({
    userId: user.id,
    brandId: parsed.data.brandId,
    entityType: "knowledge_item",
    entityId: row.id,
    action: "upload_file",
    meta: { filename: file.name, size: file.size, mime: file.type },
  })

  revalidatePath(`/brands/${parsed.data.brandSlug}/knowledge`)
  revalidatePath("/knowledge")
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180)
}
