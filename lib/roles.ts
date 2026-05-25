/**
 * Pure role types + predicates. No server imports. Safe to pull into
 * client components.
 *
 * The server-only helpers (requireRole, requireBrandAccess) live in
 * lib/rbac.ts because they touch cookies / Clerk / Supabase.
 */

export type Role = "super_admin" | "admin" | "strategist" | "designer" | "client" | "pending"

export const ROLE_RANK: Record<Role, number> = {
  pending: 0,
  client: 1,
  designer: 2,
  strategist: 3,
  admin: 4,
  super_admin: 5,
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

/**
 * Permission matrix (kept central so UI and server actions stay in lockstep).
 *
 * Knowledge bank:
 *   contribute: add a manual note / upload a file. Designer+ (client read-only).
 *   review:     approve / reject pending items, delete items. Strategist+.
 *
 * Calendar:
 *   editBrief:  inline-edit + Asana export. Designer+ (designers own briefs).
 *   editCopy:   inline-edit subject/headline/body. Strategist+ (writing voice).
 *   generate:   plan/copy/brief AI generations + approvals. Strategist+.
 */
export function canContributeKnowledge(role: Role) {
  return role === "super_admin" || role === "admin" || role === "strategist" || role === "designer"
}

export function canReviewKnowledge(role: Role) {
  return role === "super_admin" || role === "admin" || role === "strategist"
}

export function canEditBrief(role: Role) {
  return role === "super_admin" || role === "admin" || role === "strategist" || role === "designer"
}

export function canEditCopy(role: Role) {
  return canEditStrategy(role)
}

export function canRunGenerations(role: Role) {
  return canEditStrategy(role)
}

/**
 * Internal-only views: Proud Strategy, the global knowledge bank, per-
 * brand knowledge bank + brand settings. Clients (the brand's actual
 * stakeholders) should never see these. Internal team members do.
 */
export function canSeeInternalSurfaces(role: Role) {
  return role !== "client" && role !== "pending"
}

/** Convenience: is this user an external client (not internal team)? */
export function isClient(role: Role) {
  return role === "client"
}
