import Link from "next/link"
import {
  Sparkles,
  Plus,
  Users,
  ListChecks,
  Compass,
  BookOpen,
  Calendar,
  MessageCircle,
  Mail,
  MessageSquare,
  ArrowRight,
  Inbox,
  Pencil,
} from "lucide-react"
import { requireApprovedUser, type AppUser } from "@/lib/auth"
import { listAccessibleBrands, type Brand } from "@/lib/brands"
import { loadDashboardData, relativeTime, describeAuditAction, type DashboardData } from "@/lib/dashboard"
import { canEditStrategy, canManageUsers } from "@/lib/rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BrandIcon } from "@/components/ui/brand-icon"
import { PageShell } from "@/components/layout/page-header"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function timeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export default async function HomePage() {
  const user = await requireApprovedUser()
  const [brands, data] = await Promise.all([listAccessibleBrands(), loadDashboardData()])
  const brandMap = new Map(brands.map((b) => [b.id, b]))

  // Resolve user display names referenced in the recent audit feed.
  const userIds = Array.from(new Set(data.recentAudit.map((a) => a.user_id).filter(Boolean))) as string[]
  let userMap = new Map<string, { display_name: string | null; email: string }>()
  if (userIds.length > 0) {
    const supabase = await createSupabaseServerClient()
    const { data: users } = await supabase.from("users").select("id,display_name,email").in("id", userIds)
    userMap = new Map(
      (users ?? []).map((u: { id: string; display_name: string | null; email: string }) => [
        u.id,
        { display_name: u.display_name, email: u.email },
      ]),
    )
  }

  const aiKeyConfigured = !!(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY)
  const greeting = `${timeOfDay()}, ${user.displayName?.split(" ")[0] ?? user.email.split("@")[0]}`

  return (
    <PageShell>
      <div className="mb-6 md:mb-8">
        <div className="text-[11px] uppercase tracking-wider text-[#86868B] mb-1">{greeting}</div>
        <h1 className="text-[26px] sm:text-[30px] md:text-[34px] font-semibold tracking-display leading-tight">
          {roleTitle(user.role)}
        </h1>
        <p className="text-[14px] md:text-[15px] text-[#6E6E73] mt-2 max-w-xl leading-relaxed">{roleSubtitle(user.role)}</p>
      </div>

      {roleDashboard({ user, data, brands, brandMap, userMap, aiKeyConfigured })}
    </PageShell>
  )
}

function roleTitle(role: AppUser["role"]): string {
  switch (role) {
    case "super_admin":
    case "admin":
      return "Command centre"
    case "strategist":
      return "Your strategy pipeline"
    case "designer":
      return "Your design queue"
    case "client":
      return "Your campaigns"
    default:
      return "Welcome"
  }
}

function roleSubtitle(role: AppUser["role"]): string {
  switch (role) {
    case "super_admin":
    case "admin":
      return "Activity, pending reviews, team and system status across every brand."
    case "strategist":
      return "Plans you're driving, knowledge items to review, and recent client feedback."
    case "designer":
      return "Briefs ready for design, recent Asana exports, and what's coming next."
    case "client":
      return "What's ready for you to review, what's coming up next, and a way back to each brand."
    default:
      return ""
  }
}

function roleDashboard({
  user,
  data,
  brands,
  brandMap,
  userMap,
  aiKeyConfigured,
}: {
  user: AppUser
  data: DashboardData
  brands: Brand[]
  brandMap: Map<string, Brand>
  userMap: Map<string, { display_name: string | null; email: string }>
  aiKeyConfigured: boolean
}) {
  if (user.role === "admin" || user.role === "super_admin") {
    return <AdminDashboard user={user} data={data} brands={brands} brandMap={brandMap} userMap={userMap} aiKeyConfigured={aiKeyConfigured} />
  }
  if (user.role === "strategist") {
    return <StrategistDashboard data={data} brandMap={brandMap} aiKeyConfigured={aiKeyConfigured} />
  }
  if (user.role === "designer") {
    return <DesignerDashboard data={data} brandMap={brandMap} />
  }
  // Catches "client" (renamed from "viewer"). Pending users never reach
  // this page; they're bounced to /awaiting-approval.
  return <ClientDashboard data={data} brands={brands} brandMap={brandMap} />
}

/* -------------------- ADMIN -------------------- */

function AdminDashboard({
  data,
  brands,
  brandMap,
  userMap,
  aiKeyConfigured,
}: {
  user: AppUser
  data: DashboardData
  brands: Brand[]
  brandMap: Map<string, Brand>
  userMap: Map<string, { display_name: string | null; email: string }>
  aiKeyConfigured: boolean
}) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 md:mb-10">
        <Stat label="Brands" value={brands.length} />
        <Stat label="Plans in flight" value={data.counts.activePlans} />
        <Stat label="Pending review" value={data.counts.pendingKnowledge} tone={data.counts.pendingKnowledge > 0 ? "#8B5A00" : undefined} />
        <Stat label="Team" value={data.counts.teamSize} sub={data.counts.pendingTeam > 0 ? `${data.counts.pendingTeam} pending` : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Activity" right={<Link href="/settings/audit" className="text-[12px] text-[#007AFF] hover:underline">Full log →</Link>}>
            {data.recentAudit.length === 0 ? (
              <EmptyCard message="No activity yet. Create a brand or generate a calendar." />
            ) : (
              <Card>
                <CardContent className="p-0">
                  {data.recentAudit.map((entry, idx) => {
                    const actor = entry.user_id ? userMap.get(entry.user_id) : null
                    const brand = entry.brand_id ? brandMap.get(entry.brand_id) : null
                    return (
                      <div
                        key={entry.id}
                        className={`px-5 py-3 text-[13px] flex items-start justify-between gap-4 ${
                          idx === data.recentAudit.length - 1 ? "" : "border-b border-[#E5E5EA]"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{actor?.display_name || actor?.email || "system"}</span>
                            <span className="text-[#6E6E73]">{describeAuditAction(entry)}</span>
                            {brand && (
                              <Link href={`/brands/${brand.slug}`} className="text-[#1D1D1F] hover:underline">{brand.name}</Link>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] text-[#86868B] shrink-0">{relativeTime(entry.created_at)}</span>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </Section>

          <Section title="Plans needing attention" right={<Link href="/brands" className="text-[12px] text-[#007AFF] hover:underline">All brands →</Link>}>
            <PlansList plans={data.activePlans.slice(0, 5)} brandMap={brandMap} />
          </Section>

          {data.recentClientFeedback.length > 0 && (
            <Section title="Recent client feedback">
              <ClientFeedbackList items={data.recentClientFeedback.slice(0, 5)} brandMap={brandMap} />
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="System">
            <Card>
              <CardContent className="p-0">
                <SystemRow label="AI key" ok={aiKeyConfigured} okText="Connected" badText="Not set" />
                <SystemRow label="Email inbound" ok={!!process.env.RESEND_API_KEY} okText="Resend ready" badText="Phase 2B" />
                <SystemRow label="Asana export" ok={!!process.env.ASANA_PERSONAL_ACCESS_TOKEN} okText="Configured" badText="Not set" last />
              </CardContent>
            </Card>
          </Section>

          <Section title="Quick actions">
            <div className="space-y-2">
              <QuickAction href="/brands/new" icon={<Plus className="size-4 text-white" />} iconBg="#1D1D1F" title="Add brand" description="Spin up a new workspace" />
              <QuickAction href="/settings/team" icon={<Users className="size-4 text-[#6E6E73]" />} title="Manage team" description={`${data.counts.teamSize} members · ${data.counts.pendingTeam} pending`} />
              <QuickAction href="/knowledge?status=pending_review" icon={<ListChecks className="size-4 text-[#6E6E73]" />} title="Review queue" description={`${data.counts.pendingKnowledge} items pending`} highlight={data.counts.pendingKnowledge > 0} />
              <QuickAction href="/strategy" icon={<Compass className="size-4 text-[#6E6E73]" />} title="Proud Strategy" description={data.strategyUpdatedAt ? `Updated ${relativeTime(data.strategyUpdatedAt)}` : "Empty"} />
            </div>
          </Section>
        </div>
      </div>
    </>
  )
}

/* -------------------- STRATEGIST -------------------- */

function StrategistDashboard({
  data,
  brandMap,
  aiKeyConfigured,
}: {
  data: DashboardData
  brandMap: Map<string, Brand>
  aiKeyConfigured: boolean
}) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 md:mb-10">
        <Stat label="Plans in flight" value={data.counts.activePlans} />
        <Stat label="Pending review" value={data.counts.pendingKnowledge} tone={data.counts.pendingKnowledge > 0 ? "#8B5A00" : undefined} />
        <Stat label="Completed this month" value={data.counts.completeThisMonth} tone="#166D2F" />
        <Stat label="Recent client notes" value={data.recentClientFeedback.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Plans to drive" right={<Link href="/brands" className="text-[12px] text-[#007AFF] hover:underline">All brands →</Link>}>
            <PlansList plans={data.activePlans.slice(0, 6)} brandMap={brandMap} />
          </Section>

          {data.recentClientFeedback.length > 0 && (
            <Section title="What clients are saying">
              <ClientFeedbackList items={data.recentClientFeedback.slice(0, 5)} brandMap={brandMap} />
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Review queue" right={<Link href="/knowledge?status=pending_review" className="text-[12px] text-[#007AFF] hover:underline">All →</Link>}>
            {data.pendingKnowledge.length === 0 ? (
              <Card>
                <CardContent className="py-5 text-[13px] text-[#6E6E73]">
                  Clean slate. No items waiting for approval.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  {data.pendingKnowledge.slice(0, 5).map((k, idx) => {
                    const brand = brandMap.get(k.brand_id)
                    return (
                      <Link
                        key={k.id}
                        href={brand ? `/brands/${brand.slug}/knowledge?status=pending_review` : "/knowledge?status=pending_review"}
                        className={`block px-4 py-3 text-[13px] hover:bg-white/60 transition ${
                          idx === Math.min(data.pendingKnowledge.length, 5) - 1 ? "" : "border-b border-[#E5E5EA]"
                        }`}
                      >
                        <div className="font-medium truncate">{k.title}</div>
                        <div className="text-[11.5px] text-[#86868B] mt-0.5">
                          {brand?.name ?? "Unknown brand"} · {k.source_type.replace(/_/g, " ")}
                        </div>
                      </Link>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </Section>

          <Section title="Quick actions">
            <div className="space-y-2">
              <QuickAction
                href="/brands"
                icon={<Sparkles className="size-4 text-white" />}
                iconBg="#007AFF"
                title="Plan next month"
                description="Pick a brand, draft a calendar"
                highlight
              />
              <QuickAction
                href="/strategy"
                icon={<Compass className="size-4 text-[#6E6E73]" />}
                title="Proud Strategy"
                description={data.strategyUpdatedAt ? `Updated ${relativeTime(data.strategyUpdatedAt)}` : "Empty"}
              />
              <QuickAction
                href="/knowledge"
                icon={<BookOpen className="size-4 text-[#6E6E73]" />}
                title="Knowledge Bank"
                description="Browse everything Claude reads"
              />
            </div>
          </Section>

          {!aiKeyConfigured && (
            <Card variant="glass-tinted-blue">
              <CardHeader>
                <CardTitle>AI key not set</CardTitle>
                <CardDescription>Add ANTHROPIC_API_KEY to unlock generation.</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

/* -------------------- DESIGNER -------------------- */

function DesignerDashboard({
  data,
  brandMap,
}: {
  data: DashboardData
  brandMap: Map<string, Brand>
}) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 md:mb-10">
        <Stat label="Briefs ready for design" value={data.counts.designQueue} tone={data.counts.designQueue > 0 ? "#8B5A00" : undefined} />
        <Stat label="Active plans" value={data.counts.activePlans} />
        <Stat label="Completed this month" value={data.counts.completeThisMonth} tone="#166D2F" />
        <Stat label="Brands" value={brandMap.size} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Briefs ready for design" right={<Link href="/brands" className="text-[12px] text-[#007AFF] hover:underline">Browse calendars →</Link>}>
            {data.designQueue.length === 0 ? (
              <EmptyCard message="No briefs waiting on design. You're clear." />
            ) : (
              <Card>
                <CardContent className="p-0">
                  {data.designQueue.slice(0, 8).map((e, idx) => {
                    const brand = brandMap.get(e.brand_id)
                    return (
                      <Link
                        key={e.id}
                        href={brand ? `/brands/${brand.slug}/calendar/${e.plan_id}` : "/brands"}
                        className={`flex items-center gap-3 px-5 py-3.5 hover:bg-white/60 transition ${
                          idx === Math.min(data.designQueue.length, 8) - 1 ? "" : "border-b border-[#E5E5EA]"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#F5F5F7] flex items-center justify-center shrink-0">
                          {e.format === "sms" ? (
                            <MessageSquare className="size-4 text-[#6E6E73]" />
                          ) : (
                            <Mail className="size-4 text-[#6E6E73]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-medium truncate">
                            {e.subject_line ?? e.theme ?? "(no subject)"}
                          </div>
                          <div className="text-[11.5px] text-[#86868B] mt-0.5 flex items-center gap-2 flex-wrap">
                            {brand && <span>{brand.name}</span>}
                            <span>·</span>
                            <FormatBadge format={e.format} />
                            {e.scheduled_date && (
                              <>
                                <span>·</span>
                                <span>
                                  {new Date(e.scheduled_date).toLocaleDateString("en-AU", {
                                    weekday: "short",
                                    day: "numeric",
                                    month: "short",
                                  })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="size-4 text-[#C7C7CC]" />
                      </Link>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Quick actions">
            <div className="space-y-2">
              <QuickAction
                href="/brands"
                icon={<Calendar className="size-4 text-white" />}
                iconBg="#1D1D1F"
                title="Browse calendars"
                description="See all upcoming work"
                highlight
              />
              <QuickAction
                href="/knowledge"
                icon={<BookOpen className="size-4 text-[#6E6E73]" />}
                title="Brand references"
                description="Tone, visual direction, archives"
              />
            </div>
          </Section>
        </div>
      </div>
    </>
  )
}

/* -------------------- VIEWER -------------------- */

function ClientDashboard({
  data,
  brands,
  brandMap,
}: {
  data: DashboardData
  brands: Brand[]
  brandMap: Map<string, Brand>
}) {
  // Clients only see activity for brands they're a member of. The brands
  // list is already scoped by listAccessibleBrands; filter plans the
  // same way so we don't leak active campaigns from other accounts.
  const myPlans = data.activePlans.filter((p) => brandMap.has(p.brand_id))
  const readyToReview = myPlans.filter((p) =>
    ["briefs_done", "complete", "copy_done"].includes(p.status as string),
  )

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 md:mb-10">
        <Stat label="Your brands" value={brands.length} />
        <Stat label="Waiting on you" value={readyToReview.length} tone={readyToReview.length > 0 ? "#0A4B91" : undefined} />
        <Stat label="In progress" value={Math.max(0, myPlans.length - readyToReview.length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section
            title="Ready for your review"
            right={
              readyToReview.length === 0 ? (
                <span className="text-[12px] text-[#86868B]">Nothing pending</span>
              ) : undefined
            }
          >
            {readyToReview.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-[13.5px] text-[#86868B] leading-relaxed">
                  Proud is preparing your next campaign. We'll send a notification the moment something needs your approval.
                </CardContent>
              </Card>
            ) : (
              <PlansList plans={readyToReview.slice(0, 5)} brandMap={brandMap} />
            )}
          </Section>

          {myPlans.length > readyToReview.length && (
            <Section title="Coming soon">
              <PlansList
                plans={myPlans.filter((p) => !readyToReview.includes(p)).slice(0, 5)}
                brandMap={brandMap}
              />
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Your brands">
            <div className="space-y-2">
              {brands.slice(0, 6).map((b) => (
                <Link key={b.id} href={`/brands/${b.slug}/calendar`} className="block">
                  <Card hoverable>
                    <CardContent className="p-4 flex items-center gap-3">
                      <BrandIcon
                        name={b.name}
                        websiteUrl={b.website_url}
                        primaryColor={b.primary_color}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate">{b.name}</div>
                        <div className="text-[11.5px] text-[#86868B] truncate">View campaigns</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </>
  )
}

/* -------------------- SHARED -------------------- */

function Stat({ label, value, tone, sub }: { label: string; value: number; tone?: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-[12px] text-[#86868B] mb-1">{label}</div>
        <div className="text-[28px] font-semibold tracking-display" style={{ color: tone || "#1D1D1F" }}>
          {value}
        </div>
        {sub && <div className="text-[11px] text-[#86868B] mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  )
}

function Section({
  title,
  right,
  children,
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-semibold tracking-display">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-6 text-[13px] text-[#6E6E73] text-center">{message}</CardContent>
    </Card>
  )
}

function PlansList({ plans, brandMap }: { plans: ReturnType<typeof Object>; brandMap: Map<string, Brand> }) {
  const list = plans as DashboardData["activePlans"]
  if (list.length === 0) {
    return <EmptyCard message="Nothing in flight right now." />
  }
  return (
    <Card>
      <CardContent className="p-0">
        {list.map((p, idx) => {
          const brand = brandMap.get(p.brand_id)
          return (
            <Link
              key={p.id}
              href={brand ? `/brands/${brand.slug}/calendar/${p.id}` : "/brands"}
              className={`flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-white/60 transition ${
                idx === list.length - 1 ? "" : "border-b border-[#E5E5EA]"
              }`}
            >
              <div className="min-w-0">
                <div className="text-[13px] font-medium truncate">
                  {brand?.name ?? "Unknown brand"} · {monthName(p.month)} {p.year}
                </div>
                <div className="text-[11.5px] text-[#86868B] mt-0.5 truncate">
                  {planStatusLabel(p.status)} · started {relativeTime(p.created_at)}
                </div>
              </div>
              <PlanStatusBadge status={p.status} />
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ClientFeedbackList({
  items,
  brandMap,
}: {
  items: DashboardData["recentClientFeedback"]
  brandMap: Map<string, Brand>
}) {
  return (
    <Card>
      <CardContent className="p-0">
        {items.map((f, idx) => {
          const brand = f.brand_id ? brandMap.get(f.brand_id) ?? null : null
          const Icon = f.action === "approve" ? ListChecks : f.action === "request_changes" ? Pencil : MessageCircle
          return (
            <div
              key={`${f.acted_at}-${idx}`}
              className={`flex items-start gap-3 px-5 py-3.5 ${
                idx === items.length - 1 ? "" : "border-b border-[#E5E5EA]"
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-[#F5F5F7] flex items-center justify-center shrink-0">
                <Icon className="size-3.5 text-[#6E6E73]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px]">
                  <span className="font-medium">{f.brand_name ?? brand?.name ?? "Client"}</span>{" "}
                  <span className="text-[#6E6E73]">{actionPhrase(f.action)}</span>
                </div>
                {f.comment && (
                  <div className="text-[12px] text-[#1D1D1F] mt-1 leading-relaxed line-clamp-3">"{f.comment}"</div>
                )}
              </div>
              <span className="text-[11px] text-[#86868B] shrink-0">{relativeTime(f.acted_at)}</span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function QuickAction({
  href,
  icon,
  iconBg = "#F5F5F7",
  title,
  description,
  highlight,
}: {
  href: string
  icon: React.ReactNode
  iconBg?: string
  title: string
  description: string
  highlight?: boolean
}) {
  return (
    <Link href={href} className="block">
      <Card hoverable variant={highlight ? "glass-tinted-blue" : "glass"}>
        <CardContent className="p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg }}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-[13px]">{title}</div>
            <div className="text-[12px] text-[#6E6E73] mt-0.5 leading-snug">{description}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function SystemRow({
  label,
  ok,
  okText,
  badText,
  last,
}: {
  label: string
  ok: boolean
  okText: string
  badText: string
  last?: boolean
}) {
  return (
    <div className={`flex items-center justify-between px-5 py-3 text-[13px] ${last ? "" : "border-b border-[#E5E5EA]"}`}>
      <span className="text-[#86868B]">{label}</span>
      <Badge variant={ok ? "success" : "warning"}>{ok ? okText : badText}</Badge>
    </div>
  )
}

function FormatBadge({ format }: { format: "text" | "designed" | "sms" }) {
  if (format === "sms") return <Badge variant="info">SMS</Badge>
  if (format === "text") return <Badge variant="neutral">Text</Badge>
  return <Badge variant="accent">Designed</Badge>
}

function PlanStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "neutral" | "warning" | "success" | "destructive"; label: string }> = {
    draft: { variant: "neutral", label: "Draft" },
    pending_review: { variant: "warning", label: "Review" },
    calendar_approved: { variant: "success", label: "Approved" },
    copy_done: { variant: "success", label: "Copy done" },
    briefs_done: { variant: "success", label: "Briefs done" },
    complete: { variant: "success", label: "Complete" },
    error: { variant: "destructive", label: "Error" },
  }
  const m = map[status] ?? { variant: "neutral" as const, label: status }
  return <Badge variant={m.variant}>{m.label}</Badge>
}

function planStatusLabel(s: string): string {
  return s.replace(/_/g, " ")
}

function actionPhrase(action: string): string {
  if (action === "approve") return "approved a campaign"
  if (action === "request_changes") return "requested changes"
  return "left a comment"
}

function monthName(m: number): string {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1] ?? ""
}
