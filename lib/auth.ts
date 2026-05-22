import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "./supabase/server"

export type Role = "super_admin" | "admin" | "strategist" | "designer" | "viewer" | "pending"

export type AppUser = {
  id: string
  email: string
  displayName: string | null
  /** Effective role after any super_admin "view as" impersonation. UI + server-action gates read this. */
  role: Role
  /** The real role from the DB. Use this to decide who can toggle view-as. */
  actualRole: Role
  /** The role being previewed, if any. */
  viewingAs: Role | null
}

export const VIEW_AS_COOKIE = "proud-email-os.view-as"

const IMPERSONABLE_ROLES: Role[] = ["admin", "strategist", "designer", "viewer"]

/**
 * `cache()` memoises the result per request, so calling `getUser()` from
 * a layout and a page does just one DB round trip.
 */
export const getUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createSupabaseServerClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) return null

  const { data: profile } = await supabase
    .from("users")
    .select("id,email,display_name,role")
    .eq("id", authData.user.id)
    .maybeSingle()

  const baseEmail = authData.user.email ?? ""
  if (!profile) {
    return {
      id: authData.user.id,
      email: baseEmail,
      displayName: null,
      role: "pending",
      actualRole: "pending",
      viewingAs: null,
    }
  }

  const actualRole = ((profile.role as Role) ?? "pending") as Role

  // Only super_admin can impersonate another role.
  let viewingAs: Role | null = null
  if (actualRole === "super_admin") {
    const cookieStore = await cookies()
    const v = cookieStore.get(VIEW_AS_COOKIE)?.value
    if (v && (IMPERSONABLE_ROLES as string[]).includes(v)) {
      viewingAs = v as Role
    }
  }

  const role = viewingAs ?? actualRole

  return {
    id: profile.id as string,
    email: profile.email as string,
    displayName: (profile.display_name as string | null) ?? null,
    role,
    actualRole,
    viewingAs,
  }
})

export async function requireUser(): Promise<AppUser> {
  const user = await getUser()
  if (!user) redirect("/login")
  return user
}

export async function requireApprovedUser(): Promise<AppUser> {
  const user = await requireUser()
  if (user.role === "pending") redirect("/awaiting-approval")
  return user
}

/** Only the real super_admin can change impersonation. */
export async function requireSuperAdmin(): Promise<AppUser> {
  const user = await requireApprovedUser()
  if (user.actualRole !== "super_admin") redirect("/")
  return user
}
