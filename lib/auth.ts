import { cache } from "react"
import { cookies } from "next/headers"
import { unstable_cache } from "next/cache"
import { redirect } from "next/navigation"
import { auth, currentUser } from "@clerk/nextjs/server"
import { createSupabaseServiceClient } from "./supabase/server"
import type { Role } from "./roles"

// Re-export so existing `import { Role } from "@/lib/auth"` callers keep
// working. The canonical definition lives in lib/roles.ts so client
// components can import role types without pulling Clerk/Supabase code.
export type { Role }

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
export const USER_CACHE_TAG = "user-profile"

const IMPERSONABLE_ROLES: Role[] = ["admin", "strategist", "designer", "client"]

type Profile = {
  id: string
  email: string
  display_name: string | null
  role: Role
}

/**
 * Cross-request memoised profile lookup. Tagged so we can revalidate when
 * a role changes (e.g. updateUserRole or the view-as toggle).
 *
 * 60s freshness is fine: role changes are infrequent and the impersonation
 * cookie is read separately on every request anyway.
 */
const fetchProfile = unstable_cache(
  async (userId: string): Promise<Profile | null> => {
    const supabase = createSupabaseServiceClient()
    const { data } = await supabase
      .from("users")
      .select("id, email, display_name, role")
      .eq("id", userId)
      .maybeSingle()
    if (!data) return null
    return {
      id: data.id as string,
      email: (data.email as string) ?? "",
      display_name: (data.display_name as string | null) ?? null,
      role: ((data.role as Role) ?? "pending") as Role,
    }
  },
  ["user-profile"],
  { revalidate: 60, tags: [USER_CACHE_TAG] },
)

/**
 * Resolves the signed-in Clerk user, reads the public.users profile, and
 * applies any super-admin "view as" impersonation.
 *
 * Hot path is one cached DB lookup. Cold path (first sign-in only) also
 * calls Clerk's currentUser() to seed the row.
 */
export const getUser = cache(async (): Promise<AppUser | null> => {
  const { userId } = await auth()
  if (!userId) return null

  let profile = await fetchProfile(userId)

  let actualRole: Role
  let email: string
  let displayName: string | null

  if (profile) {
    actualRole = profile.role
    email = profile.email
    displayName = profile.display_name
  } else {
    // First-sign-in fallback. The /api/webhooks/clerk handler also seeds
    // the row, this races-protect against the webhook arriving after the
    // first request.
    const clerk = await currentUser()
    if (!clerk) return null
    email = clerk.primaryEmailAddress?.emailAddress ?? clerk.emailAddresses[0]?.emailAddress ?? ""
    displayName =
      [clerk.firstName, clerk.lastName].filter(Boolean).join(" ").trim() ||
      clerk.username ||
      null
    const supabase = createSupabaseServiceClient()
    await supabase
      .from("users")
      .upsert({ id: userId, email, display_name: displayName, role: "pending" })
    actualRole = "pending"
    // Best-effort: bust the cache so subsequent requests see the new row.
    profile = { id: userId, email, display_name: displayName, role: "pending" }
  }

  // Only a real super_admin can impersonate another role.
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
    id: userId,
    email,
    displayName,
    role,
    actualRole,
    viewingAs,
  }
})

export async function requireUser(): Promise<AppUser> {
  const user = await getUser()
  if (!user) redirect("/sign-in")
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
