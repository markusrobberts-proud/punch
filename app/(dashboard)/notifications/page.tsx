import Link from "next/link"
import {
  Bell,
  ThumbsUp,
  AlertCircle,
  MessageCircle,
  Sparkles,
  FileText,
  Mail,
  UserPlus,
  Shield,
  Globe,
} from "lucide-react"
import { requireApprovedUser } from "@/lib/auth"
import { listNotifications, type Notification, type NotificationKind } from "@/lib/notifications"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader, PageShell } from "@/components/layout/page-header"
import { MarkAllReadButton } from "./mark-all-read"

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

export default async function NotificationsPage() {
  const user = await requireApprovedUser()
  const items = await listNotifications(user.id, 200)
  const hasUnread = items.some((n) => !n.read_at)

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Everything tagged for you across PUNCH. Older items roll off after a couple of months."
        actions={hasUnread ? <MarkAllReadButton /> : undefined}
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="size-6 mx-auto mb-3 text-[#C7C7CC]" />
            <div className="text-[14px] font-medium">You're all caught up</div>
            <p className="text-[12.5px] text-[#86868B] mt-1">
              Client approvals, briefs ready to work, and other heads-ups land here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {items.map((n, idx) => (
              <NotificationRow
                key={n.id}
                n={n}
                last={idx === items.length - 1}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </PageShell>
  )
}

function NotificationRow({ n, last }: { n: Notification; last: boolean }) {
  const meta = KIND_META[n.kind as NotificationKind] ?? KIND_META.client_comment
  const Icon = meta.icon
  const isUnread = !n.read_at
  const inner = (
    <div
      className={`flex gap-4 px-5 py-4 ${last ? "" : "border-b border-[#F0F0F2]"} ${
        isUnread ? "bg-[#F2F8FF]" : ""
      } hover:bg-[#F9F9FB] transition`}
    >
      <div className={`w-9 h-9 rounded-lg bg-[#F5F5F7] flex items-center justify-center shrink-0 ${meta.tone}`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium leading-snug">{n.title}</div>
        {n.body && (
          <div className="text-[12.5px] text-[#6E6E73] leading-snug mt-1">{n.body}</div>
        )}
        <div className="text-[11.5px] text-[#86868B] mt-1.5">
          {new Date(n.created_at).toLocaleString("en-AU", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })}
        </div>
      </div>
      {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] mt-2 shrink-0" />}
    </div>
  )

  return n.link ? (
    <Link href={n.link} className="block">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  )
}
