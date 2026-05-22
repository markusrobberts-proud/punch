import { headers } from "next/headers"
import { requireApprovedUser } from "@/lib/auth"
import { listAccessibleBrands, getBrandBySlug } from "@/lib/brands"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

export default async function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  // Resolve the active brand slug from the URL first so we can parallelise everything.
  const h = await headers()
  const path = h.get("x-pathname") ?? ""
  const activeBrandSlug = path.match(/^\/brands\/([^/]+)/)?.[1] ?? null

  const supabase = await createSupabaseServerClient()
  const aiKey = !!(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY)

  // Parallelise: user, brand list, active brand (if any), doc count.
  const [user, brands, activeBrand] = await Promise.all([
    requireApprovedUser(),
    listAccessibleBrands(),
    activeBrandSlug ? getBrandBySlug(activeBrandSlug) : Promise.resolve(null),
  ])

  let docs = 0
  let brandName: string | null = null
  if (activeBrand) {
    brandName = activeBrand.name as string
    const { count } = await supabase
      .from("knowledge_items")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", activeBrand.id)
      .eq("review_status", "approved")
    docs = count ?? 0
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
