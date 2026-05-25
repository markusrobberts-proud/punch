import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowRight, BookOpen, Calendar, Compass, Inbox, Mail, MessageSquare, Pencil, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { requireApprovedUser } from "@/lib/auth"
import { canEditStrategy } from "@/lib/rbac"
import { getBrandBySlug } from "@/lib/brands"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader, PageShell } from "@/components/layout/page-header"
import { ScrapeButton } from "./scrape-button"

type PlanRow = {
  id: string
  status: string
}

type EmailRow = {
  id: string
  format: "text" | "designed" | "sms"
  scheduled_date: string | null
  theme: string | null
  subject_line: string | null
  copy_status: string
  brief_status: string
  plan_id: string
}

export default async function BrandDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireApprovedUser()
  const { slug } = await params
  const brand = await getBrandBySlug(slug)
  if (!brand) notFound()
  const canEdit = canEditStrategy(user.role)

  const supabase = await createSupabaseServerClient()
  const [{ data: plans }, { data: emails }, { count: docCount }] = await Promise.all([
    supabase
      .from("campaign_plans")
      .select("id,status")
      .eq("brand_id", brand.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false }),
    supabase
      .from("campaign_emails")
      .select("id,format,scheduled_date,theme,subject_line,copy_status,brief_status,plan_id")
      .eq("brand_id", brand.id)
      .order("scheduled_date", { ascending: true })
      .limit(8),
    supabase
      .from("knowledge_items")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .eq("review_status", "approved"),
  ])

  const planList = (plans ?? []) as PlanRow[]
  const upcoming = ((emails ?? []) as EmailRow[]).filter((e) => e.scheduled_date && new Date(e.scheduled_date) >= new Date()).slice(0, 5)

  const counts = planList.reduce(
    (acc, p) => {
      if (p.status === "draft" || p.status === "pending_review" || p.status === "calendar_approved") acc.plan++
      else if (p.status === "copy_done") acc.copy++
      else if (p.status === "briefs_done") acc.brief++
      else if (p.status === "complete") acc.approved++
      return acc
    },
    { plan: 0, copy: 0, brief: 0, approved: 0 },
  )

  return (
    <PageShell>
      <PageHeader
        eyebrow={brand.industry ? `${brand.industry} · Brand workspace` : "Brand workspace"}
        title={brand.name}
        description={brand.tone_of_voice ?? "Plan, draft, brief and approve email, all in one place."}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={brand.scrape_status === "done" ? "success" : brand.scrape_status === "error" ? "destructive" : "neutral"}>
              {brand.scrape_status === "done" ? "Indexed" : `Scrape: ${brand.scrape_status}`}
            </Badge>
            {canEdit && brand.website_url && <ScrapeButton brandId={brand.id} status={brand.scrape_status} />}
            {canEdit && (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/brands/${brand.slug}/settings`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-10">
        <Stat label="In planning" value={counts.plan} />
        <Stat label="Awaiting copy review" value={counts.copy} />
        <Stat label="Awaiting brief review" value={counts.brief} />
        <Stat label="Ready to send" value={counts.approved} tone="#166D2F" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <SectionTitle right={<Link href={`/brands/${brand.slug}/calendar`} className="text-[12px] text-[#007AFF] hover:underline inline-flex items-center gap-1">View calendar <ArrowRight className="size-3" /></Link>}>
            Up next
          </SectionTitle>

          {upcoming.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-[13px] text-[#6E6E73]">
                {planList.length === 0
                  ? "No plans yet. Click 'Plan next month' to start."
                  : "Nothing scheduled in the future right now."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {upcoming.map((e) => (
                <Link key={e.id} href={`/brands/${brand.slug}/calendar/${e.plan_id}`} className="block">
                  <Card hoverable>
                    <CardContent className="py-4 flex items-center gap-4">
                      <div className="w-9 h-9 rounded-lg bg-[#F5F5F7] flex items-center justify-center shrink-0">
                        {e.format === "sms" ? <MessageSquare className="size-4 text-[#6E6E73]" /> : <Mail className="size-4 text-[#6E6E73]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-[14px] truncate">{e.subject_line ?? e.theme ?? "(untitled)"}</span>
                          <FormatBadge format={e.format} />
                          <StageBadge label="Copy" status={e.copy_status} />
                          <StageBadge label="Brief" status={e.brief_status} />
                        </div>
                        <div className="text-[12px] text-[#86868B] mt-0.5 truncate">
                          {e.scheduled_date && new Date(e.scheduled_date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                          {e.theme && e.subject_line && ` · ${e.theme}`}
                        </div>
                      </div>
                      <ArrowRight className="size-4 text-[#C7C7CC] shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionTitle>Quick actions</SectionTitle>
          <div className="space-y-2">
            <QuickAction href={`/brands/${brand.slug}/calendar/new`} icon={<Sparkles className="size-4 text-white" />} iconBg="#007AFF" title="Plan next month" description="Generate next calendar with Claude" highlight />
            <QuickAction href={`/brands/${brand.slug}/knowledge`} icon={<Inbox className="size-4 text-[#6E6E73]" />} title="Knowledge Bank" description={`${docCount ?? 0} approved · forward emails to feed Claude`} />
            <QuickAction href="/strategy" icon={<Compass className="size-4 text-[#6E6E73]" />} title="Proud Strategy" description="The org playbook every brand inherits" />
            <QuickAction href={`/brands/${brand.slug}/calendar`} icon={<Calendar className="size-4 text-[#6E6E73]" />} title="Campaign Calendar" description={`${planList.length} ${planList.length === 1 ? "plan" : "plans"} so far`} />
          </div>
        </div>
      </div>

      <div className="mt-10">
        <SectionTitle>Voice & audience</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <div className="text-[11px] uppercase tracking-wider text-[#86868B]">Tone of voice</div>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] whitespace-pre-wrap leading-relaxed">
                {brand.tone_of_voice || <span className="italic text-[#86868B]">Not set yet. Add it in brand settings.</span>}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-[11px] uppercase tracking-wider text-[#86868B]">Target audience</div>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] whitespace-pre-wrap leading-relaxed">
                {brand.target_audience || <span className="italic text-[#86868B]">Not set yet.</span>}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-[12px] text-[#86868B] mb-1">{label}</div>
        <div className="text-[28px] font-semibold tracking-display" style={{ color: tone || "#1D1D1F" }}>{value}</div>
      </CardContent>
    </Card>
  )
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[16px] font-semibold tracking-display">{children}</h2>
      {right}
    </div>
  )
}

function FormatBadge({ format }: { format: "text" | "designed" | "sms" }) {
  if (format === "sms") return <Badge variant="info">SMS</Badge>
  if (format === "text") return <Badge variant="neutral">Text</Badge>
  return <Badge variant="accent">Designed</Badge>
}

function StageBadge({ label, status }: { label: string; status: string }) {
  const variant = status === "done" ? "success" : status === "generating" ? "warning" : status === "error" ? "destructive" : "neutral"
  return <Badge variant={variant}>{label}</Badge>
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
