import { redirect } from "next/navigation"
import { requireApprovedUser, type AppUser } from "./auth"
import { createSupabaseServerClient } from "./supabase/server"
import { ROLE_RANK, type Role } from "./roles"

// Re-export the pure predicates + Role type so existing imports from
// "@/lib/rbac" keep working. Client components should import directly
// from "@/lib/roles" instead, to avoid pulling server-only modules
// (Clerk, Supabase server client) into the client bundle.
export {
  ROLE_RANK,
  canEditStrategy,
  canManageUsers,
  canViewAs,
  canContributeKnowledge,
  canReviewKnowledge,
  canEditBrief,
  canEditCopy,
  canRunGenerations,
  canSeeInternalSurfaces,
  isClient,
} from "./roles"
export type { Role } from "./roles"

export async function requireRole(min: Role): Promise<AppUser> {
  const user = await requireApprovedUser()
  if (ROLE_RANK[user.role] < ROLE_RANK[min]) redirect("/")
  return user
}

/**
 * Strategist+ have org-wide access by design (they shape every brand's
 * strategy). Designer / client need a brand_members row to act on a
 * specific brand.
 */
export async function requireBrandAccess(brandId: string): Promise<AppUser> {
  const user = await requireApprovedUser()
  if (
    user.role === "super_admin" ||
    user.role === "admin" ||
    user.role === "strategist"
  ) {
    return user
  }

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
