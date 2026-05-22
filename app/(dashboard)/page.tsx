import Link from "next/link"
import { Plus, ArrowRight, BookOpen } from "lucide-react"
import { requireApprovedUser } from "@/lib/auth"
import { listAccessibleBrands } from "@/lib/brands"
import { canEditStrategy } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader, PageShell } from "@/components/layout/page-header"

function timeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export default async function BrandsPage() {
  const user = await requireApprovedUser()
  const brands = await listAccessibleBrands()
  const canPlan = canEditStrategy(user.role)

  // Doc + plan counts per brand for richer cards.
  const supabase = await createSupabaseServerClient()
  const brandIds = brands.map((b) => b.id)
  const counts: Record<string, { docs: number; plans: number }> = {}
  if (brandIds.length > 0) {
    const [{ data: docs }, { data: plans }] = await Promise.all([
      supabase
        .from("knowledge_items")
        .select("brand_id")
        .in("brand_id", brandIds)
        .eq("review_status", "approved"),
      supabase.from("campaign_plans").select("brand_id").in("brand_id", brandIds),
    ])
    for (const d of docs ?? []) {
      counts[d.brand_id as string] ??= { docs: 0, plans: 0 }
      counts[d.brand_id as string].docs++
    }
    for (const p of plans ?? []) {
      counts[p.brand_id as string] ??= { docs: 0, plans: 0 }
      counts[p.brand_id as string].plans++
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={`${timeOfDay()}, ${user.displayName?.split(" ")[0] ?? user.email.split("@")[0]}`}
        title="Brands"
        description="Every brand Proud Creative runs email for. Pick one to drop into the workspace."
        actions={
          canPlan && (
            <Button asChild>
              <Link href="/brands/new">
                <Plus /> Add brand
              </Link>
            </Button>
          )
        }
      />

      {brands.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No brands yet</CardTitle>
            <CardDescription>
              {canPlan
                ? "Add your first brand to get started: Walnut, Genuins, Proud Coffee Co."
                : "An admin or strategist needs to add a brand before you can do anything here."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((brand) => {
            const c = counts[brand.id] ?? { docs: 0, plans: 0 }
            return (
              <Link key={brand.id} href={`/brands/${brand.slug}`} className="block">
                <Card hoverable className="h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle>{brand.name}</CardTitle>
                        <CardDescription>{brand.industry ?? "–"}</CardDescription>
                      </div>
                      <BrandSquare color={brand.primary_color} name={brand.name} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-[12px] text-[#86868B]">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <BookOpen className="size-3.5" /> {c.docs} docs
                        </span>
                        <span>·</span>
                        <span>{c.plans} {c.plans === 1 ? "plan" : "plans"}</span>
                      </div>
                      <Badge
                        variant={brand.scrape_status === "done" ? "success" : brand.scrape_status === "error" ? "destructive" : "neutral"}
                      >
                        {brand.scrape_status === "done" ? "Indexed" : brand.scrape_status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}

          {canPlan && (
            <Link href="/brands/new" className="block">
              <Card className="h-full border-dashed bg-white/30 hover:bg-white/60 transition card-shadow-hover">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md border border-dashed border-[#D2D2D7] flex items-center justify-center">
                      <Plus className="size-4 text-[#86868B]" />
                    </div>
                    <div>
                      <CardTitle className="text-[#6E6E73]">Add brand</CardTitle>
                      <CardDescription>New workspace, ready in seconds</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-end text-[12px] text-[#86868B]">
                    Start <ArrowRight className="size-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      )}
    </PageShell>
  )
}

function BrandSquare({ color, name }: { color: string | null; name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
  return (
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
      style={{ background: color || "#1D1D1F" }}
    >
      {initials}
    </div>
  )
}
