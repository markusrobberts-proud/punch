"use client"

import { useState, useTransition } from "react"
import { Share2, Copy, Check, Mail, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createApprovalLink, sendApprovalLinkByEmail } from "./share-actions"

type Mode = "send" | "copy"

export function ShareButton({
  planId,
  defaultRecipient,
  defaultRecipientName,
}: {
  planId: string
  defaultRecipient?: string | null
  defaultRecipientName?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("send")
  const [expiry, setExpiry] = useState("14")
  const [recipients, setRecipients] = useState(defaultRecipient ?? "")
  const [recipientName, setRecipientName] = useState(defaultRecipientName ?? "")
  const [message, setMessage] = useState("")
  const [pending, startTransition] = useTransition()
  const [url, setUrl] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function reset() {
    setUrl(null)
    setSentTo(null)
    setError(null)
    setWarning(null)
    setCopied(false)
    // Don't reset recipients/message/mode — if the user reopens the dialog
    // they probably want to send to the same person.
  }

  function onCopyOnly() {
    setError(null)
    setWarning(null)
    const fd = new FormData()
    fd.set("planId", planId)
    fd.set("expiresInDays", expiry)
    startTransition(async () => {
      const r = await createApprovalLink(fd)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setUrl(r.url)
    })
  }

  function onSend() {
    setError(null)
    setWarning(null)
    if (!recipients.trim()) {
      setError("Add at least one recipient.")
      return
    }
    const fd = new FormData()
    fd.set("planId", planId)
    fd.set("expiresInDays", expiry)
    fd.set("recipients", recipients)
    if (recipientName.trim()) fd.set("recipientName", recipientName.trim())
    if (message.trim()) fd.set("message", message.trim())
    startTransition(async () => {
      const r = await sendApprovalLinkByEmail(fd)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setUrl(r.url)
      setSentTo(r.sentTo)
      if (r.emailWarning) setWarning(r.emailWarning)
    })
  }

  function copyToClipboard() {
    if (!url) return
    navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const done = url !== null

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Share2 /> Share with client
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share calendar for approval</DialogTitle>
          <DialogDescription>
            Send the client a tokenised review link. They can approve, request changes, or comment per email.
          </DialogDescription>
        </DialogHeader>

        {!done && (
          <div className="space-y-4">
            {/* Mode tabs. Sending is the default; the copy-link path stays
                visible for cases where the strategist already has an
                email thread open. */}
            <div className="inline-flex p-0.5 rounded-lg bg-[#F5F5F7] text-[12px]">
              <ModeTab active={mode === "send"} onClick={() => setMode("send")} icon={<Mail className="size-3.5" />}>
                Send via PUNCH
              </ModeTab>
              <ModeTab active={mode === "copy"} onClick={() => setMode("copy")} icon={<Link2 className="size-3.5" />}>
                Just copy a link
              </ModeTab>
            </div>

            {mode === "send" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="recipients">Send to</Label>
                  <Input
                    id="recipients"
                    type="text"
                    placeholder="kate@brand.com, sam@brand.com"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-[#86868B]">Up to 10 emails, comma or space separated.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="recipientName">Their first name (optional)</Label>
                  <Input
                    id="recipientName"
                    type="text"
                    placeholder="Kate"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="message">Personal note (optional)</Label>
                  <Textarea
                    id="message"
                    rows={3}
                    placeholder="Anything you'd like to say before they review."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="expiry">Link expires</Label>
              <select
                id="expiry"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-[13px]"
              >
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="0">Never</option>
              </select>
            </div>

            {error && <p className="text-[12px] text-[#D70015]">{error}</p>}
          </div>
        )}

        {done && (
          <div className="space-y-3">
            {sentTo && sentTo.length > 0 && (
              <div className="rounded-lg bg-[#E8F5EC] border border-[#B5E2C4] p-3">
                <div className="flex items-center gap-2 text-[13px] font-medium text-[#166D2F]">
                  <Check className="size-4" /> Sent to {sentTo.join(", ")}
                </div>
                <div className="text-[11.5px] text-[#166D2F] mt-1 opacity-80">
                  Replies route to your inbox. You'll see their actions land here in real time.
                </div>
              </div>
            )}
            {warning && (
              <div className="rounded-lg bg-[#FFF4E5] border border-[#F5C788] p-3 text-[12.5px] text-[#7A4F00] leading-relaxed">
                {warning}
              </div>
            )}
            <div className="text-[12px] text-[#6E6E73]">
              Or share the link directly.
            </div>
            <div className="flex items-center gap-2 p-3 bg-[#F5F5F7] rounded-lg">
              <code className="text-[11.5px] text-[#1D1D1F] flex-1 truncate">{url}</code>
              <Button variant="secondary" size="sm" onClick={copyToClipboard}>
                {copied ? (
                  <>
                    <Check /> Copied
                  </>
                ) : (
                  <>
                    <Copy /> Copy
                  </>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-[#86868B]">
              {expiry === "0" ? "No expiry." : `Expires in ${expiry} days.`}
            </p>
          </div>
        )}

        <DialogFooter>
          {!done ? (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              {mode === "send" ? (
                <Button onClick={onSend} disabled={pending}>
                  {pending ? "Sending..." : "Send"}
                </Button>
              ) : (
                <Button onClick={onCopyOnly} disabled={pending}>
                  {pending ? "Generating..." : "Generate link"}
                </Button>
              )}
            </>
          ) : (
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModeTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
        active ? "bg-white text-[#1D1D1F] card-shadow" : "text-[#6E6E73] hover:text-[#1D1D1F]"
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
