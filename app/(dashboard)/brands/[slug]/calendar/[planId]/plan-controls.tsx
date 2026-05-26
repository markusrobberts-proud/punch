"use client"

import { useState, useTransition } from "react"
import { Sparkles, Check, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  generateCalendar,
  approveCalendar,
  generateAllCopy,
  generateAllBriefs,
  deletePlan,
} from "../actions"
import type { CampaignPlan } from "@/lib/campaigns"
import { ShareButton } from "./share-button"

type PlanControlsProps = {
  plan: CampaignPlan
  brandSlug: string
  canEdit: boolean
  canDelete: boolean
  /** Pre-fills the share dialog so strategists don't retype Kate's email every month. */
  brandContactEmail?: string | null
  brandContactName?: string | null
}

export function PlanControls({
  plan,
  brandSlug,
  canEdit,
  canDelete,
  brandContactEmail,
  brandContactName,
}: PlanControlsProps) {
  const [pending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function act(fn: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        const result = await fn()
        // Honour { ok: false, error } from server actions that opted into the
        // result-shape pattern (generateCalendar, deletePlan).
        if (result && typeof result === "object" && "ok" in result && (result as { ok: boolean }).ok === false) {
          const err = (result as { error?: string }).error ?? "Action failed"
          alert(err)
        }
      } catch (err) {
        console.error(err)
        alert((err as Error).message || "Action failed")
      }
    })
  }

  const showGenerate = ["draft", "pending_review", "error"].includes(plan.status)
  const showApprove = plan.status === "pending_review"
  const showCopy =
    ["calendar_approved", "copy_done", "briefs_done", "complete"].includes(plan.status)
  const showBriefs = ["copy_done", "briefs_done", "complete"].includes(plan.status)
  const shareable =
    ["calendar_approved", "copy_done", "briefs_done", "complete"].includes(plan.status)

  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <StatusBadge status={plan.status} />
      {canEdit && (
        <>
          {showGenerate && (
            <Button
              size="sm"
              variant="accent"
              onClick={() => act(() => generateCalendar(plan.id))}
              disabled={pending}
            >
              <Sparkles />
              {plan.status === "draft" ? "Generate calendar" : "Regenerate"}
            </Button>
          )}
          {showApprove && (
            <Button size="sm" onClick={() => act(() => approveCalendar(plan.id))} disabled={pending}>
              <Check /> Approve calendar
            </Button>
          )}
          {showCopy && (
            <Button size="sm" variant="secondary" onClick={() => act(() => generateAllCopy(plan.id))} disabled={pending}>
              <Sparkles /> {plan.status === "calendar_approved" ? "Generate all copy" : "Regenerate all copy"}
            </Button>
          )}
          {showBriefs && (
            <Button size="sm" variant="secondary" onClick={() => act(() => generateAllBriefs(plan.id))} disabled={pending}>
              <Sparkles /> {plan.status === "copy_done" ? "Generate all briefs" : "Regenerate all briefs"}
            </Button>
          )}
          {shareable && (
            <ShareButton
              planId={plan.id}
              defaultRecipient={brandContactEmail ?? null}
              defaultRecipientName={brandContactName ?? null}
            />
          )}
        </>
      )}
      {canDelete && (
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDeleteConfirm("")
              setDeleteError(null)
              setDeleteOpen(true)
            }}
          >
            <Trash2 /> Delete
          </Button>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this campaign?</DialogTitle>
                <DialogDescription>
                  Removes the plan, all of its emails, briefs, and approval activity. This can't be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="confirm-name">Type the campaign name to confirm</Label>
                <Input
                  id="confirm-name"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={plan.name}
                  autoComplete="off"
                />
                <p className="text-[12px] text-[#86868B]">{plan.name}</p>
                {deleteError && <p className="text-[12px] text-[#D70015]">{deleteError}</p>}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={pending || deleteConfirm.trim().length === 0}
                  onClick={() =>
                    startTransition(async () => {
                      setDeleteError(null)
                      const fd = new FormData()
                      fd.set("planId", plan.id)
                      fd.set("brandSlug", brandSlug)
                      fd.set("confirm", deleteConfirm)
                      // Server-side redirect when delete succeeds, so we
                      // never refresh the current (deleted) URL ourselves.
                      fd.set("redirectTo", `/brands/${brandSlug}/calendar`)
                      try {
                        const res = await deletePlan(fd)
                        // We only get here when the action returned a
                        // failure result (success path redirects).
                        if (!res.ok) setDeleteError(res.error)
                      } catch (err) {
                        // Re-throw NEXT_REDIRECT so Next handles navigation;
                        // anything else we surface in the modal.
                        if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
                          throw err
                        }
                        setDeleteError((err as Error).message || "Delete failed")
                      }
                    })
                  }
                >
                  {pending ? "Deleting..." : "Delete campaign"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "neutral" | "warning" | "success" | "destructive"; label: string }> = {
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
  const m = map[status] ?? { variant: "neutral" as const, label: status }
  return <Badge variant={m.variant}>{m.label}</Badge>
}
