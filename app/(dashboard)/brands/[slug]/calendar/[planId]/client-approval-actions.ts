"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireApprovedUser } from "@/lib/auth"
import { requireBrandAccess } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { recordAudit } from "@/lib/audit"
import { notify, recipientsForBrand } from "@/lib/notifications"

const Schema = z.object({
  brandSlug: z.string().min(1),
  planId: z.string().uuid(),
  emailId: z.string().uuid(),
  action: z.enum(["approve", "request_changes", "comment"]),
  comment: z.string().max(4000).optional().or(z.literal("")),
})

export type ClientApprovalResult = { ok: true } | { ok: false; error: string }

/**
 * Authenticated-client equivalent of the public approval-link endpoint.
 * The client is logged in and has brand_members access to the brand, so
 * we record their action directly against their user_id (no token).
 *
 * Strategist+ on the same brand also get a notification so they see
 * client actions in the bell.
 */
export async function recordClientApprovalAction(formData: FormData): Promise<ClientApprovalResult> {
  const user = await requireApprovedUser()
  const parsed = Schema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, error: "Invalid input" }
  if (parsed.data.action === "comment" && !parsed.data.comment) {
    return { ok: false, error: "Comment is required" }
  }

  const supabase = await createSupabaseServerClient()

  // Resolve the email + brand so we can scope-check + denormalise.
  const { data: email } = await supabase
    .from("campaign_emails")
    .select("brand_id, subject_line, theme, plan_id")
    .eq("id", parsed.data.emailId)
    .single()
  if (!email) return { ok: false, error: "Email not found" }
  if (email.plan_id !== parsed.data.planId) return { ok: false, error: "Email not on this plan" }

  // Brand access: strategist+ pass through, designer/client need a row.
  await requireBrandAccess(email.brand_id as string)

  const { error } = await supabase.from("approval_actions").insert({
    campaign_email_id: parsed.data.emailId,
    action: parsed.data.action,
    comment: parsed.data.comment || null,
    user_id: user.id,
  })
  if (error) return { ok: false, error: error.message }

  await recordAudit({
    userId: user.id,
    brandId: email.brand_id as string,
    entityType: "campaign_email",
    entityId: parsed.data.emailId,
    action: `client_${parsed.data.action}`,
    meta: parsed.data.comment ? { comment: parsed.data.comment.slice(0, 240) } : undefined,
  })

  // Tell the brand's team (strategist + designer) about it, mirroring
  // what the public approval-link path does in app/(public)/approval/...
  try {
    const subjectLabel = (email.subject_line as string | null) ?? (email.theme as string | null) ?? "an email"
    const kindMap = {
      approve: { kind: "client_approve", title: `Client approved "${subjectLabel}"` },
      request_changes: { kind: "client_request_changes", title: `Client requested changes on "${subjectLabel}"` },
      comment: { kind: "client_comment", title: `Client commented on "${subjectLabel}"` },
    } as const
    const spec = kindMap[parsed.data.action]
    const minRole = parsed.data.action === "comment" ? "strategist" : "designer"
    const recipients = await recipientsForBrand({
      brandId: email.brand_id as string,
      minRole,
      excludeUserId: user.id,
    })
    await notify({
      recipients,
      kind: spec.kind,
      title: spec.title,
      body: `${user.displayName ?? user.email}${parsed.data.comment ? ` · "${parsed.data.comment.slice(0, 140)}"` : ""}`,
      link: `/brands/${parsed.data.brandSlug}/calendar/${parsed.data.planId}`,
      brandId: email.brand_id as string,
      entityType: "campaign_email",
      entityId: parsed.data.emailId,
      actorUserId: user.id,
    })
  } catch (err) {
    console.error("[client-approval] notify failed:", err)
  }

  revalidatePath(`/brands/${parsed.data.brandSlug}/calendar/${parsed.data.planId}`)
  return { ok: true }
}
