"use client"

import { useState, useTransition } from "react"
import {
  Mail,
  MessageSquare,
  ChevronDown,
  ThumbsUp,
  AlertCircle,
  MessageCircle,
  Check,
} from "lucide-react"
import type { CampaignEmail } from "@/lib/campaigns"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { recordClientApprovalAction } from "./client-approval-actions"

type Mode = "view" | "changes" | "comment"

/**
 * One email's worth of client-facing review. Subject, body, brief preview,
 * and three actions: approve, request changes, comment. Hides every
 * internal stage pill / rationale / generation control.
 *
 * The latest server-recorded action becomes a chip on the row + a banner
 * inside so the client always sees what they last said.
 */
export function ClientEmailRow({
  brandSlug,
  planId,
  email,
  latest,
}: {
  brandSlug: string
  planId: string
  email: CampaignEmail
  latest: { action: string; comment: string | null; acted_at: string } | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<Mode>("view")
  const [comment, setComment] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit(action: "approve" | "request_changes" | "comment") {
    setError(null)
    if ((action === "request_changes" || action === "comment") && !comment.trim()) {
      setError(action === "comment" ? "Please add a comment." : "Tell us what to change.")
      return
    }
    startTransition(async () => {
      const fd = new FormData()
      fd.set("brandSlug", brandSlug)
      fd.set("planId", planId)
      fd.set("emailId", email.id)
      fd.set("action", action)
      fd.set("comment", comment)
      const res = await recordClientApprovalAction(fd)
      if (res.ok) {
        setMode("view")
        setComment("")
      } else {
        setError(res.error)
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
                {email.subject_line ?? email.theme ?? "(coming soon)"}
              </span>
              {latest && <ActionBadge action={latest.action} />}
            </div>
            <div className="text-[12px] text-[#86868B] mt-0.5 truncate">
              {email.scheduled_date
                ? new Date(email.scheduled_date).toLocaleDateString("en-AU", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })
                : "TBD"}
              {email.preview_text && ` · ${email.preview_text}`}
            </div>
          </div>
          <ChevronDown className={cn("size-4 text-[#C7C7CC] shrink-0 transition", expanded && "rotate-180")} />
        </button>

        {expanded && (
          <div className="px-5 pb-5 pt-1 space-y-4 text-[13px] border-t border-[#E5E5EA] fade-in">
            {/* Copy */}
            {email.subject_line && (
              <Section label="Subject">
                <p className="text-[14px] font-medium">{email.subject_line}</p>
              </Section>
            )}
            {email.preview_text && (
              <Section label="Preview text">{email.preview_text}</Section>
            )}
            {email.body_headline && (
              <Section label="Headline">
                <p className="text-[15px] font-medium leading-snug">{email.body_headline}</p>
              </Section>
            )}
            {email.body_copy && (
              <Section label="Body">
                <p className="text-[13.5px] whitespace-pre-wrap leading-relaxed">{email.body_copy}</p>
              </Section>
            )}
            {(email.cta_text || email.cta_url) && (
              <Section label="Call to action">
                <p className="text-[13.5px]">
                  {email.cta_text}
                  {email.cta_url && <span className="text-[#86868B]"> · {email.cta_url}</span>}
                </p>
              </Section>
            )}
            {email.sms_body && (
              <Section label="SMS body">{email.sms_body}</Section>
            )}

            {/* Brief preview (for designed emails) */}
            {email.format === "designed" && (email.layout_template || email.imagery_notes || email.design_brief) && (
              <div className="pt-3 border-t border-[#E5E5EA] space-y-3">
                <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                  Design direction
                </div>
                {email.layout_template && <Section label="Layout">{email.layout_template}</Section>}
                {email.imagery_notes && <Section label="Imagery">{email.imagery_notes}</Section>}
                {email.colour_notes && <Section label="Colours">{email.colour_notes}</Section>}
              </div>
            )}

            {/* Last action banner */}
            {latest && (
              <div
                className={cn(
                  "rounded-lg px-4 py-3 text-[12.5px]",
                  latest.action === "approve" && "bg-[#E8F8EC] text-[#0A4A1E]",
                  latest.action === "request_changes" && "bg-[#FFF1E0] text-[#7A3D00]",
                  latest.action === "comment" && "bg-[#E8F0FF] text-[#0A3D7A]",
                )}
              >
                <div className="font-medium">
                  You {latest.action === "request_changes" ? "requested changes" : latest.action === "approve" ? "approved this" : "commented"}
                </div>
                {latest.comment && <p className="mt-1 leading-relaxed">"{latest.comment}"</p>}
                <p className="text-[11px] opacity-70 mt-1">
                  {new Date(latest.acted_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            )}

            {/* Action UI */}
            <div className="pt-3 border-t border-[#E5E5EA]">
              {mode === "view" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" onClick={() => submit("approve")} disabled={pending}>
                    <ThumbsUp /> {latest?.action === "approve" ? "Approved" : "Approve"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setMode("changes")} disabled={pending}>
                    <AlertCircle /> Request changes
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setMode("comment")} disabled={pending}>
                    <MessageCircle /> Comment
                  </Button>
                </div>
              )}

              {(mode === "changes" || mode === "comment") && (
                <div className="space-y-2">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    placeholder={
                      mode === "changes"
                        ? "What needs to change? Be as specific as you can."
                        : "Anything you want the team to know."
                    }
                    autoFocus
                  />
                  {error && <p className="text-[12px] text-[#D70015]">{error}</p>}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => submit(mode === "changes" ? "request_changes" : "comment")}
                      disabled={pending}
                    >
                      <Check /> {pending ? "Sending..." : mode === "changes" ? "Send change request" : "Send comment"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setMode("view")
                        setComment("")
                        setError(null)
                      }}
                      disabled={pending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[13.5px] leading-relaxed">{children}</div>
    </div>
  )
}

function ActionBadge({ action }: { action: string }) {
  if (action === "approve") return <Badge variant="success">Approved</Badge>
  if (action === "request_changes") return <Badge variant="warning">Changes requested</Badge>
  return <Badge variant="info">Commented</Badge>
}
