"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { generateCalendar, approveCalendar, generateAllCopy, generateAllBriefs } from "../actions"
import type { CampaignPlan } from "@/lib/campaigns"

export function PlanControls({ plan, canEdit }: { plan: CampaignPlan; canEdit: boolean }) {
  const [pending, startTransition] = useTransition()

  function act(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn()
      } catch (err) {
        console.error(err)
        alert((err as Error).message)
      }
    })
  }

  const showGenerate = ["draft", "pending_review", "error"].includes(plan.status)
  const showApprove = plan.status === "pending_review"
  const showCopy =
    ["calendar_approved", "copy_done", "briefs_done", "complete"].includes(plan.status)
  const showBriefs = ["copy_done", "briefs_done", "complete"].includes(plan.status)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={plan.status} />
      {canEdit && (
        <>
          {showGenerate && (
            <Button
              size="sm"
              onClick={() => act(() => generateCalendar(plan.id))}
              disabled={pending}
            >
              {plan.status === "draft" ? "Generate calendar" : "Regenerate calendar"}
            </Button>
          )}
          {showApprove && (
            <Button
              size="sm"
              variant="default"
              onClick={() => act(() => approveCalendar(plan.id))}
              disabled={pending}
            >
              Approve calendar
            </Button>
          )}
          {showCopy && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => act(() => generateAllCopy(plan.id))}
              disabled={pending}
            >
              {plan.status === "calendar_approved" ? "Generate all copy" : "Regenerate all copy"}
            </Button>
          )}
          {showBriefs && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => act(() => generateAllBriefs(plan.id))}
              disabled={pending}
            >
              {plan.status === "copy_done" ? "Generate all briefs" : "Regenerate all briefs"}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
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
