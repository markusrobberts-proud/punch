import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { MONTHS } from "@/lib/months"
import type { CampaignEmail, CampaignPlan } from "@/lib/campaigns"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageShell } from "@/components/layout/page-header"
import { ClientEmailRow } from "./client-email-row"

type Brand = { slug: string; name: string; primary_color: string | null }

/**
 * Stripped-down plan view for an authenticated client. No internal
 * strategist machinery (no stage pills, strategic rationale, regenerate
 * buttons, team brief, cadence targets, share-link card, asana exports).
 * Just the campaign: month, emails in order, and approve/request-changes
 * /comment per email. If the campaign isn't ready for review yet, the
 * page tells them so.
 */
export function ClientPlanView({
  brand,
  plan,
  emails,
  latestActionByEmail,
}: {
  brand: Brand
  plan: CampaignPlan
  emails: CampaignEmail[]
  latestActionByEmail: Map<string, { action: string; comment: string | null; acted_at: string }>
}) {
  const reviewable = plan.status === "briefs_done" || plan.status === "complete" || plan.status === "copy_done"

  return (
    <PageShell>
      <Link
        href={`/brands/${brand.slug}/calendar`}
        className="inline-flex items-center gap-1.5 text-[12px] text-[#6E6E73] hover:text-[#1D1D1F] mb-6"
      >
        <ArrowLeft className="size-3.5" /> Campaigns
      </Link>

      <div className="mb-8">
        <div className="text-[11px] uppercase tracking-wider text-[#86868B] mb-1">{brand.name}</div>
        <h1 className="text-[34px] font-semibold tracking-display leading-tight">
          {MONTHS[plan.month - 1]} {plan.year}
        </h1>
        <p className="text-[15px] text-[#6E6E73] mt-2">{plan.name}</p>
      </div>

      {!reviewable ? (
        <Card variant="glass-tinted-blue">
          <CardContent className="p-6">
            <h2 className="text-[15px] font-semibold mb-1.5">We're still working on this one</h2>
            <p className="text-[13.5px] text-[#1D1D1F] leading-relaxed">
              Your strategist is putting this campaign together. As soon as it's ready for your review, this page will fill in and you'll get a notification.
            </p>
          </CardContent>
        </Card>
      ) : emails.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-[13.5px] text-[#86868B]">
            No emails to review yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <ClientReviewSummary emails={emails} latestActionByEmail={latestActionByEmail} />
          <div className="space-y-3 mt-6">
            {emails.map((e) => {
              const latest = latestActionByEmail.get(e.id) ?? null
              return (
                <ClientEmailRow
                  key={e.id}
                  brandSlug={brand.slug}
                  planId={plan.id}
                  email={e}
                  latest={latest}
                />
              )
            })}
          </div>
        </>
      )}
    </PageShell>
  )
}

function ClientReviewSummary({
  emails,
  latestActionByEmail,
}: {
  emails: CampaignEmail[]
  latestActionByEmail: Map<string, { action: string; comment: string | null; acted_at: string }>
}) {
  let approved = 0
  let changes = 0
  let comments = 0
  for (const e of emails) {
    const a = latestActionByEmail.get(e.id)
    if (!a) continue
    if (a.action === "approve") approved++
    else if (a.action === "request_changes") changes++
    else if (a.action === "comment") comments++
  }
  const remaining = emails.length - approved - changes

  return (
    <Card>
      <CardContent className="py-4 flex items-center justify-between gap-4 text-[13px]">
        <div>
          <div className="font-medium">
            {remaining === 0
              ? "Thanks, you're all caught up."
              : `${remaining} of ${emails.length} ${remaining === 1 ? "email" : "emails"} waiting on you`}
          </div>
          <div className="text-[11.5px] text-[#86868B] mt-0.5">
            Approve, request changes, or leave a comment per email below. Your strategist sees it immediately.
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {approved > 0 && <Badge variant="success">{approved} approved</Badge>}
          {changes > 0 && <Badge variant="warning">{changes} changes requested</Badge>}
          {comments > 0 && <Badge variant="info">{comments} commented</Badge>}
        </div>
      </CardContent>
    </Card>
  )
}

