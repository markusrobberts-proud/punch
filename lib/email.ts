/**
 * Thin Resend wrapper. We call the REST API directly to keep the
 * dependency surface small. Returns { ok, id|error } so callers can log
 * + audit cleanly.
 */

type SendArgs = {
  to: string | string[]
  subject: string
  html: string
  text: string
  /** Optional reply-to. Defaults to the team@ alias. */
  replyTo?: string
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string }

const FROM_DEFAULT = "PUNCH <notifications@kb.punch.studio>"

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return { ok: false, error: "RESEND_API_KEY is not set" }
  }

  const from = process.env.RESEND_FROM ?? FROM_DEFAULT

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(args.to) ? args.to : [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
        reply_to: args.replyTo,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 240)}` }
    }
    const json = (await res.json()) as { id?: string }
    return { ok: true, id: json.id ?? "" }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
