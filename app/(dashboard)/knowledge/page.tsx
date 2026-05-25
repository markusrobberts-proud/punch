import Link from "next/link"
import { FileText, Mail, Notebook, BookOpen, Sparkles } from "lucide-react"
import { redirect } from "next/navigation"
import { requireApprovedUser } from "@/lib/auth"
import { canContributeKnowledge, canReviewKnowledge, canSeeInternalSurfaces } from "@/lib/rbac"
import { listAccessibleBrands } from "@/lib/brands"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader, PageShell } from "@/components/layout/page-header"
import { KnowledgeReviewActions } from "./review-actions"
import { AddNoteDialog } from "./add-note-dialog"

type KnowledgeRow = {
  id: string
  brand_id: string
  title: string
  source_type: string
  review_status: "pending_review" | "approved" | "rejected"
  created_at: string
  file_url: string | null
}

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  uploaded_file: FileText,
  brand_guide: BookOpen,
  strategy_doc: BookOpen,
  meeting_notes: Notebook,
  campaign_debrief: Notebook,
  manual_note: Notebook,
  inbound_email: Mail,
  scraped_website: Sparkles,
}

export default async function KnowledgeBankPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; status?: string }>
}) {
  const user = await requireApprovedUser()
  if (!canSeeInternalSurfaces(user.role)) redirect("/")
  const canContribute = canContributeKnowledge(user.role)
  const canReview = canReviewKnowledge(user.role)
  const params = await searchParams
  const brands = await listAccessibleBrands()
  const brandFilter = params.brand
  const statusFilter = params.status ?? "all"

  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from("knowledge_items")
    .select("id,brand_id,title,source_type,review_status,created_at,file_url")
    .order("created_at", { ascending: false })
    .limit(150)
  if (brandFilter) query = query.eq("brand_id", brandFilter)
  if (statusFilter !== "all") query = query.eq("review_status", statusFilter)

  const { data } = await query
  const items = (data ?? []) as KnowledgeRow[]
  const brandById = new Map(brands.map((b) => [b.id, b]))

  const pendingCount = items.filter((i) => i.review_status === "pending_review").length

  return (
    <PageShell>
      <PageHeader
        eyebrow="Organisation"
        title="Knowledge Bank"
        description="Everything Claude reads across all brands. Pending items need a review before they enter AI context."
        actions={
          <div className="flex items-center gap-2">
            {pendingCount > 0 && <Badge variant="warning">{pendingCount} pending</Badge>}
            {canContribute && <AddNoteDialog brands={brands.map((b) => ({ id: b.id, name: b.name }))} />}
          </div>
        }
      />

      <div className="space-y-1 mb-6">
        <FilterRow label="Status">
          <FilterPill href={paramsHref({ brand: brandFilter, status: "all" })} active={statusFilter === "all"}>All</FilterPill>
          <FilterPill href={paramsHref({ brand: brandFilter, status: "pending_review" })} active={statusFilter === "pending_review"}>Pending</FilterPill>
          <FilterPill href={paramsHref({ brand: brandFilter, status: "approved" })} active={statusFilter === "approved"}>Approved</FilterPill>
          <FilterPill href={paramsHref({ brand: brandFilter, status: "rejected" })} active={statusFilter === "rejected"}>Rejected</FilterPill>
        </FilterRow>
        <FilterRow label="Brand">
          <FilterPill href={paramsHref({ brand: undefined, status: statusFilter })} active={!brandFilter}>All</FilterPill>
          {brands.map((b) => (
            <FilterPill key={b.id} href={paramsHref({ brand: b.id, status: statusFilter })} active={brandFilter === b.id}>
              {b.name}
            </FilterPill>
          ))}
        </FilterRow>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nothing here yet</CardTitle>
            <CardDescription>Add a manual note, upload a doc on a brand page, or trigger a website scrape.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {items.map((item, idx) => {
              const brand = brandById.get(item.brand_id)
              const Icon = SOURCE_ICONS[item.source_type] ?? FileText
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-4 px-5 py-3.5 ${
                    idx === items.length - 1 ? "" : "border-b border-[#E5E5EA]"
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#F5F5F7] flex items-center justify-center shrink-0">
                    <Icon className="size-4 text-[#6E6E73]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium truncate">{item.title}</div>
                    <div className="text-[11.5px] text-[#86868B] mt-0.5 flex items-center gap-2 flex-wrap">
                      {brand ? (
                        <Link href={`/brands/${brand.slug}/knowledge`} className="hover:underline">{brand.name}</Link>
                      ) : (
                        <span>Unknown brand</span>
                      )}
                      <span>·</span>
                      <span className="capitalize">{item.source_type.replace(/_/g, " ")}</span>
                      <span>·</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                      {item.file_url && (
                        <>
                          <span>·</span>
                          <a href={item.file_url} target="_blank" rel="noreferrer" className="hover:underline text-[#1D1D1F]">View file</a>
                        </>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={item.review_status} />
                  <KnowledgeReviewActions id={item.id} status={item.review_status} canReview={canReview} canDelete={canReview} />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </PageShell>
  )
}

function paramsHref(p: { brand?: string; status: string }): string {
  const u = new URLSearchParams()
  if (p.brand) u.set("brand", p.brand)
  if (p.status !== "all") u.set("status", p.status)
  const qs = u.toString()
  return `/knowledge${qs ? `?${qs}` : ""}`
}

function StatusBadge({ status }: { status: KnowledgeRow["review_status"] }) {
  const variant = status === "approved" ? "success" : status === "rejected" ? "destructive" : "warning"
  return <Badge variant={variant}>{status.replace(/_/g, " ")}</Badge>
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12px] flex-wrap">
      <span className="text-[#86868B] w-12">{label}</span>
      <div className="flex items-center gap-1.5 flex-wrap">{children}</div>
    </div>
  )
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      className={`rounded-full px-3 py-1 text-[11.5px] transition ${
        active ? "bg-[#1D1D1F] text-white" : "bg-white/60 text-[#6E6E73] hover:bg-white"
      }`}
    >
      {children}
    </a>
  )
}
