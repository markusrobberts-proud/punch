"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireRole } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { recordAudit } from "@/lib/audit"
import { notify } from "@/lib/notifications"

const ROLES = ["admin", "strategist", "designer", "viewer"] as const

const AddSchema = z.object({
  brandId: z.string().uuid(),
  brandSlug: z.string().min(1),
  userId: z.string().min(1).max(128),
  role: z.enum(ROLES),
})

const RemoveSchema = z.object({
  brandId: z.string().uuid(),
  brandSlug: z.string().min(1),
  userId: z.string().min(1).max(128),
})

export type MemberActionResult = { ok: true } | { ok: false; error: string }

/**
 * Add a teammate to this brand. Admin-only. We notify the newly-added
 * user so they know they have access, and audit-log it so we can trace
 * who got brand access when.
 */
export async function addBrandMember(formData: FormData): Promise<MemberActionResult> {
  const admin = await requireRole("admin")
  const parsed = AddSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, error: "Invalid input" }

  const supabase = await createSupabaseServerClient()
  const [{ data: brand }, { data: user }] = await Promise.all([
    supabase.from("brands").select("name").eq("id", parsed.data.brandId).single(),
    supabase.from("users").select("display_name, email, role").eq("id", parsed.data.userId).single(),
  ])
  if (!brand) return { ok: false, error: "Brand not found" }
  if (!user) return { ok: false, error: "User not found" }
  if (user.role === "pending") {
    return { ok: false, error: "Approve this user first (Settings → Team), then assign them to a brand." }
  }

  const { error } = await supabase
    .from("brand_members")
    .upsert(
      { brand_id: parsed.data.brandId, user_id: parsed.data.userId, role: parsed.data.role },
      { onConflict: "brand_id,user_id" },
    )
  if (error) return { ok: false, error: error.message }

  await recordAudit({
    userId: admin.id,
    brandId: parsed.data.brandId,
    entityType: "brand_member",
    entityId: parsed.data.userId,
    action: "add_member",
    meta: { role: parsed.data.role, target_email: user.email },
  })

  await notify({
    recipients: [parsed.data.userId],
    kind: "role_changed",
    title: `You've been added to ${brand.name}`,
    body: `${admin.displayName ?? admin.email} added you as ${parsed.data.role}.`,
    link: `/brands/${parsed.data.brandSlug}`,
    brandId: parsed.data.brandId,
    entityType: "brand_member",
    entityId: parsed.data.userId,
    actorUserId: admin.id,
  })

  revalidatePath(`/brands/${parsed.data.brandSlug}/settings`)
  revalidatePath(`/brands/${parsed.data.brandSlug}`)
  revalidatePath("/brands")
  return { ok: true }
}

export async function removeBrandMember(formData: FormData): Promise<MemberActionResult> {
  const admin = await requireRole("admin")
  const parsed = RemoveSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, error: "Invalid input" }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from("brand_members")
    .delete()
    .eq("brand_id", parsed.data.brandId)
    .eq("user_id", parsed.data.userId)
  if (error) return { ok: false, error: error.message }

  await recordAudit({
    userId: admin.id,
    brandId: parsed.data.brandId,
    entityType: "brand_member",
    entityId: parsed.data.userId,
    action: "remove_member",
  })

  revalidatePath(`/brands/${parsed.data.brandSlug}/settings`)
  revalidatePath(`/brands/${parsed.data.brandSlug}`)
  revalidatePath("/brands")
  return { ok: true }
}

export async function updateBrandMemberRole(formData: FormData): Promise<MemberActionResult> {
  const admin = await requireRole("admin")
  const parsed = AddSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, error: "Invalid input" }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from("brand_members")
    .update({ role: parsed.data.role })
    .eq("brand_id", parsed.data.brandId)
    .eq("user_id", parsed.data.userId)
  if (error) return { ok: false, error: error.message }

  await recordAudit({
    userId: admin.id,
    brandId: parsed.data.brandId,
    entityType: "brand_member",
    entityId: parsed.data.userId,
    action: "update_member_role",
    meta: { new_role: parsed.data.role },
  })

  revalidatePath(`/brands/${parsed.data.brandSlug}/settings`)
  return { ok: true }
}
