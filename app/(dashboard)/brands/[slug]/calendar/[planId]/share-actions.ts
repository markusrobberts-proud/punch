"use server"

import { z } from "zod"
import { requireRole } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { recordAudit } from "@/lib/audit"
import { generateApprovalToken, hashApprovalToken } from "@/lib/approval"
import { sendEmail } from "@/lib/email"
import { MONTHS } from "@/lib/months"

const ShareSchema = z.object({
  planId: z.string().uuid(),
  expiresInDays: z.coerce.number().int().min(0).max(365).optional(),
})

export type ShareResult = { ok: true; url: string } | { ok: false; error: string }

export async function createApprovalLink(formData: FormData): Promise<ShareResult> {
  const user = await requireRole("strategist")
  const parsed = ShareSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, error: "Invalid input" }

  const { url } = await provisionApprovalLink({
    userId: user.id,
    planId: parsed.data.planId,
    expiresInDays: parsed.data.expiresInDays,
  })
  return { ok: true, url }
}

/**
 * Same link generation as `createApprovalLink`, but also emails the link
 * to one or more recipients via Resend. Strategist+. The link is returned
 * too so the caller can confirm and offer a copy fallback.
 *
 * We don't fail the whole action if email send fails after the link is
 * created. The link exists, the team can copy-paste it: better than
 * vanishing the work. The error is surfaced so the UI can show a banner.
 */
const SendSchema = z.object({
  planId: z.string().uuid(),
  expiresInDays: z.coerce.number().int().min(0).max(365).optional(),
  // Comma or newline separated emails. Validated downstream.
  recipients: z.string().min(3),
  recipientName: z.string().max(120).optional(),
  message: z.string().max(2000).optional(),
})

export type SendShareResult =
  | { ok: true; url: string; sentTo: string[]; emailWarning?: string }
  | { ok: false; error: string }

export async function sendApprovalLinkByEmail(formData: FormData): Promise<SendShareResult> {
  const user = await requireRole("strategist")
  const parsed = SendSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, error: "Invalid input" }

  // Split + clean recipient list. We're lenient about separators so the
  // strategist can paste a "Kate, Sam" style cc list without thinking
  // about it.
  const recipients = Array.from(
    new Set(
      parsed.data.recipients
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
  const bad = recipients.find((r) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r))
  if (bad) return { ok: false, error: `"${bad}" doesn't look like a valid email.` }
  if (recipients.length === 0) return { ok: false, error: "Add at least one recipient." }
  if (recipients.length > 10) return { ok: false, error: "Max 10 recipients per send." }

  // Provision the link AND look up the brand + plan for the email body.
  const supabase = await createSupabaseServerClient()
  const { data: plan } = await supabase
    .from("campaign_plans")
    .select("id, brand_id, name, month, year")
    .eq("id", parsed.data.planId)
    .single()
  if (!plan) return { ok: false, error: "Plan not found" }

  const { data: brand } = await supabase
    .from("brands")
    .select("name, primary_color")
    .eq("id", plan.brand_id as string)
    .single()

  const { url, token } = await provisionApprovalLink({
    userId: user.id,
    planId: parsed.data.planId,
    expiresInDays: parsed.data.expiresInDays,
  })

  const brandName = (brand?.name as string | undefined) ?? "your brand"
  const brandColor = (brand?.primary_color as string | null) ?? "#1D1D1F"
  const monthLabel = `${MONTHS[(plan.month as number) - 1]} ${plan.year}`
  const senderName = user.displayName?.trim() || user.email.split("@")[0]
  const subject = `${brandName}: ${monthLabel} campaign ready for your review`

  const html = renderShareEmailHtml({
    brandName,
    brandColor,
    monthLabel,
    planName: plan.name as string,
    recipientName: parsed.data.recipientName?.trim() || null,
    senderName,
    message: parsed.data.message?.trim() || null,
    url,
    expiresInDays: parsed.data.expiresInDays ?? 0,
  })
  const text = renderShareEmailText({
    brandName,
    brandColor,
    monthLabel,
    planName: plan.name as string,
    recipientName: parsed.data.recipientName?.trim() || null,
    senderName,
    message: parsed.data.message?.trim() || null,
    url,
    expiresInDays: parsed.data.expiresInDays ?? 0,
  })

  const sendRes = await sendEmail({
    to: recipients,
    subject,
    html,
    text,
    replyTo: user.email,
  })

  await recordAudit({
    userId: user.id,
    brandId: plan.brand_id as string,
    entityType: "campaign_plan",
    entityId: plan.id as string,
    action: "send_approval_link",
    meta: {
      recipients,
      email_ok: sendRes.ok,
      email_id: sendRes.ok ? sendRes.id : null,
      email_error: sendRes.ok ? null : sendRes.error,
      token_id_hash: hashApprovalToken(token).slice(0, 12),
    },
  })

  if (!sendRes.ok) {
    return {
      ok: true,
      url,
      sentTo: [],
      emailWarning: `Link created but email send failed: ${sendRes.error}. Copy the link below and send it yourself.`,
    }
  }
  return { ok: true, url, sentTo: recipients }
}

async function provisionApprovalLink({
  userId,
  planId,
  expiresInDays,
}: {
  userId: string
  planId: string
  expiresInDays?: number
}): Promise<{ url: string; token: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: plan } = await supabase
    .from("campaign_plans")
    .select("brand_id")
    .eq("id", planId)
    .single()
  if (!plan) throw new Error("Plan not found")

  const token = generateApprovalToken()
  const tokenHash = hashApprovalToken(token)
  const expiresAt = expiresInDays && expiresInDays > 0
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const { error } = await supabase.from("approval_links").insert({
    brand_id: plan.brand_id,
    plan_id: planId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_by_user_id: userId,
  })
  if (error) throw new Error(error.message)

  await recordAudit({
    userId,
    brandId: plan.brand_id as string,
    entityType: "campaign_plan",
    entityId: planId,
    action: "create_approval_link",
    meta: { expires_in_days: expiresInDays ?? null },
  })

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  return { url: `${origin}/approval/${token}`, token }
}

/* ---------------- Email templates ---------------- */

type EmailArgs = {
  brandName: string
  brandColor: string
  monthLabel: string
  planName: string
  recipientName: string | null
  senderName: string
  message: string | null
  url: string
  expiresInDays: number
}

function renderShareEmailHtml(args: EmailArgs): string {
  const greeting = args.recipientName ? `Hi ${escapeHtml(args.recipientName)},` : "Hi,"
  const expiryLine =
    args.expiresInDays > 0
      ? `This review link expires in ${args.expiresInDays} days.`
      : "This review link doesn't expire."
  const message = args.message
    ? `<p style="font-size:15px;line-height:1.55;color:#1D1D1F;margin:0 0 16px;">${escapeHtml(args.message).replace(/\n/g, "<br>")}</p>`
    : ""

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif;color:#1D1D1F;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E5E5EA;">
      <div style="background:${escapeAttr(args.brandColor)};height:6px;"></div>
      <div style="padding:32px 28px;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#86868B;margin-bottom:6px;">For approval · ${escapeHtml(args.brandName)}</div>
        <h1 style="font-size:24px;font-weight:600;margin:0 0 4px;line-height:1.2;">${escapeHtml(args.monthLabel)} campaign</h1>
        <p style="font-size:14px;color:#6E6E73;margin:0 0 20px;">${escapeHtml(args.planName)}</p>
        <p style="font-size:15px;line-height:1.55;color:#1D1D1F;margin:0 0 16px;">${greeting}</p>
        <p style="font-size:15px;line-height:1.55;color:#1D1D1F;margin:0 0 16px;">
          ${escapeHtml(args.senderName)} from Proud Creative has the ${escapeHtml(args.monthLabel)} campaign for ${escapeHtml(args.brandName)} ready for you to review. You can approve each email, request changes, or leave a comment.
        </p>
        ${message}
        <p style="margin:24px 0;">
          <a href="${escapeAttr(args.url)}" style="display:inline-block;background:#1D1D1F;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:500;">Review campaign</a>
        </p>
        <p style="font-size:12px;color:#86868B;margin:24px 0 0;line-height:1.5;">
          ${escapeHtml(expiryLine)}<br>
          Or paste this into your browser:<br>
          <span style="word-break:break-all;color:#6E6E73;">${escapeHtml(args.url)}</span>
        </p>
      </div>
    </div>
    <p style="text-align:center;font-size:11px;color:#86868B;margin:20px 0 0;">
      Sent by PUNCH on behalf of Proud Creative.
    </p>
  </div>
</body></html>`
}

function renderShareEmailText(args: EmailArgs): string {
  const lines = [
    args.recipientName ? `Hi ${args.recipientName},` : "Hi,",
    "",
    `${args.senderName} from Proud Creative has the ${args.monthLabel} campaign for ${args.brandName} ready for you to review. You can approve each email, request changes, or leave a comment.`,
  ]
  if (args.message) {
    lines.push("", args.message)
  }
  lines.push(
    "",
    `Review the campaign: ${args.url}`,
    "",
    args.expiresInDays > 0 ? `This link expires in ${args.expiresInDays} days.` : "This link doesn't expire.",
    "",
    "—",
    "Sent by PUNCH on behalf of Proud Creative.",
  )
  return lines.join("\n")
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}
