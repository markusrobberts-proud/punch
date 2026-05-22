"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { requireRole } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { recordAudit } from "@/lib/audit"
import { toSlug } from "@/lib/brands"
import { runWebsiteScrape } from "./[slug]/scrape-actions"

const BrandSchema = z.object({
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
})

export type BrandFormState = {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

export async function createBrandAction(
  _prev: BrandFormState | null,
  formData: FormData,
): Promise<BrandFormState> {
  const user = await requireRole("strategist")

  const raw = Object.fromEntries(formData.entries())
  const parsed = BrandSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message
    return { ok: false, fieldErrors }
  }

  const slug = toSlug(parsed.data.name)
  const inboxAlias = slug

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("brands")
    .insert({
      slug,
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
      inbox_alias: inboxAlias,
    })
    .select("id, slug")
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? "Could not create brand" }

  await supabase.from("brand_members").insert({ brand_id: data.id, user_id: user.id, role: user.role })

  await recordAudit({
    userId: user.id,
    brandId: data.id,
    entityType: "brand",
    entityId: data.id,
    action: "create",
    meta: { name: parsed.data.name },
  })

  if (parsed.data.website_url) {
    // Fire-and-forget — don't block the redirect on the scrape.
    runWebsiteScrape(data.id).catch((err) => console.error("[scrape] background failure:", err))
  }

  revalidatePath("/")
  redirect(`/brands/${data.slug}`)
}
