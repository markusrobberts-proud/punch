import { notFound } from "next/navigation"
import { Printer } from "lucide-react"
import { createSupabaseServiceClient } from "@/lib/supabase/server"
import { hashApprovalToken } from "@/lib/approval"
import { MONTHS } from "@/lib/months"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClientApprovalCard } from "./client-approval-card"
import { PrintButton } from "./print-button"

type ApprovalView = {
  brand: { id: string; name: string; primary_color: string | null }
  plan: { id: string; month: number; year: number; name: string; strategic_rationale: string | null }
  expiresAt: string | null
  emails: Array<{
    id: string
    sequence_number: number
    scheduled_date: string | null
    theme: string | null
    email_type: string | null
    format: "text" | "designed" | "sms"
    target_segment: string | null
    strategic_rationale: string | null
    subject_line: string | null
    preview_text: string | null
    body_headline: string | null
    body_copy: string | null
    cta_text: string | null
    cta_url: string | null
    sms_body: string | null
    sender_identity: string | null
    layout_template: string | null
    design_brief: string | null
    imagery_notes: string | null
    colour_notes: string | null
    latestAction: { action: string; comment: string | null; acted_at: string } | null
  }>
}

async function loadApprovalView(token: string): Promise<ApprovalView | null> {
  const service = createSupabaseServiceClient()
  const tokenHash = hashApprovalToken(token)

  const { data: link } = await service
    .from("approval_links")
    .select("id, plan_id, brand_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle()
  if (!link) return null
  if (link.expires_at && new Date(link.expires_at) < new Date()) return null

  const [{ data: plan }, { data: brand }, { data: emails }, { data: actions }] = await Promise.all([
    service
      .from("campaign_plans")
      .select("id, month, year, name, strategic_rationale")
      .eq("id", link.plan_id)
      .single(),
    service
      .from("brands")
      .select("id, name, primary_color")
      .eq("id", link.brand_id)
      .single(),
    service
      .from("campaign_emails")
      .select(
        "id, sequence_number, scheduled_date, theme, email_type, format, target_segment, strategic_rationale, subject_line, preview_text, body_headline, body_copy, cta_text, cta_url, sms_body, sender_identity, layout_template, design_brief, imagery_notes, colour_notes",
      )
      .eq("plan_id", link.plan_id)
      .order("sequence_number", { ascending: true }),
    service
      .from("approval_actions")
      .select("campaign_email_id, action, comment, acted_at")
      .eq("approval_link_id", link.id)
      .order("acted_at", { ascending: false }),
  ])

  if (!plan || !brand) return null

  const latestByEmail = new Map<string, { action: string; comment: string | null; acted_at: string }>()
  for (const a of (actions ?? []) as Array<{
    campaign_email_id: string
    action: string
    comment: string | null
    acted_at: string
  }>) {
    if (!latestByEmail.has(a.campaign_email_id) && a.action !== "comment") {
      latestByEmail.set(a.campaign_email_id, { action: a.action, comment: a.comment, acted_at: a.acted_at })
    }
  }

  return {
    brand: brand as ApprovalView["brand"],
    plan: plan as ApprovalView["plan"],
    expiresAt: link.expires_at as string | null,
    emails: ((emails ?? []) as Array<Omit<ApprovalView["emails"][number], "latestAction">>).map((e) => ({
      ...e,
      latestAction: latestByEmail.get(e.id) ?? null,
    })),
  }
}

export default async function ClientApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const view = await loadApprovalView(token)
  if (!view) notFound()

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 md:py-10 print:py-0 print:px-0 print:max-w-none">
      <header className="mb-6 md:mb-8 print:mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
                style={{ background: view.brand.primary_color || "#1D1D1F" }}
              >
                {view.brand.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="text-[12px] text-[#6E6E73] truncate">For approval · {view.brand.name}</div>
            </div>
            <h1 className="text-[24px] sm:text-[28px] md:text-[30px] font-semibold tracking-display leading-tight">
              {MONTHS[view.plan.month - 1]} {view.plan.year}
            </h1>
            <p className="text-[14px] text-[#6E6E73] mt-1">{view.plan.name}</p>
          </div>
          <div className="sm:shrink-0">
            <PrintButton />
          </div>
        </div>
        {view.expiresAt && (
          <p className="text-[11px] text-[#86868B] mt-3">
            Link expires {new Date(view.expiresAt).toLocaleDateString()}
          </p>
        )}
      </header>

      {view.plan.strategic_rationale && (
        <Card className="mb-6 print:mb-4">
          <CardHeader>
            <CardTitle>How we're approaching this month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[13.5px] whitespace-pre-wrap leading-relaxed">
              {view.plan.strategic_rationale}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3 print:space-y-2">
        {view.emails.map((e) => (
          <ClientApprovalCard key={e.id} email={e} token={token} />
        ))}
      </div>

      <footer className="mt-10 text-[11px] text-[#86868B] text-center">
        Powered by PUNCH. Approvals are recorded with timestamp.
      </footer>

      <style>{`
        @media print {
          @page { margin: 16mm; }
          .no-print { display: none !important; }
          body { background: white !important; background-image: none !important; }
        }
      `}</style>
    </main>
  )
}

export const dynamic = "force-dynamic"
