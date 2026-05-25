import { notFound } from "next/navigation"
import {
  AtSign,
  FileText,
  Mail,
  Notebook,
  BookOpen,
  Sparkles,
  Eye,
  Trash2,
} from "lucide-react"
import { redirect } from "next/navigation"
import { requireApprovedUser } from "@/lib/auth"
import { canContributeKnowledge, canReviewKnowledge, canSeeInternalSurfaces } from "@/lib/rbac"
import { getBrandBySlug } from "@/lib/brands"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader, PageShell } from "@/components/layout/page-header"
import { CopyAddressButton } from "./copy-address-button"
import { forwardingAddressFor } from "@/lib/inbound-email"
import { KnowledgeReviewActions } from "@/app/(dashboard)/knowledge/review-actions"
import { AddNoteDialog } from "@/app/(dashboard)/knowledge/add-note-dialog"
import { UploadFileDialog } from "./upload-file-dialog"

type KnowledgeRow = {
  id: string
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

const SOURCE_LABELS: Record<string, string> = {
  uploaded_file: "Uploaded file",
  brand_guide: "Brand guide",
  strategy_doc: "Strategy doc",
  meeting_notes: "Meeting notes",
  campaign_debrief: "Campaign debrief",
  manual_note: "Manual note",
  inbound_email: "Inbound email",
  scraped_website: "Website",
}

export default async function BrandKnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ status?: string; tab?: string }>
}) {
  const user = await requireApprovedUser()
  const { slug } = await params
  if (!canSeeInternalSurfaces(user.role)) redirect(`/brands/${slug}`)
  const canContribute = canContributeKnowledge(user.role)
  const canReview = canReviewKnowledge(user.role)
  const { status: statusFilter = "all", tab = "documents" } = await searchParams
  const brand = await getBrandBySlug(slug)
  if (!brand) notFound()

  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from("knowledge_items")
    .select("id,title,source_type,review_status,created_at,file_url")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false })
    .limit(200)
  if (statusFilter !== "all") query = query.eq("review_status", statusFilter)
  if (tab === "emails") query = query.eq("source_type", "inbound_email")
  if (tab === "documents") query = query.neq("source_type", "inbound_email")

  const { data } = await query
  const items = (data ?? []) as KnowledgeRow[]
  const inboxEmail = forwardingAddressFor(brand.inbox_alias as string | null)

  const docCount = items.length
  const pendingCount = items.filter((i) => i.review_status === "pending_review").length

  return (
    <PageShell>
      <PageHeader
        eyebrow={`Knowledge Bank · ${brand.name}`}
        title="Everything Claude reads for this brand"
        description="Upload documents directly, or forward relevant emails to this brand's private address and they'll be added automatically."
        actions={
          <div className="flex items-center gap-2">
            {canContribute && <UploadFileDialog brandId={brand.id} brandSlug={brand.slug} />}
            {canContribute && <AddNoteDialog brands={[{ id: brand.id, name: brand.name }]} />}
          </div>
        }
      />

      {inboxEmail && (
        <Card variant="glass-tinted-blue" className="mb-8">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#007AFF] flex items-center justify-center shrink-0">
              <AtSign className="size-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-[#86868B] mb-0.5">
                Forwarding address for {brand.name}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <code className="text-[15px] font-medium text-[#1D1D1F] truncate">{inboxEmail}</code>
                <CopyAddressButton address={inboxEmail} />
              </div>
              <p className="text-[12.5px] text-[#6E6E73] mt-1.5 leading-relaxed">
                Forward meeting recaps, strategy threads, customer feedback, or any email Claude should learn from. Phase 2B wires up auto-ingest.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-1 border-b border-[#E5E5EA] mb-6">
        <TabLink href={`/brands/${brand.slug}/knowledge?tab=documents${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`} active={tab === "documents"}>
          Documents
          <span className="text-[#86868B] text-[11px]">{tab === "documents" ? docCount : ""}</span>
        </TabLink>
        <TabLink href={`/brands/${brand.slug}/knowledge?tab=emails${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`} active={tab === "emails"}>
          Forwarded emails
          <span className="text-[#86868B] text-[11px]">{tab === "emails" ? docCount : ""}</span>
        </TabLink>
      </div>

      <div className="flex items-center gap-2 text-[12px] mb-4">
        <span className="text-[#86868B]">Status:</span>
        <FilterPill href={statusHref(slug, tab, "all")} active={statusFilter === "all"}>All</FilterPill>
        <FilterPill href={statusHref(slug, tab, "pending_review")} active={statusFilter === "pending_review"}>
          Pending {pendingCount > 0 && `(${pendingCount})`}
        </FilterPill>
        <FilterPill href={statusHref(slug, tab, "approved")} active={statusFilter === "approved"}>Approved</FilterPill>
        <FilterPill href={statusHref(slug, tab, "rejected")} active={statusFilter === "rejected"}>Rejected</FilterPill>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nothing here yet</CardTitle>
            <CardDescription>
              {tab === "emails"
                ? "Forward an email to the address above and it'll appear here."
                : "Upload a brand doc, paste a note, or trigger a website scrape from the brand page."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {items.map((item, idx) => {
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
                      <span>{SOURCE_LABELS[item.source_type] ?? item.source_type}</span>
                      <span>·</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                      {item.file_url && (
                        <>
                          <span>·</span>
                          <a href={item.file_url} target="_blank" rel="noreferrer" className="text-[#1D1D1F] hover:underline inline-flex items-center gap-1">
                            <Eye className="size-3" /> View file
                          </a>
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

function statusHref(slug: string, tab: string, status: string) {
  const qs = new URLSearchParams()
  qs.set("tab", tab)
  if (status !== "all") qs.set("status", status)
  return `/brands/${slug}/knowledge?${qs.toString()}`
}

function StatusBadge({ status }: { status: KnowledgeRow["review_status"] }) {
  const variant = status === "approved" ? "success" : status === "rejected" ? "destructive" : "warning"
  return <Badge variant={variant}>{status.replace(/_/g, " ")}</Badge>
}

function TabLink({
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
      className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px flex items-center gap-2 transition ${
        active ? "border-[#1D1D1F] text-[#1D1D1F]" : "border-transparent text-[#86868B] hover:text-[#1D1D1F]"
      }`}
    >
      {children}
    </a>
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
