"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Bell,
  Check,
  CheckCheck,
  ThumbsUp,
  MessageCircle,
  AlertCircle,
  FileText,
  Mail,
  UserPlus,
  Globe,
  Sparkles,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Notification, NotificationKind } from "@/lib/notifications"
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./notifications-actions"

const KIND_META: Record<NotificationKind, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  client_approve: { icon: ThumbsUp, tone: "text-[#30A14E]" },
  client_request_changes: { icon: AlertCircle, tone: "text-[#D97706]" },
  client_comment: { icon: MessageCircle, tone: "text-[#007AFF]" },
  plan_approved: { icon: Sparkles, tone: "text-[#007AFF]" },
  briefs_ready: { icon: FileText, tone: "text-[#8B5A2B]" },
  knowledge_pending: { icon: FileText, tone: "text-[#D97706]" },
  inbound_email: { icon: Mail, tone: "text-[#007AFF]" },
  user_pending: { icon: UserPlus, tone: "text-[#D97706]" },
  role_changed: { icon: Shield, tone: "text-[#007AFF]" },
  scrape_complete: { icon: Globe, tone: "text-[#30A14E]" },
}

/**
 * Sidebar bell. Polls the server every 30s for fresh notifications +
 * unread count and renders a dropdown panel listing the recent items.
 * Clicking an item marks it read and navigates to the entity.
 *
 * The component owns its own polling rather than relying on
 * router.refresh so the rest of the page doesn't re-render every 30s.
 */
export function NotificationBell({
  initial,
  initialUnread,
}: {
  initial: Notification[]
  initialUnread: number
}) {
  const router = useRouter()
  const [items, setItems] = useState<Notification[]>(initial)
  const [unread, setUnread] = useState<number>(initialUnread)
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  // Poll every 30s while visible; pause on hidden tab.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function tick() {
      if (document.hidden) {
        if (!cancelled) timer = setTimeout(tick, 4000)
        return
      }
      try {
        const next = await fetchNotifications()
        if (!cancelled) {
          setItems(next.items)
          setUnread(next.unread)
        }
      } catch {
        // Soft-fail.
      }
      if (!cancelled) timer = setTimeout(tick, 30000)
    }

    timer = setTimeout(tick, 30000)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  function handleItemClick(n: Notification, e: React.MouseEvent) {
    // Optimistic mark-read; navigation happens via Link or the explicit
    // router.push below.
    if (!n.read_at) {
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, read_at: new Date().toISOString() } : it)))
      setUnread((c) => Math.max(0, c - 1))
      startTransition(() => {
        markNotificationRead(n.id).catch(() => {})
      })
    }
    if (n.link) {
      e.preventDefault()
      setOpen(false)
      router.push(n.link)
    }
  }

  function handleMarkAll() {
    if (unread === 0) return
    const now = new Date().toISOString()
    setItems((prev) => prev.map((it) => (it.read_at ? it : { ...it, read_at: now })))
    setUnread(0)
    startTransition(() => {
      markAllNotificationsRead().catch(() => {})
    })
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/60 transition"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
      >
        <Bell className="size-4 text-[#1D1D1F]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#D70015] text-white text-[9px] font-semibold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          // Bell lives in the left-hand sidebar, so anchoring the panel to
          // the bell's left edge opens it into the content area instead of
          // off-screen to the left.
          className="absolute left-0 top-[calc(100%+6px)] w-[340px] max-h-[70vh] overflow-hidden bg-white rounded-xl card-shadow-hover border border-[#E5E5EA] z-50 flex flex-col fade-in"
        >
          <div className="px-4 py-3 flex items-center justify-between border-b border-[#E5E5EA]">
            <div className="text-[13px] font-semibold">Notifications</div>
            <button
              type="button"
              onClick={handleMarkAll}
              className={cn(
                "inline-flex items-center gap-1 text-[11.5px]",
                unread > 0
                  ? "text-[#007AFF] hover:underline cursor-pointer"
                  : "text-[#C7C7CC] cursor-default",
              )}
              disabled={unread === 0}
            >
              <CheckCheck className="size-3" /> Mark all read
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-[12.5px] text-[#86868B]">
                <Bell className="size-5 mx-auto mb-2 text-[#C7C7CC]" />
                You're all caught up.
              </div>
            ) : (
              items.map((n) => {
                const meta = KIND_META[n.kind as NotificationKind] ?? KIND_META.client_comment
                const Icon = meta.icon
                const isUnread = !n.read_at
                const inner = (
                  <div
                    className={cn(
                      "flex gap-3 px-4 py-3 border-b border-[#F0F0F2] last:border-0 hover:bg-[#F9F9FB] transition cursor-pointer",
                      isUnread && "bg-[#F2F8FF]",
                    )}
                  >
                    <div className={cn("w-7 h-7 rounded-md bg-[#F5F5F7] flex items-center justify-center shrink-0", meta.tone)}>
                      <Icon className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-medium leading-snug truncate">
                        {n.title}
                      </div>
                      {n.body && (
                        <div className="text-[11.5px] text-[#6E6E73] leading-snug mt-0.5 line-clamp-2">
                          {n.body}
                        </div>
                      )}
                      <div className="text-[10.5px] text-[#86868B] mt-1">
                        {relativeShort(n.created_at)}
                      </div>
                    </div>
                    {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] mt-1.5 shrink-0" />}
                  </div>
                )
                return n.link ? (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={(e) => handleItemClick(n, e)}
                    className="block"
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    type="button"
                    onClick={(e) => handleItemClick(n, e)}
                    className="block w-full text-left"
                  >
                    {inner}
                  </button>
                )
              })
            )}
          </div>

          <div className="px-4 py-2 border-t border-[#E5E5EA] flex items-center justify-between text-[11.5px]">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-[#007AFF] hover:underline inline-flex items-center gap-1"
            >
              See all
            </Link>
            <span className="text-[#86868B] inline-flex items-center gap-1">
              <Check className="size-3" /> Updates every 30s
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function relativeShort(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" })
}
