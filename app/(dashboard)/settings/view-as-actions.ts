"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { requireSuperAdmin, VIEW_AS_COOKIE, type Role } from "@/lib/auth"
import { recordAudit } from "@/lib/audit"

const VALID_VIEW_AS_ROLES: Role[] = ["admin", "strategist", "designer", "viewer"]

export async function setViewAs(formData: FormData) {
  const user = await requireSuperAdmin()
  const role = formData.get("role")?.toString() ?? ""

  const store = await cookies()
  if (!role || role === "super_admin" || role === "") {
    store.delete(VIEW_AS_COOKIE)
    await recordAudit({
      userId: user.id,
      entityType: "view_as",
      action: "clear",
    })
  } else if ((VALID_VIEW_AS_ROLES as string[]).includes(role)) {
    store.set(VIEW_AS_COOKIE, role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    })
    await recordAudit({
      userId: user.id,
      entityType: "view_as",
      action: "set",
      meta: { role },
    })
  }

  revalidatePath("/", "layout")
}

export async function clearViewAs() {
  const user = await requireSuperAdmin()
  const store = await cookies()
  store.delete(VIEW_AS_COOKIE)
  await recordAudit({
    userId: user.id,
    entityType: "view_as",
    action: "clear",
  })
  revalidatePath("/", "layout")
}
