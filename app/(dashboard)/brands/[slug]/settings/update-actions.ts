"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireRole } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { recordAudit } from "@/lib/audit"

const UpdateBrandSchema = z.object({
  brandId: z.string().uuid(),
  brandSlug: z.string().min(1),
  name: z.string().min(2).max(120),
  website_url: z.string().url().optional().or(z.literal("")),
  industry: z.string().max(120).optional().or(z.literal("")),
  contact_name: z.string().max(120).optional().or(z.literal("")),
  contact_email: z.string().email().optional().or(z.literal("")),
  primary_color: z.string().max(16).optional().or(z.literal("")),
  secondary_color: z.string().max(16).optional().or(z.literal("")),
  font_heading: z.string().max(120).optional().or(z.literal("")),
  font_body: z.string().max(120).optional().or(z.literal("")),
  tone_of_voice: z.string().max(4000).optional().or(z.literal("")),
  target_audience: z.string().max(4000).optional().or(z.literal("")),
  prefer_brand_over_strategy: z
    .preprocess((v) => v === "on" || v === "true" || v === true, z.boolean())
    .optional(),
  auto_ingest_forwarded_emails: z
    .preprocess((v) => v === "on" || v === "true" || v === true, z.boolean())
    .optional(),
})

export type UpdateBrandState = { ok: boolean; error?: string; fieldErrors?: Record<string, string>; saved?: boolean }

export async function updateBrandAction(
  _prev: UpdateBrandState | null,
  formData: FormData,
): Promise<UpdateBrandState> {
  const user = await requireRole("strategist")

  const parsed = UpdateBrandSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message
    return { ok: false, fieldErrors }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from("brands")
    .update({
      name: parsed.data.name,
      website_url: parsed.data.website_url || null,
      industry: parsed.data.industry || null,
      contact_name: parsed.data.contact_name || null,
      contact_email: parsed.data.contact_email || null,
      primary_color: parsed.data.primary_color || null,
      secondary_color: parsed.data.secondary_color || null,
      font_heading: parsed.data.font_heading || null,
      font_body: parsed.data.font_body || null,
      tone_of_voice: parsed.data.tone_of_voice || null,
      target_audience: parsed.data.target_audience || null,
      prefer_brand_over_strategy: parsed.data.prefer_brand_over_strategy ?? false,
      auto_ingest_forwarded_emails: parsed.data.auto_ingest_forwarded_emails ?? true,
    })
    .eq("id", parsed.data.brandId)

  if (error) return { ok: false, error: error.message }

  await recordAudit({
    userId: user.id,
    brandId: parsed.data.brandId,
    entityType: "brand",
    entityId: parsed.data.brandId,
    action: "update",
  })

  revalidatePath(`/brands/${parsed.data.brandSlug}`)
  revalidatePath(`/brands/${parsed.data.brandSlug}/settings`)
  revalidatePath("/")
  return { ok: true, saved: true }
}

const DeleteBrandSchema = z.object({
  brandId: z.string().uuid(),
  brandSlug: z.string().min(1),
  confirm: z.string(),
})

export async function deleteBrandAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireRole("admin")
  const parsed = DeleteBrandSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, error: "Invalid input" }

  const supabase = await createSupabaseServerClient()
  const { data: brand } = await supabase
    .from("brands")
    .select("name, slug")
    .eq("id", parsed.data.brandId)
    .single()
  if (!brand) return { ok: false, error: "Brand not found" }
  if (parsed.data.confirm.trim().toLowerCase() !== (brand.name as string).toLowerCase()) {
    return { ok: false, error: "Confirmation text did not match the brand name." }
  }

  const { error } = await supabase.from("brands").delete().eq("id", parsed.data.brandId)
  if (error) return { ok: false, error: error.message }

  await recordAudit({
    userId: user.id,
    entityType: "brand",
    entityId: parsed.data.brandId,
    action: "delete",
    meta: { name: brand.name },
  })

  revalidatePath("/brands")
  revalidatePath("/")
  return { ok: true }
}
