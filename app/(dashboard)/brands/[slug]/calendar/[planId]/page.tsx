import { notFound } from "next/navigation"
import { requireApprovedUser } from "@/lib/auth"
import { canEditStrategy } from "@/lib/rbac"
import { getBrandBySlug } from "@/lib/brands"
import { getPlanWithEmails, MONTHS } from "@/lib/campaigns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PlanControls } from "./plan-controls"
import { EmailRow } from "./email-row"

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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{brand.name}</div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {MONTHS[plan.month - 1]} {plan.year}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{plan.name}</p>
      </div>

      <PlanControls plan={plan} canEdit={canEdit} />

      {plan.strategic_rationale && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Claude's reasoning for this calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{plan.strategic_rationale}</p>
          </CardContent>
        </Card>
      )}

      {plan.team_brief && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team brief</CardTitle>
            <CardDescription>What the team gave Claude to work from.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{plan.team_brief}</p>
          </CardContent>
        </Card>
      )}

      {emails.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No emails generated yet</CardTitle>
            <CardDescription>Hit "Generate calendar" above to draft the month.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {emails.map((e) => (
            <EmailRow
              key={e.id}
              email={e}
              canEdit={canEdit}
              copyUnlocked={plan.status !== "draft" && plan.status !== "generating" && plan.status !== "pending_review"}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function PlanStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "secondary" | "warning" | "success" | "destructive"; label: string }> = {
    draft: { variant: "secondary", label: "Draft" },
    generating: { variant: "warning", label: "Generating…" },
    pending_review: { variant: "warning", label: "Pending review" },
    calendar_approved: { variant: "success", label: "Calendar approved" },
    copy_generating: { variant: "warning", label: "Copy generating…" },
    copy_done: { variant: "success", label: "Copy done" },
    briefs_done: { variant: "success", label: "Briefs done" },
    complete: { variant: "success", label: "Complete" },
    error: { variant: "destructive", label: "Error" },
  }
  const m = map[status] ?? { variant: "secondary" as const, label: status }
  return <Badge variant={m.variant}>{m.label}</Badge>
}
