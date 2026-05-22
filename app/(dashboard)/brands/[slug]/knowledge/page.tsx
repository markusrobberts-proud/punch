import { notFound } from "next/navigation"
import { requireApprovedUser } from "@/lib/auth"
import { getBrandBySlug } from "@/lib/brands"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail } from "lucide-react"
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

export default async function BrandKnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ status?: string }>
}) {
  await requireApprovedUser()
  const { slug } = await params
  const { status: statusFilter = "all" } = await searchParams
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
  const { data } = await query
  const items = (data ?? []) as KnowledgeRow[]

  const inboxEmail = brand.inbox_alias ? `${brand.inbox_alias}@kb.proudemail.studio` : null

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{brand.name}</div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Bank</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everything Claude reads for {brand.name}. Approved items feed into every generation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UploadFileDialog brandId={brand.id} brandSlug={brand.slug} />
          <AddNoteDialog brands={[{ id: brand.id, name: brand.name }]} />
        </div>
      </div>

      {inboxEmail && (
        <Card className="glass">
          <CardContent className="py-4 flex items-center gap-3">
            <Mail className="size-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{inboxEmail}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Forward customer threads, meeting notes, and strategy emails to this address — they land here automatically.
                <span className="ml-1 italic">(Phase 2B — ingestion wires up soon.)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Filters slug={brand.slug} active={statusFilter} />

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nothing here yet</CardTitle>
            <CardDescription>Upload a brand doc, paste a note, or scrape the website.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{item.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <span className="capitalize">{item.source_type.replace(/_/g, " ")}</span>
                    <span>·</span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    {item.file_url && (
                      <>
                        <span>·</span>
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-foreground hover:underline"
                        >
                          View file
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={item.review_status} />
                  <KnowledgeReviewActions id={item.id} status={item.review_status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: KnowledgeRow["review_status"] }) {
  const variant = status === "approved" ? "success" : status === "rejected" ? "destructive" : "warning"
  return <Badge variant={variant} className="capitalize">{status.replace(/_/g, " ")}</Badge>
}

function Filters({ slug, active }: { slug: string; active: string }) {
  const link = (s: string) => `/brands/${slug}/knowledge${s === "all" ? "" : `?status=${s}`}`
  const pill = (status: string, label: string) => (
    <a
      href={link(status)}
      className={`rounded-full px-3 py-1 text-xs transition-colors ${
        active === status ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/70 hover:bg-muted/80"
      }`}
    >
      {label}
    </a>
  )

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Filter:</span>
      {pill("all", "All")}
      {pill("pending_review", "Pending")}
      {pill("approved", "Approved")}
      {pill("rejected", "Rejected")}
    </div>
  )
}
