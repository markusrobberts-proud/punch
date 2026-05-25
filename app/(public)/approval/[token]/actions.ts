"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { headers } from "next/headers"
import { createSupabaseServiceClient } from "@/lib/supabase/server"
import { hashApprovalToken } from "@/lib/approval"
import { notify, recipientsForBrand, type NotificationKind } from "@/lib/notifications"

const ActionSchema = z.object({
  token: z.string().min(1),
  emailId: z.string().uuid(),
  action: z.enum(["approve", "request_changes", "comment"]),
  comment: z.string().max(4000).optional().or(z.literal("")),
})

export type ApprovalActionResult =
  | { ok: true }
  | { ok: false; error: string }

export async function recordApprovalAction(formData: FormData): Promise<ApprovalActionResult> {
  const parsed = ActionSchema.safeParse({
    token: formData.get("token"),
    emailId: formData.get("emailId"),
    action: formData.get("action"),
    comment: formData.get("comment") || "",
  })
  if (!parsed.success) return { ok: false, error: "Invalid input" }
  if (parsed.data.action === "comment" && !parsed.data.comment) {
    return { ok: false, error: "Comment is required" }
  }

  const service = createSupabaseServiceClient()
  const tokenHash = hashApprovalToken(parsed.data.token)

  const { data: link } = await service
    .from("approval_links")
    .select("id, plan_id, brand_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (!link) return { ok: false, error: "Invalid approval link" }
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { ok: false, error: "This approval link has expired" }
  }

  // Make sure the email actually belongs to the linked plan.
  const { data: email } = await service
    .from("campaign_emails")
    .select("id")
    .eq("id", parsed.data.emailId)
    .eq("plan_id", link.plan_id)
    .maybeSingle()
  if (!email) return { ok: false, error: "Email not in this plan" }

  const h = await headers()
  await service.from("approval_actions").insert({
    approval_link_id: link.id,
    campaign_email_id: parsed.data.emailId,
    action: parsed.data.action,
    comment: parsed.data.comment || null,
    client_ip: h.get("x-forwarded-for") ?? null,
    client_user_agent: h.get("user-agent") ?? null,
  })

  // Fire-and-forget notifications to the team behind this brand. We
  // include enough detail (email subject, brand name) so the bell entry
  // reads like a sentence on its own.
  try {
    const [{ data: brand }, { data: emailRow }, { data: plan }] = await Promise.all([
      service.from("brands").select("name, slug").eq("id", link.brand_id).single(),
      service.from("campaign_emails").select("subject_line, theme, plan_id").eq("id", parsed.data.emailId).single(),
      service.from("campaign_plans").select("name").eq("id", link.plan_id).single(),
    ])
    const subjectLabel = (emailRow?.subject_line as string | null) ?? (emailRow?.theme as string | null) ?? "an email"
    const planName = (plan?.name as string | null) ?? "the campaign"
    const brandName = (brand?.name as string | null) ?? "the brand"
    const brandSlug = (brand?.slug as string | null) ?? null
    const link2 = brandSlug ? `/brands/${brandSlug}/calendar/${link.plan_id}` : null

    const kindMap: Record<string, { kind: NotificationKind; title: string; minRole: "designer" | "strategist" }> = {
      approve: {
        kind: "client_approve",
        title: `Client approved "${subjectLabel}"`,
        minRole: "designer",
      },
      request_changes: {
        kind: "client_request_changes",
        title: `Client requested changes on "${subjectLabel}"`,
        minRole: "designer",
      },
      comment: {
        kind: "client_comment",
        title: `Client commented on "${subjectLabel}"`,
        // Comments are conversational; only strategist+ needs to see them.
        minRole: "strategist",
      },
    }
    const spec = kindMap[parsed.data.action]
    if (spec) {
      const recipients = await recipientsForBrand({
        brandId: link.brand_id as string,
        minRole: spec.minRole,
      })
      await notify({
        recipients,
        kind: spec.kind,
        title: spec.title,
        body: `${brandName} · ${planName}${parsed.data.comment ? ` · "${parsed.data.comment.slice(0, 140)}"` : ""}`,
        link: link2,
        brandId: link.brand_id as string,
        entityType: "campaign_email",
        entityId: parsed.data.emailId,
      })
    }
  } catch (err) {
    console.error("[approval-actions] notification dispatch failed:", err)
  }

  revalidatePath(`/approval/${parsed.data.token}`)
  return { ok: true }
}
