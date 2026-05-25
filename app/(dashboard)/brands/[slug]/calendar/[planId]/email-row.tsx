"use client"

import { useState, useTransition } from "react"
import { ChevronDown, Mail, MessageSquare, Pencil, Sparkles, ExternalLink } from "lucide-react"
import type { CampaignEmail } from "@/lib/campaigns"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { generateCopyForEmail, generateBriefForEmail } from "../actions"
import { exportEmailToAsana } from "../asana-actions"
import { saveEmailCopy, saveEmailBrief } from "../edit-actions"

type Mode = "view" | "edit-copy" | "edit-brief"

export function EmailRow({
  email,
  canEdit,
  copyUnlocked,
  clientAction,
}: {
  email: CampaignEmail
  canEdit: boolean
  copyUnlocked: boolean
  clientAction: { action: string; comment: string | null; acted_at: string } | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<Mode>("view")
  const [feedback, setFeedback] = useState("")
  const [pending, startTransition] = useTransition()

  const copyDone = email.copy_status === "done"
  const briefDone = email.brief_status === "done"
  const briefUnlocked = copyDone

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
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "w-full flex items-center gap-4 px-5 py-4 text-left transition hover:bg-white/60",
            expanded && "bg-white/40",
          )}
        >
          <div className="w-9 h-9 rounded-lg bg-[#F5F5F7] flex items-center justify-center shrink-0">
            {email.format === "sms" ? (
              <MessageSquare className="size-4 text-[#6E6E73]" />
            ) : (
              <Mail className="size-4 text-[#6E6E73]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-[14px] truncate">
                {email.subject_line ?? email.theme ?? "(no subject yet)"}
              </span>
              <FormatPill format={email.format} />
              <StagePill label="Plan" status="done" />
              <StagePill label="Copy" status={email.copy_status} />
              <StagePill label="Brief" status={email.brief_status} />
              {clientAction && <ClientActionBadge action={clientAction.action} />}
            </div>
            <div className="text-[12px] text-[#86868B] mt-0.5 truncate">
              {email.scheduled_date
                ? new Date(email.scheduled_date).toLocaleDateString("en-AU", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })
                : "TBD"}
              {email.target_segment && ` · ${email.target_segment}`}
              {email.theme && email.subject_line && ` · ${email.theme}`}
            </div>
          </div>
          <ChevronDown className={cn("size-4 text-[#C7C7CC] shrink-0 transition", expanded && "rotate-180")} />
        </button>

        {expanded && (
          <div className="px-5 pb-5 pt-1 space-y-4 text-[13px] border-t border-[#E5E5EA] fade-in">
            {email.strategic_rationale && <Section label="Why this email">{email.strategic_rationale}</Section>}

            {/* COPY SECTION */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <SectionTitle>Copy</SectionTitle>
                {canEdit && copyDone && mode !== "edit-copy" && (
                  <Button variant="ghost" size="sm" onClick={() => setMode("edit-copy")}>
                    <Pencil /> Edit
                  </Button>
                )}
              </div>

              {!copyDone && mode !== "edit-copy" && (
                <p className="text-[#86868B] text-[12px] italic">Not generated yet.</p>
              )}

              {copyDone && mode !== "edit-copy" && (
                <div className="space-y-2">
                  <Field label="Subject" value={email.subject_line} />
                  <Field label="Preview" value={email.preview_text} />
                  <Field label="Headline" value={email.body_headline} />
                  <Field label="Body" value={email.body_copy} multiline />
                  <Field
                    label="CTA"
                    value={`${email.cta_text ?? ""}${email.cta_url ? ` · ${email.cta_url}` : ""}`}
                  />
                  {email.sms_body && <Field label="SMS body" value={email.sms_body} />}
                </div>
              )}

              {mode === "edit-copy" && (
                <CopyEditor
                  email={email}
                  pending={pending}
                  onCancel={() => setMode("view")}
                  onSave={(fd) =>
                    act(async () => {
                      await saveEmailCopy(fd)
                      setMode("view")
                    })
                  }
                />
              )}
            </div>

            {/* BRIEF SECTION */}
            {(briefDone || email.format !== "sms") && (
              <div className="pt-2 border-t border-[#E5E5EA]">
                <div className="flex items-center justify-between mb-2">
                  <SectionTitle>Brief</SectionTitle>
                  {canEdit && briefDone && mode !== "edit-brief" && (
                    <Button variant="ghost" size="sm" onClick={() => setMode("edit-brief")}>
                      <Pencil /> Edit
                    </Button>
                  )}
                </div>

                {!briefDone && mode !== "edit-brief" && (
                  <p className="text-[#86868B] text-[12px] italic">Not generated yet.</p>
                )}

                {briefDone && mode !== "edit-brief" && (
                  <div className="space-y-2">
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

                {mode === "edit-brief" && (
                  <BriefEditor
                    email={email}
                    pending={pending}
                    onCancel={() => setMode("view")}
                    onSave={(fd) =>
                      act(async () => {
                        await saveEmailBrief(fd)
                        setMode("view")
                      })
                    }
                  />
                )}
              </div>
            )}

            {/* ASANA LINK */}
            {email.asana_task_url && (
              <a
                href={email.asana_task_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] text-[#007AFF] hover:underline"
              >
                <ExternalLink className="size-3" /> View Asana task
              </a>
            )}

            {/* ACTIONS */}
            {canEdit && mode === "view" && (
              <div className="pt-3 border-t border-[#E5E5EA] space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={copyDone ? "secondary" : "accent"}
                    disabled={!copyUnlocked || pending}
                    onClick={() => act(() => generateCopyForEmail(email.id, feedback || undefined))}
                  >
                    <Sparkles /> {copyDone ? "Regenerate copy" : "Generate copy"}
                  </Button>
                  <Button
                    size="sm"
                    variant={briefDone ? "secondary" : "accent"}
                    disabled={!briefUnlocked || pending}
                    onClick={() => act(() => generateBriefForEmail(email.id))}
                  >
                    <Sparkles /> {briefDone ? "Regenerate brief" : "Generate brief"}
                  </Button>
                  {briefDone && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => act(() => exportEmailToAsana(email.id))}
                    >
                      {email.asana_task_url ? "Re-export to Asana" : "Export to Asana"}
                    </Button>
                  )}
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
                  <p className="text-[11.5px] text-[#86868B] italic">
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

function CopyEditor({
  email,
  pending,
  onSave,
  onCancel,
}: {
  email: CampaignEmail
  pending: boolean
  onSave: (fd: FormData) => void
  onCancel: () => void
}) {
  return (
    <form
      action={(fd) => {
        fd.set("emailId", email.id)
        onSave(fd)
      }}
      className="space-y-3"
    >
      <EditField label="Subject" name="subject_line" defaultValue={email.subject_line ?? ""} />
      <EditField label="Preview" name="preview_text" defaultValue={email.preview_text ?? ""} />
      <EditField label="Headline" name="body_headline" defaultValue={email.body_headline ?? ""} />
      <EditField label="Body" name="body_copy" defaultValue={email.body_copy ?? ""} multiline rows={10} />
      <div className="grid grid-cols-2 gap-3">
        <EditField label="CTA text" name="cta_text" defaultValue={email.cta_text ?? ""} />
        <EditField label="CTA URL" name="cta_url" defaultValue={email.cta_url ?? ""} />
      </div>
      {email.format === "sms" && (
        <EditField label="SMS body" name="sms_body" defaultValue={email.sms_body ?? ""} multiline rows={3} />
      )}
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </form>
  )
}

function BriefEditor({
  email,
  pending,
  onSave,
  onCancel,
}: {
  email: CampaignEmail
  pending: boolean
  onSave: (fd: FormData) => void
  onCancel: () => void
}) {
  return (
    <form
      action={(fd) => {
        fd.set("emailId", email.id)
        onSave(fd)
      }}
      className="space-y-3"
    >
      {email.format === "designed" && (
        <>
          <EditField label="Layout" name="layout_template" defaultValue={email.layout_template ?? ""} />
          <EditField label="Imagery" name="imagery_notes" defaultValue={email.imagery_notes ?? ""} multiline rows={4} />
          <EditField label="Colours" name="colour_notes" defaultValue={email.colour_notes ?? ""} />
        </>
      )}
      {email.format === "text" && (
        <EditField label="Sender identity" name="sender_identity" defaultValue={email.sender_identity ?? ""} />
      )}
      <EditField label="Brief" name="design_brief" defaultValue={email.design_brief ?? ""} multiline rows={8} />
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </form>
  )
}

function EditField({
  label,
  name,
  defaultValue,
  multiline,
  rows = 3,
}: {
  label: string
  name: string
  defaultValue: string
  multiline?: boolean
  rows?: number
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-[11px] uppercase tracking-wider text-[#86868B]">{label}</Label>
      {multiline ? (
        <Textarea id={name} name={name} defaultValue={defaultValue} rows={rows} />
      ) : (
        <Input id={name} name={name} defaultValue={defaultValue} />
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">{children}</div>
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionTitle>{label}</SectionTitle>
      <p className="text-[13.5px] whitespace-pre-wrap leading-relaxed mt-1.5">{children}</p>
    </div>
  )
}

function FormatPill({ format }: { format: "text" | "designed" | "sms" }) {
  if (format === "sms") return <Badge variant="info">SMS</Badge>
  if (format === "text") return <Badge variant="neutral">Text</Badge>
  return <Badge variant="accent">Designed</Badge>
}

function StagePill({ label, status }: { label: string; status: string }) {
  const variant =
    status === "done"
      ? "success"
      : status === "generating"
        ? "warning"
        : status === "error"
          ? "destructive"
          : "neutral"
  return (
    <Badge variant={variant as "success" | "warning" | "destructive" | "neutral"}>
      {label}
    </Badge>
  )
}

function ClientActionBadge({ action }: { action: string }) {
  if (action === "approve") return <Badge variant="success">Client approved</Badge>
  if (action === "request_changes") return <Badge variant="warning">Changes requested</Badge>
  return <Badge variant="info">Client commented</Badge>
}

function Field({ label, value, multiline }: { label: string; value: string | null | undefined; multiline?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-[#86868B]">{label}</div>
      <p className={cn("text-[13.5px] mt-0.5 leading-relaxed", multiline && "whitespace-pre-wrap")}>
        {value || <span className="italic text-[#86868B]">–</span>}
      </p>
    </div>
  )
}
