import { createSupabaseServiceClient } from "./supabase/server"
import type { Role } from "./auth"

/**
 * Stable categorical labels for notifications. The UI uses these to pick
 * the icon + tint. Add new ones here so the union stays a single source
 * of truth.
 */
export type NotificationKind =
  | "client_approve"
  | "client_request_changes"
  | "client_comment"
  | "plan_approved"
  | "briefs_ready"
  | "knowledge_pending"
  | "inbound_email"
  | "user_pending"
  | "role_changed"
  | "scrape_complete"

export type Notification = {
  id: string
  user_id: string
  kind: NotificationKind
  title: string
  body: string | null
  link: string | null
  brand_id: string | null
  entity_type: string | null
  entity_id: string | null
  actor_user_id: string | null
  read_at: string | null
  created_at: string
}

type NotifyInput = {
  recipients: string[]
  kind: NotificationKind
  title: string
  body?: string | null
  link?: string | null
  brandId?: string | null
  entityType?: string | null
  entityId?: string | null
  actorUserId?: string | null
}

/**
 * Insert one row per recipient. Empty recipients are a no-op so callers
 * don't have to guard. Failures are logged but never thrown: a missing
 * notification should not break the underlying action (a client approval,
 * a knowledge upload, etc.).
 */
export async function notify(input: NotifyInput): Promise<void> {
  const unique = Array.from(new Set(input.recipients.filter(Boolean)))
  if (unique.length === 0) return
  try {
    const supabase = createSupabaseServiceClient()
    const rows = unique.map((userId) => ({
      user_id: userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      brand_id: input.brandId ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      actor_user_id: input.actorUserId ?? null,
    }))
    await supabase.from("notifications").insert(rows)
  } catch (err) {
    console.error("[notify] insert failed:", err)
  }
}

/**
 * Resolve recipients for a brand-scoped event.
 *
 * Returns every brand_member of the given brand whose role meets the
 * minimum, plus every org-wide admin / super_admin. The actor is excluded
 * because nobody wants a ping for their own action.
 */
export async function recipientsForBrand({
  brandId,
  minRole = "viewer",
  excludeUserId,
}: {
  brandId: string
  minRole?: Role
  excludeUserId?: string | null
}): Promise<string[]> {
  const supabase = createSupabaseServiceClient()
  const RANK: Record<Role, number> = {
    pending: 0, viewer: 1, designer: 2, strategist: 3, admin: 4, super_admin: 5,
  }
  const min = RANK[minRole]

  const [membersRes, adminsRes] = await Promise.all([
    supabase
      .from("brand_members")
      .select("user_id, role, users(role)")
      .eq("brand_id", brandId),
    supabase.from("users").select("id, role").in("role", ["admin", "super_admin"]),
  ])

  const ids = new Set<string>()
  type MemberRow = {
    user_id: string
    role: Role | null
    users: { role: Role | null } | { role: Role | null }[] | null
  }
  for (const m of (membersRes.data ?? []) as MemberRow[]) {
    // Effective role = max(membership role, org role). The membership row's
    // role can be stricter than the org one, but in practice we promote
    // both together, so taking max is the friendly default.
    const orgRow = Array.isArray(m.users) ? m.users[0] : m.users
    const orgRole = (orgRow?.role ?? "pending") as Role
    const memberRole = (m.role ?? "pending") as Role
    const effective = RANK[orgRole] >= RANK[memberRole] ? orgRole : memberRole
    if (RANK[effective] >= min) ids.add(m.user_id)
  }
  for (const a of (adminsRes.data ?? []) as Array<{ id: string }>) ids.add(a.id)

  if (excludeUserId) ids.delete(excludeUserId)
  return Array.from(ids)
}

/**
 * Every admin + super_admin (for org-level events: user pending, etc.).
 */
export async function recipientsForAdmins(excludeUserId?: string | null): Promise<string[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from("users").select("id").in("role", ["admin", "super_admin"])
  const ids = (data ?? []).map((r: { id: string }) => r.id)
  return excludeUserId ? ids.filter((id) => id !== excludeUserId) : ids
}

/* --------------------------- read API --------------------------- */

export async function listNotifications(userId: string, limit = 30): Promise<Notification[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as Notification[]
}

export async function unreadCount(userId: string): Promise<number> {
  const supabase = createSupabaseServiceClient()
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)
  return count ?? 0
}
