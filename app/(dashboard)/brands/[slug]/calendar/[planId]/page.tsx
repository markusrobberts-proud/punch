import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Sparkles } from "lucide-react"
import { requireApprovedUser } from "@/lib/auth"
import { canEditStrategy } from "@/lib/rbac"
import { getBrandBySlug } from "@/lib/brands"
import { getPlanWithEmails } from "@/lib/campaigns"
import { MONTHS } from "@/lib/months"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageShell } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { PlanControls } from "./plan-controls"
import { EmailRow } from "./email-row"
import { ApprovalPoller } from "./approval-poller"

type ApprovalAction = {
  campaign_email_id: string | null
  action: string
  comment: string | null
  acted_at: string
}

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ slug: string; planId: string }>
}) {
  const user = await requireApprovedUser()
  const { slug, planId } = await params
  const brand = await getBrandBySlug(slug)
  if (!brand) notFound()
  const { plan, emails } = await getPlanWithEmails(planId)
  if (!plan) notFound()

  const canEdit = canEditStrategy(user.role)
  const copyUnlocked = plan.status !== "draft" && plan.status !== "generating" && plan.status !== "pending_review"

  // Pull approval link IDs + latest action per email for this plan.
  const supabase = await createSupabaseServerClient()
  const { data: links } = await supabase
    .from("approval_links")
    .select("id, created_at, expires_at")
    .eq("plan_id", planId)
  const linkIds = ((links ?? []) as Array<{ id: string }>).map((l) => l.id)

  let latestByEmail = new Map<string, ApprovalAction>()
  let totalActions = 0
  if (linkIds.length > 0) {
    const { data: actions } = await supabase
      .from("approval_actions")
      .select("campaign_email_id, action, comment, acted_at")
      .in("approval_link_id", linkIds)
      .order("acted_at", { ascending: false })
    const list = (actions ?? []) as ApprovalAction[]
    totalActions = list.length
    for (const a of list) {
      if (!a.campaign_email_id) continue
      if (!latestByEmail.has(a.campaign_email_id) && a.action !== "comment") {
        latestByEmail.set(a.campaign_email_id, a)
      }
    }
  }

  const sharedAt = (links?.[0] as { created_at: string } | undefined)?.created_at ?? null
  const approveCount = Array.from(latestByEmail.values()).filter((a) => a.action === "approve").length
  const changesCount = Array.from(latestByEmail.values()).filter((a) => a.action === "request_changes").length

  return (
    <PageShell>
      <Link
        href={`/brands/${brand.slug}/calendar`}
        className="inline-flex items-center gap-1.5 text-[12px] text-[#6E6E73] hover:text-[#1D1D1F] mb-6"
      >
        <ArrowLeft className="size-3.5" /> Calendar
      </Link>

      <div className="flex items-start justify-between gap-6 mb-8">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-[#86868B] mb-1">{brand.name}</div>
          <h1 className="text-[34px] font-semibold tracking-display leading-tight">
            {MONTHS[plan.month - 1]} {plan.year}
          </h1>
          <p className="text-[15px] text-[#6E6E73] mt-2">{plan.name}</p>
        </div>
        <PlanControls plan={plan} canEdit={canEdit} />
      </div>

      {linkIds.length > 0 && (
        <Card className="mb-6">
          <CardContent className="py-4 flex items-center justify-between gap-4 text-[13px]">
            <div>
              <div className="font-medium">Client review in progress</div>
              <div className="text-[11.5px] text-[#86868B] mt-0.5">
                Shared {sharedAt && new Date(sharedAt).toLocaleDateString()} · {totalActions} client {totalActions === 1 ? "action" : "actions"} so far
              </div>
            </div>
            <div className="flex items-center gap-2">
              {approveCount > 0 && <Badge variant="success">{approveCount} approved</Badge>}
              {changesCount > 0 && <Badge variant="warning">{changesCount} changes requested</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

      {plan.strategic_rationale && (
        <Card variant="glass-tinted-blue" className="mb-6">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#007AFF] flex items-center justify-center shrink-0">
                <Sparkles className="size-4 text-white" />
              </div>
              <div>
                <CardTitle>Claude's reasoning for this calendar</CardTitle>
                <CardDescription>Grounded in Proud Strategy plus {brand.name}'s knowledge bank.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-[13.5px] whitespace-pre-wrap leading-relaxed">{plan.strategic_rationale}</p>
          </CardContent>
        </Card>
      )}

      {plan.team_brief && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Team brief</CardTitle>
            <CardDescription>What was given to Claude to work from.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-[13.5px] whitespace-pre-wrap leading-relaxed">{plan.team_brief}</p>
          </CardContent>
        </Card>
      )}

      {(plan.target_designed_count != null || plan.target_text_count != null || plan.target_sms_count != null) && (
        <div className="flex items-center gap-2 mb-6 text-[12px]">
          <span className="text-[#86868B]">Cadence targets:</span>
          {plan.target_designed_count != null && <Badge variant="accent">{plan.target_designed_count} designed</Badge>}
          {plan.target_text_count != null && <Badge variant="neutral">{plan.target_text_count} text</Badge>}
          {plan.target_sms_count != null && plan.target_sms_count > 0 && (
            <Badge variant="info">{plan.target_sms_count} SMS</Badge>
          )}
        </div>
      )}

      {emails.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No emails generated yet</CardTitle>
            <CardDescription>
              {canEdit ? "Click \"Generate calendar\" above to draft the month." : "A strategist or admin needs to kick off the generation."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-2">
          {emails.map((e) => {
            const latest = latestByEmail.get(e.id) ?? null
            return (
              <EmailRow
                key={e.id}
                email={e}
                canEdit={canEdit}
                copyUnlocked={copyUnlocked}
                clientAction={latest ? { action: latest.action, comment: latest.comment, acted_at: latest.acted_at } : null}
              />
            )
          })}
        </div>
      )}

      {linkIds.length > 0 && <ApprovalPoller planId={planId} initialCount={totalActions} />}
    </PageShell>
  )
}
