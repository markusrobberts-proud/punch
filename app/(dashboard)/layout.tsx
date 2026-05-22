import { headers } from "next/headers"
import { requireApprovedUser } from "@/lib/auth"
import { listAccessibleBrands } from "@/lib/brands"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

export default async function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const [user, brands] = await Promise.all([requireApprovedUser(), listAccessibleBrands()])

  // Active brand inferred from the URL path.
  const h = await headers()
  const path = h.get("x-pathname") ?? h.get("x-invoke-path") ?? ""
  const slugMatch = path.match(/^\/brands\/([^/]+)/)
  const activeBrandSlug = slugMatch?.[1] ?? null

  const aiKey = !!(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY)

  let docs = 0
  let brandName: string | null = null
  if (activeBrandSlug) {
    const supabase = await createSupabaseServerClient()
    const { data: brand } = await supabase
      .from("brands")
      .select("id,name")
      .eq("slug", activeBrandSlug)
      .maybeSingle()
    if (brand) {
      brandName = brand.name as string
      const { count } = await supabase
        .from("knowledge_items")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brand.id)
        .eq("review_status", "approved")
      docs = count ?? 0
    }
  }

  return (
    <DashboardLayout
      user={user}
      brands={brands}
      activeBrandSlug={activeBrandSlug}
      claudeStatus={{ connected: aiKey, docs, brandName }}
    >
      {children}
    </DashboardLayout>
  )
}
