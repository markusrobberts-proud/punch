import { Clock, Sparkles, Users } from "lucide-react"
import { requireApprovedUser } from "@/lib/auth"
import { canEditStrategy } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { PageHeader, PageShell } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, initialsFromName } from "@/components/ui/avatar"
import { StrategySectionEditor } from "./section-editor"

type StrategySection = {
  id: string
  section_key: string
  title: string
  body: string | null
  position: number
  updated_at: string
  updated_by_user_id: string | null
}

const CONTRIB_COLOURS = ["#D84A1F", "#2D5A4F", "#2D4F6B", "#8B5A2B", "#7C3AED"]

export default async function StrategyPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>
}) {
  const user = await requireApprovedUser()
  const editable = canEditStrategy(user.role)
  const { s: activeKey } = await searchParams

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("proud_strategy_sections")
    .select("id,section_key,title,body,position,updated_at,updated_by_user_id")
    .order("position", { ascending: true })

  const sections = (data ?? []) as StrategySection[]
  const active = sections.find((s) => s.section_key === activeKey) ?? sections[0]

  // Recent contributors: fetch users referenced in updated_by_user_id
  const userIds = Array.from(new Set(sections.map((s) => s.updated_by_user_id).filter(Boolean))) as string[]
  const { data: contribs } = userIds.length > 0
    ? await supabase.from("users").select("id,display_name,email").in("id", userIds)
    : { data: [] as { id: string; display_name: string | null; email: string }[] }

  const contributors = (contribs ?? []).map((u: { id: string; display_name: string | null; email: string }, i: number) => ({
    id: u.id,
    name: u.display_name ?? u.email.split("@")[0],
    color: CONTRIB_COLOURS[i % CONTRIB_COLOURS.length],
  }))

  const mostRecent = sections.reduce<StrategySection | null>((latest, s) => {
    if (!latest) return s
    return new Date(s.updated_at) > new Date(latest.updated_at) ? s : latest
  }, null)

  return (
    <PageShell>
      <PageHeader
        eyebrow="Organisation · Living document"
        title="Proud Strategy"
        description="How we think about email marketing at Proud. Everyone on the strategy team contributes. Claude reads this doc for every brand, every campaign."
        actions={
          contributors.length > 0 ? (
            <div className="flex -space-x-1.5">
              {contributors.slice(0, 5).map((c) => (
                <Avatar key={c.id} initials={initialsFromName(c.name)} color={c.color} />
              ))}
            </div>
          ) : undefined
        }
      />

      <div className="flex items-center gap-3 text-[12px] text-[#6E6E73] mb-6 pb-6 border-b border-[#E5E5EA]">
        <div className="flex items-center gap-1.5">
          <Clock className="size-3.5" />
          {mostRecent ? `Updated ${relativeTime(mostRecent.updated_at)}` : "Not edited yet"}
        </div>
        <span>·</span>
        <div className="flex items-center gap-1.5">
          <Users className="size-3.5" /> {contributors.length} contributor{contributors.length === 1 ? "" : "s"}
        </div>
        <span>·</span>
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-[#007AFF]" /> Referenced by all brands
        </div>
      </div>

      <div className="grid grid-cols-[200px_1fr] gap-10">
        <aside>
          <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-2 px-2">Sections</div>
          <div className="space-y-0.5">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`/strategy?s=${s.section_key}`}
                className={`block w-full text-left px-2.5 py-1.5 rounded-md text-[13px] ${
                  s.section_key === active?.section_key
                    ? "bg-[#F5F5F7] text-[#1D1D1F] font-medium"
                    : "text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
                }`}
              >
                {s.title}
              </a>
            ))}
          </div>
        </aside>

        <div>
          {active && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[22px] font-semibold tracking-display">{active.title}</h2>
              </div>
              {editable ? (
                <StrategySectionEditor sectionId={active.id} initialBody={active.body ?? ""} />
              ) : (
                <Card>
                  <CardContent className="p-5">
                    <p className="text-[14px] whitespace-pre-wrap leading-relaxed">
                      {active.body || <span className="italic text-[#86868B]">Empty section.</span>}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </PageShell>
  )
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const seconds = Math.round((now - then) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 14) return `${days}d ago`
  const weeks = Math.round(days / 7)
  if (weeks < 8) return `${weeks}w ago`
  const months = Math.round(days / 30)
  return `${months}mo ago`
}
