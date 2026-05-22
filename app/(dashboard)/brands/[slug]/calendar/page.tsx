import { notFound } from "next/navigation"
import Link from "next/link"
import { Plus } from "lucide-react"
import { requireApprovedUser } from "@/lib/auth"
import { getBrandBySlug } from "@/lib/brands"
import { listPlansForBrand, MONTHS } from "@/lib/campaigns"
import { canEditStrategy } from "@/lib/rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function BrandCalendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireApprovedUser()
  const { slug } = await params
  const brand = await getBrandBySlug(slug)
  if (!brand) notFound()
  const plans = await listPlansForBrand(brand.id)
  const canPlan = canEditStrategy(user.role)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{brand.name}</div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaign Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            One plan per month. Each plan moves through draft → review → calendar approved → copy done → briefs done → complete.
          </p>
        </div>
        {canPlan && (
          <Link
            href={`/brands/${brand.slug}/calendar/new`}
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="size-4" /> Plan next month
          </Link>
        )}
      </div>

      {plans.length === 0 ? (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">No plans yet</CardTitle>
            <CardDescription>
              {canPlan ? "Create the first monthly plan." : "An admin or strategist needs to create one."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <Link key={p.id} href={`/brands/${brand.slug}/calendar/${p.id}`} className="block">
              <Card className="glass hover:bg-white/90 transition-colors">
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">{MONTHS[p.month - 1]} {p.year}</div>
                    <div className="text-xs text-muted-foreground mt-1">{p.name}</div>
                  </div>
                  <PlanStatusBadge status={p.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function PlanStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "secondary" | "warning" | "success" | "destructive"; label: string }> = {
    draft: { variant: "secondary", label: "Draft" },
    generating: { variant: "warning", label: "Generating…" },
    pending_review: { variant: "warning", label: "Pending review" },
    calendar_approved: { variant: "success", label: "Calendar approved" },
    copy_generating: { variant: "warning", label: "Copy generating…" },
    copy_done: { variant: "success", label: "Copy done" },
    briefs_done: { variant: "success", label: "Briefs done" },
    complete: { variant: "success", label: "Complete" },
    error: { variant: "destructive", label: "Error" },
  }
  const m = map[status] ?? { variant: "secondary" as const, label: status }
  return <Badge variant={m.variant}>{m.label}</Badge>
}
