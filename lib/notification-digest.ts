import { createSupabaseServiceClient } from "./supabase/server"
import { sendEmail } from "./email"
import type { Notification, NotificationKind } from "./notifications"

export type DigestFrequency = "daily" | "weekly" | "off"

type UserDigestRow = {
  id: string
  email: string
  display_name: string | null
  notification_digest: DigestFrequency
  last_digest_sent_at: string | null
}

type DigestRunResult = {
  sent: number
  skipped: number
  errors: Array<{ userId: string; error: string }>
}

const KIND_LABEL: Record<NotificationKind, string> = {
  client_approve: "Client approved",
  client_request_changes: "Client requested changes",
  client_comment: "Client commented",
  plan_approved: "Calendar approved",
  briefs_ready: "Briefs ready",
  knowledge_pending: "Knowledge to review",
  inbound_email: "Email forwarded",
  user_pending: "User awaiting approval",
  role_changed: "Role changed",
  scrape_complete: "Website scrape complete",
}

/**
 * Runs every morning via the Vercel cron job. For each user whose digest
 * is enabled, gathers the notifications they've received since the last
 * digest (or in the last 24h / 7d depending on cadence) and emails them
 * a roundup.
 *
 * We send even if some items are already read in the bell: read-state is
 * about the bell UI; the digest is about catching up if you haven't
 * opened the app.
 */
export async function runDigestCron(now = new Date()): Promise<DigestRunResult> {
  const supabase = createSupabaseServiceClient()

  // Pick the cohort for this run. Daily fires every cron tick; weekly
  // only fires on Mondays (UTC Monday is Monday morning AEDT, close
  // enough for an internal digest).
  const isMonday = now.getUTCDay() === 1
  const frequencies: DigestFrequency[] = isMonday ? ["daily", "weekly"] : ["daily"]

  const { data: users } = await supabase
    .from("users")
    .select("id, email, display_name, notification_digest, last_digest_sent_at")
    .in("notification_digest", frequencies)
    .neq("role", "pending")

  const out: DigestRunResult = { sent: 0, skipped: 0, errors: [] }
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://punch-email-os.vercel.app").replace(/\/$/, "")

  for (const u of (users ?? []) as UserDigestRow[]) {
    if (!u.email) {
      out.skipped++
      continue
    }
    const sinceMs =
      u.notification_digest === "weekly"
        ? 7 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000
    const cutoff = new Date(now.getTime() - sinceMs).toISOString()

    // Avoid double-sending within the window even if the cron fires twice.
    if (u.last_digest_sent_at && new Date(u.last_digest_sent_at).getTime() > now.getTime() - sinceMs / 2) {
      out.skipped++
      continue
    }

    const { data: notes } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", u.id)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(50)

    const list = (notes ?? []) as Notification[]
    if (list.length === 0) {
      out.skipped++
      continue
    }

    const { html, text, subject } = renderDigest({
      displayName: u.display_name ?? u.email.split("@")[0],
      notifications: list,
      frequency: u.notification_digest,
      appUrl,
    })

    const result = await sendEmail({ to: u.email, subject, html, text })
    if (!result.ok) {
      out.errors.push({ userId: u.id, error: result.error })
      continue
    }

    await supabase
      .from("users")
      .update({ last_digest_sent_at: now.toISOString() })
      .eq("id", u.id)
    out.sent++
  }

  return out
}

function renderDigest({
  displayName,
  notifications,
  frequency,
  appUrl,
}: {
  displayName: string
  notifications: Notification[]
  frequency: DigestFrequency
  appUrl: string
}) {
  const window = frequency === "weekly" ? "this week" : "today"
  const unread = notifications.filter((n) => !n.read_at).length
  const total = notifications.length
  const subject =
    unread > 0
      ? `${unread} unread in PUNCH (${window})`
      : `${total} updates in PUNCH (${window})`

  // Group by kind for the section headings.
  const groups = new Map<NotificationKind, Notification[]>()
  for (const n of notifications) {
    const k = n.kind as NotificationKind
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(n)
  }

  const sectionsHtml: string[] = []
  const sectionsText: string[] = []

  for (const [kind, list] of groups) {
    sectionsHtml.push(`
      <div style="margin-top:24px;">
        <div style="font-size:11px;font-weight:600;color:#86868B;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">
          ${escapeHtml(KIND_LABEL[kind] ?? kind)}
        </div>
        ${list
          .map(
            (n) => `
              <div style="padding:12px 0;border-bottom:1px solid #F0F0F2;">
                <div style="font-size:14px;color:#1D1D1F;font-weight:500;line-height:1.4;">
                  ${
                    n.link
                      ? `<a href="${appUrl}${escapeAttr(n.link)}" style="color:#1D1D1F;text-decoration:none;">${escapeHtml(n.title)}</a>`
                      : escapeHtml(n.title)
                  }
                </div>
                ${
                  n.body
                    ? `<div style="font-size:13px;color:#6E6E73;margin-top:4px;line-height:1.45;">${escapeHtml(n.body)}</div>`
                    : ""
                }
              </div>
            `,
          )
          .join("")}
      </div>
    `)
    sectionsText.push(
      `\n${KIND_LABEL[kind] ?? kind}\n` +
        list
          .map((n) => `  • ${n.title}${n.body ? ` — ${n.body}` : ""}${n.link ? `\n    ${appUrl}${n.link}` : ""}`)
          .join("\n"),
    )
  }

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#1D1D1F;">PUNCH</div>
    <p style="font-size:14px;color:#1D1D1F;margin-top:24px;line-height:1.5;">
      Hi ${escapeHtml(displayName)}, here's what's happened in PUNCH ${window}.
    </p>
    ${sectionsHtml.join("")}
    <div style="margin-top:32px;font-size:12px;color:#86868B;line-height:1.55;">
      <a href="${appUrl}/notifications" style="color:#007AFF;text-decoration:none;">See everything in the app →</a><br/>
      Change how often you get these in <a href="${appUrl}/settings" style="color:#007AFF;text-decoration:none;">Settings</a>.
    </div>
  </div>
</body></html>`

  const text =
    `PUNCH digest\n\n` +
    `Hi ${displayName}, here's what's happened ${window}.\n` +
    sectionsText.join("\n") +
    `\n\nSee everything: ${appUrl}/notifications` +
    `\nChange digest frequency: ${appUrl}/settings\n`

  return { html, text, subject }
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
