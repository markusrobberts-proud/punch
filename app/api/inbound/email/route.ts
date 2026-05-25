import { NextResponse } from "next/server"
import { createSupabaseServiceClient } from "@/lib/supabase/server"
import { summariseInboundEmail } from "@/lib/ai/prompts/inbound-summary"

/**
 * Resend Inbound webhook handler.
 *
 * Configure in Resend: send POST to /api/inbound/email when an inbound
 * email lands on a kb.<domain> address. The webhook payload structure
 * follows Resend's docs:
 * https://resend.com/docs/dashboard/webhooks/introduction
 *
 * Auth: Resend signs the webhook with a secret in `svix-*` headers OR
 * a shared bearer token in Authorization. We support the bearer-token
 * pattern via INBOUND_EMAIL_WEBHOOK_TOKEN for simplicity.
 *
 * Body identification: we extract the inbox_alias from the "to" address
 * (the part before @kb.<domain>), look up the brand by inbox_alias, then
 * summarise the body via Haiku and insert as a pending_review knowledge
 * item. If the brand's auto_ingest_forwarded_emails flag is off, we still
 * insert (review queue means an admin sees it) but skip the AI summary.
 */

type InboundPayload = {
  from?: { address?: string; name?: string } | string
  to?: Array<{ address?: string; name?: string }> | string
  subject?: string
  text?: string
  html?: string
  // Resend also uses these alternate shapes; we read whichever is present.
  sender?: string
  recipient?: string
  body_plain?: string
  body_html?: string
}

function extractEmail(value: unknown): string | null {
  if (!value) return null
  if (typeof value === "string") {
    const m = value.match(/<([^>]+)>/)
    return (m ? m[1] : value).trim().toLowerCase() || null
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      const e = extractEmail(v)
      if (e) return e
    }
    return null
  }
  if (typeof value === "object") {
    const obj = value as { address?: string; email?: string }
    return (obj.address ?? obj.email ?? null)?.toLowerCase() ?? null
  }
  return null
}

function aliasFromAddress(addr: string): string | null {
  const [local] = addr.split("@")
  if (!local) return null
  // Resend may add a +tag suffix; strip it.
  return local.split("+")[0].toLowerCase()
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

export async function POST(req: Request) {
  // Optional shared-secret check.
  const token = process.env.INBOUND_EMAIL_WEBHOOK_TOKEN
  if (token) {
    const auth = req.headers.get("authorization") ?? ""
    if (auth !== `Bearer ${token}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  let payload: InboundPayload
  try {
    payload = (await req.json()) as InboundPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const toAddr = extractEmail(payload.to ?? payload.recipient)
  if (!toAddr) return NextResponse.json({ error: "Missing recipient" }, { status: 400 })
  const alias = aliasFromAddress(toAddr)
  if (!alias) return NextResponse.json({ error: "Bad recipient format" }, { status: 400 })

  const supabase = createSupabaseServiceClient()
  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, auto_ingest_forwarded_emails")
    .eq("inbox_alias", alias)
    .maybeSingle()
  if (!brand) {
    // Unknown inbox alias. Resend will retry, but we ack with 200 to drop it.
    return NextResponse.json({ ok: true, skipped: "unknown_inbox" })
  }

  const fromAddr = extractEmail(payload.from ?? payload.sender) ?? "(unknown sender)"
  const subject = payload.subject ?? "(no subject)"
  const rawText =
    payload.text ??
    payload.body_plain ??
    (payload.html ? htmlToText(payload.html) : null) ??
    (payload.body_html ? htmlToText(payload.body_html) : "") ??
    ""

  const aiKeyPresent = !!(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY)
  const wantsAi = brand.auto_ingest_forwarded_emails !== false && aiKeyPresent

  let title = subject
  let content = `From: ${fromAddr}\nSubject: ${subject}\n\n${rawText}`

  if (wantsAi && rawText.length > 50) {
    try {
      const summary = await summariseInboundEmail({
        brandName: brand.name as string,
        from: fromAddr,
        subject,
        body: rawText,
      })
      title = summary.title
      content = [
        `**Summary**`,
        summary.summary,
        ``,
        `**Key facts**`,
        ...summary.key_facts.map((f) => `- ${f}`),
        ``,
        `---`,
        `From: ${fromAddr}`,
        `Subject: ${subject}`,
        ``,
        rawText,
      ].join("\n")
    } catch (err) {
      console.error("[inbound] AI summary failed:", err)
    }
  }

  await supabase.from("knowledge_items").insert({
    brand_id: brand.id,
    source_type: "inbound_email",
    title,
    content,
    email_from: fromAddr,
    email_subject: subject,
    email_received_at: new Date().toISOString(),
    review_status: "pending_review",
  })

  return NextResponse.json({ ok: true })
}
