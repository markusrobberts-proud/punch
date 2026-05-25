import { notFound } from "next/navigation"
import Link from "next/link"
import { Plus, Sparkles, FileText, Clock } from "lucide-react"
import { requireApprovedUser } from "@/lib/auth"
import { getBrandBySlug } from "@/lib/brands"
import { listPlansForBrand } from "@/lib/campaigns"
import { MONTHS } from "@/lib/months"
import { canEditStrategy, canEditBrief, isClient } from "@/lib/rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader, PageShell } from "@/components/layout/page-header"
import { PlanRowDelete } from "./plan-row-delete"

const STATUS_BADGE: Record<string, { variant: "neutral" | "success" | "warning" | "destructive"; label: string }> = {
  draft: { variant: "neutral", label: "Draft" },
  generating: { variant: "warning", label: "Generating..." },
  pending_review: { variant: "warning", label: "Pending review" },
  calendar_approved: { variant: "success", label: "Calendar approved" },
  copy_generating: { variant: "warning", label: "Copy generating..." },
  copy_done: { variant: "success", label: "Copy done" },
  briefs_done: { variant: "success", label: "Briefs done" },
  complete: { variant: "success", label: "Complete" },
  error: { variant: "destructive", label: "Error" },
}

/**
 * Designer view of the row badge: we don't want them squinting at "copy_done"
 * vs "calendar_approved", they just want to know "is the brief ready?".
 */
const BRIEF_READY_STATUSES = new Set(["briefs_done", "complete"])

export default async function BrandCalendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireApprovedUser()
  const { slug } = await params
  const brand = await getBrandBySlug(slug)
  if (!brand) notFound()
  const plans = await listPlansForBrand(brand.id)
  const canPlan = canEditStrategy(user.role)
  const designerView = !canPlan && canEditBrief(user.role)
  const clientView = isClient(user.role)
  // Internal team without plan rights (designers, plain viewers if any).
  const viewerOnly = !canPlan && !designerView && !clientView

  const byYear = plans.reduce<Record<number, typeof plans>>((acc, p) => {
    acc[p.year] ??= []
    acc[p.year].push(p)
    return acc
  }, {})

  return (
    <PageShell>
      <PageHeader
        eyebrow={brand.name}
        title={clientView ? "Your campaigns" : "Campaign Calendar"}
        description={
          clientView
            ? "Campaigns Proud is preparing for you. Open one to review, approve, and leave comments per email."
            : "One plan per month. Draft, review, approve, then move into copy and brief generation."
        }
        actions={
          canPlan && (
            <Button asChild>
              <Link href={`/brands/${brand.slug}/calendar/new`}>
                <Plus /> Plan next month
              </Link>
            </Button>
          )
        }
      />

      {plans.length === 0 ? (
        <Card variant="glass-tinted-blue">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#007AFF] flex items-center justify-center shrink-0">
                {canPlan ? <Sparkles className="size-5 text-white" /> : <Clock className="size-5 text-white" />}
              </div>
              <div>
                <CardTitle>
                  {canPlan
                    ? "Plan your first month"
                    : designerView
                      ? "No briefs yet"
                      : clientView
                        ? "Nothing to review yet"
                        : "No campaigns yet"}
                </CardTitle>
                <CardDescription>
                  {canPlan
                    ? "Give Claude cadence targets and a short brief. It'll propose a calendar grounded in Proud Strategy + this brand's knowledge bank."
                    : designerView
                      ? "Briefs will appear here once a strategist plans the next campaign. Nothing to do right now."
                      : clientView
                        ? "Proud is preparing your next campaign. You'll get a notification the moment it's ready for your review."
                        : "Campaigns will appear here once a strategist plans the next month."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          {canPlan && (
            <CardContent>
              <Button asChild>
                <Link href={`/brands/${brand.slug}/calendar/new`}>
                  <Plus /> Plan next month
                </Link>
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <div className="space-y-10">
          {Object.entries(byYear)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([year, list]) => (
              <div key={year}>
                <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-3">{year}</div>
                <Card>
                  <CardContent className="p-0">
                    {list.map((p, idx) => {
                      const badge = STATUS_BADGE[p.status] ?? { variant: "neutral" as const, label: p.status }
                      const briefReady = BRIEF_READY_STATUSES.has(p.status)
                      // Designers and clients click through to the plan only
                      // when the brief is actually ready; otherwise we show a
                      // dim "Brief pending" row so they know it's coming
                      // without dead-ending on a half-built plan.
                      const blockClick = (designerView || viewerOnly || clientView) && !briefReady
                      const rowClasses = `flex items-center justify-between gap-4 px-5 py-4 transition ${
                        idx === list.length - 1 ? "" : "border-b border-[#E5E5EA]"
                      } ${blockClick ? "opacity-60 cursor-not-allowed" : "hover:bg-white/60"}`

                      const right = canPlan ? (
                        <div className="flex items-center gap-2">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <PlanRowDelete planId={p.id} brandSlug={brand.slug} campaignName={p.name} />
                        </div>
                      ) : briefReady ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#007AFF] font-medium">
                          <FileText className="size-3.5" /> {clientView ? "Review campaign" : "See brief"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#86868B] font-medium">
                          <Clock className="size-3.5" /> {clientView ? "Coming soon" : "Brief pending"}
                        </span>
                      )

                      const rowBody = (
                        <>
                          <div className="min-w-0">
                            <div className="text-[14px] font-medium">{MONTHS[p.month - 1]}</div>
                            <div className="text-[12px] text-[#86868B] mt-0.5 truncate">{p.name}</div>
                          </div>
                          {right}
                        </>
                      )

                      return blockClick ? (
                        <div
                          key={p.id}
                          className={rowClasses}
                          title="The strategist is still putting this campaign together."
                          aria-disabled
                        >
                          {rowBody}
                        </div>
                      ) : (
                        <Link
                          key={p.id}
                          href={`/brands/${brand.slug}/calendar/${p.id}`}
                          className={rowClasses}
                        >
                          {rowBody}
                        </Link>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>
            ))}
        </div>
      )}
    </PageShell>
  )
}
