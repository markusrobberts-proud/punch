"use server"

import { requireApprovedUser } from "@/lib/auth"
import { createSupabaseServiceClient } from "@/lib/supabase/server"

export type ApprovalPing = {
  count: number
  latestAt: string | null
}

/**
 * Cheap server action used by the plan-detail page to poll for new client
 * approval actions. Returns the count of approval_actions tied to this
 * plan and the timestamp of the latest. The client diffs against the
 * previous reading and triggers a router refresh on change.
 */
export async function checkApprovalActivity(planId: string): Promise<ApprovalPing> {
  await requireApprovedUser()
  const supabase = createSupabaseServiceClient()
  const { data: links } = await supabase
    .from("approval_links")
    .select("id")
    .eq("plan_id", planId)
  const ids = (links ?? []).map((l: { id: string }) => l.id)
  if (ids.length === 0) return { count: 0, latestAt: null }

  const { count } = await supabase
    .from("approval_actions")
    .select("id", { count: "exact", head: true })
    .in("approval_link_id", ids)
  const { data: latest } = await supabase
    .from("approval_actions")
    .select("acted_at")
    .in("approval_link_id", ids)
    .order("acted_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    count: count ?? 0,
    latestAt: (latest?.acted_at as string | undefined) ?? null,
  }
}
