import { redirect } from "next/navigation"
import { requireApprovedUser, type AppUser, type Role } from "./auth"
import { createSupabaseServerClient } from "./supabase/server"

const ROLE_RANK: Record<Role, number> = {
  pending: 0,
  viewer: 1,
  designer: 2,
  strategist: 3,
  admin: 4,
  super_admin: 5,
}

export async function requireRole(min: Role): Promise<AppUser> {
  const user = await requireApprovedUser()
  if (ROLE_RANK[user.role] < ROLE_RANK[min]) redirect("/")
  return user
}

export async function requireBrandAccess(brandId: string): Promise<AppUser> {
  const user = await requireApprovedUser()
  if (user.role === "admin" || user.role === "super_admin") return user

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("brand_members")
    .select("brand_id")
    .eq("brand_id", brandId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error || !data) redirect("/")
  return user
}

export function canEditStrategy(role: Role) {
  return role === "super_admin" || role === "admin" || role === "strategist"
}

export function canManageUsers(role: Role) {
  return role === "super_admin" || role === "admin"
}

export function canViewAs(actualRole: Role) {
  return actualRole === "super_admin"
}
