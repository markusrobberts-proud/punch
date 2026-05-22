"use client"

import { useState, useTransition } from "react"
import type { CampaignEmail } from "@/lib/campaigns"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { generateCopyForEmail, generateBriefForEmail } from "../actions"

export function EmailRow({
  email,
  canEdit,
  copyUnlocked,
}: {
  email: CampaignEmail
  canEdit: boolean
  copyUnlocked: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [pending, startTransition] = useTransition()

  const copyDone = email.copy_status === "done"
  const briefUnlocked = copyDone
  const briefDone = email.brief_status === "done"

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

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-left flex items-center justify-between gap-4"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>#{email.sequence_number}</span>
              <span>·</span>
              <span>{email.scheduled_date ?? "TBD"}</span>
              <span>·</span>
              <FormatPill format={email.format} />
              <span>·</span>
              <span className="truncate">{email.target_segment ?? "—"}</span>
            </div>
            <div className="text-sm font-medium mt-1 truncate">
              {email.subject_line ?? email.theme ?? "(no subject yet)"}
            </div>
            {email.body_headline && (
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{email.body_headline}</div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StagePill label="Copy" status={email.copy_status} />
            <StagePill label="Brief" status={email.brief_status} />
          </div>
        </button>

        {expanded && (
          <div className="pt-3 border-t border-border/60 space-y-4 text-sm">
            <Field label="Theme" value={email.theme} />
            <Field label="Strategic rationale" value={email.strategic_rationale} />

            {copyDone ? (
              <div className="space-y-2">
                <Field label="Subject" value={email.subject_line} />
                <Field label="Preview" value={email.preview_text} />
                <Field label="Headline" value={email.body_headline} />
                <Field label="Body" value={email.body_copy} multiline />
                <Field label="CTA" value={`${email.cta_text ?? ""}${email.cta_url ? ` — ${email.cta_url}` : ""}`} />
                {email.sms_body && <Field label="SMS body" value={email.sms_body} />}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs italic">Copy not generated yet.</p>
            )}

            {briefDone && (
              <div className="space-y-2 pt-2 border-t border-border/60">
                {email.format === "text" ? (
                  <>
                    <Field label="Sender identity" value={email.sender_identity} />
                    <Field label="Brief" value={email.design_brief} multiline />
                  </>
                ) : email.format === "designed" ? (
                  <>
                    <Field label="Layout" value={email.layout_template} />
                    <Field label="Imagery" value={email.imagery_notes} multiline />
                    <Field label="Colours" value={email.colour_notes} />
                    <Field label="Brief" value={email.design_brief} multiline />
                  </>
                ) : (
                  <Field label="Brief" value={email.design_brief} />
                )}
              </div>
            )}

            {canEdit && (
              <div className="pt-3 border-t border-border/60 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={copyDone ? "outline" : "default"}
                    disabled={!copyUnlocked || pending}
                    onClick={() => act(() => generateCopyForEmail(email.id, feedback || undefined))}
                  >
                    {copyDone ? "Regenerate copy" : "Generate copy"}
                  </Button>
                  <Button
                    size="sm"
                    variant={briefDone ? "outline" : "default"}
                    disabled={!briefUnlocked || pending}
                    onClick={() => act(() => generateBriefForEmail(email.id))}
                  >
                    {briefDone ? "Regenerate brief" : "Generate brief"}
                  </Button>
                </div>
                {copyDone && (
                  <Textarea
                    placeholder="Feedback for the next copy regeneration (optional)..."
                    rows={2}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                )}
                {!copyUnlocked && (
                  <p className="text-xs text-muted-foreground italic">
                    Approve the calendar above to unlock copy generation.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FormatPill({ format }: { format: "text" | "designed" | "sms" }) {
  const cls =
    format === "text"
      ? "bg-amber-100 text-amber-900"
      : format === "sms"
        ? "bg-blue-100 text-blue-900"
        : "bg-neutral-200 text-neutral-900"
  return <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide ${cls}`}>{format}</span>
}

function StagePill({ label, status }: { label: string; status: string }) {
  const variant =
    status === "done"
      ? "success"
      : status === "generating"
        ? "warning"
        : status === "error"
          ? "destructive"
          : "secondary"
  return (
    <Badge variant={variant as "success" | "warning" | "destructive" | "secondary"} className="text-[10px]">
      {label}: {status}
    </Badge>
  )
}

function Field({ label, value, multiline }: { label: string; value: string | null | undefined; multiline?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <p className={`text-sm ${multiline ? "whitespace-pre-wrap" : ""}`}>
        {value || <span className="italic text-muted-foreground">—</span>}
      </p>
    </div>
  )
}
