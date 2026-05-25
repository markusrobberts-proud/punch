import { NextResponse } from "next/server"
import { runDigestCron } from "@/lib/notification-digest"

/**
 * Daily notification-digest cron. Scheduled in vercel.json. Vercel signs
 * cron requests with the project's CRON_SECRET; we verify the Authorization
 * header so a public hit can't trigger a mass email send.
 *
 * Cadence breakdown lives in lib/notification-digest.ts: daily users get
 * one every run; weekly users get one only on Mondays.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  // Vercel cron sends "Authorization: Bearer <CRON_SECRET>".
  if (secret) {
    const auth = req.headers.get("authorization") ?? ""
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  } else {
    console.warn("[cron/digest] CRON_SECRET is not set; refusing in production")
    if (process.env.VERCEL === "1") {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 })
    }
  }

  const result = await runDigestCron()
  return NextResponse.json({ ok: true, ...result })
}
