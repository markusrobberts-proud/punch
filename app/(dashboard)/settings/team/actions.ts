"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireRole } from "@/lib/rbac"
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server"
import { recordAudit } from "@/lib/audit"

const RoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["super_admin", "admin", "strategist", "designer", "viewer", "pending"]),
})

export async function updateUserRole(formData: FormData) {
  const admin = await requireRole("admin")
  const parsed = RoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  })
  if (!parsed.success) throw new Error("Invalid input")
  // Only a real super_admin can hand out the super_admin role.
  if (parsed.data.role === "super_admin" && admin.actualRole !== "super_admin") {
    throw new Error("Only a super admin can assign super admin.")
  }
  if (parsed.data.userId === admin.id && parsed.data.role !== admin.actualRole) {
    throw new Error("You can't change your own role.")
  }

  const supabase = await createSupabaseServerClient()
  await supabase.from("users").update({ role: parsed.data.role }).eq("id", parsed.data.userId)

  await recordAudit({
    userId: admin.id,
    entityType: "user",
    entityId: parsed.data.userId,
    action: "update_role",
    meta: { new_role: parsed.data.role },
  })

  revalidatePath("/settings/team")
}

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "strategist", "designer", "viewer"]),
})

export type InviteResult = { ok: true; via: "service" | "magic_link_url"; url?: string } | { ok: false; error: string }

export async function inviteUser(formData: FormData): Promise<InviteResult> {
  const admin = await requireRole("admin")
  const parsed = InviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  })
  if (!parsed.success) return { ok: false, error: "Invalid email or role" }

  const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  if (hasServiceRole) {
    const service = createSupabaseServiceClient()
    const { data, error } = await service.auth.admin.inviteUserByEmail(parsed.data.email)
    if (error) return { ok: false, error: error.message }

    if (data?.user?.id) {
      await service.from("users").upsert({
        id: data.user.id,
        email: parsed.data.email,
        role: parsed.data.role,
      })
    }

    await recordAudit({
      userId: admin.id,
      entityType: "user",
      action: "invite",
      meta: { email: parsed.data.email, role: parsed.data.role, via: "service" },
    })

    revalidatePath("/settings/team")
    return { ok: true, via: "service" }
  }

  // No service role: surface the magic-link URL for the admin to share manually.
  await recordAudit({
    userId: admin.id,
    entityType: "user",
    action: "invite_url_generated",
    meta: { email: parsed.data.email, role: parsed.data.role },
  })

  return {
    ok: true,
    via: "magic_link_url",
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login`,
  }
}
