"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { recordAudit } from "@/lib/audit"
import { scrapeWebsite } from "@/lib/scrape"

export async function runWebsiteScrape(brandId: string) {
  const user = await requireRole("strategist")
  const supabase = await createSupabaseServerClient()
  const { data: brand } = await supabase
    .from("brands")
    .select("id, slug, website_url")
    .eq("id", brandId)
    .single()
  if (!brand || !brand.website_url) throw new Error("Brand has no website URL")

  await supabase.from("brands").update({ scrape_status: "running" }).eq("id", brandId)

  let pages: Awaited<ReturnType<typeof scrapeWebsite>> = []
  try {
    pages = await scrapeWebsite(brand.website_url)
  } catch (err) {
    await supabase.from("brands").update({ scrape_status: "error" }).eq("id", brandId)
    throw err
  }

  if (pages.length === 0) {
    await supabase.from("brands").update({ scrape_status: "error" }).eq("id", brandId)
    throw new Error("No pages could be extracted from the website")
  }

  // Replace previous scraped pages for this brand to avoid duplicates
  await supabase
    .from("knowledge_items")
    .delete()
    .eq("brand_id", brandId)
    .eq("source_type", "scraped_website")

  await supabase.from("knowledge_items").insert(
    pages.map((p) => ({
      brand_id: brandId,
      source_type: "scraped_website",
      title: p.title || p.url,
      content: p.text,
      source_url: p.url,
      review_status: "approved",
      added_by_user_id: user.id,
    })),
  )

  await supabase.from("brands").update({ scrape_status: "done" }).eq("id", brandId)

  await recordAudit({
    userId: user.id,
    brandId,
    entityType: "brand",
    entityId: brandId,
    action: "scrape_website",
    meta: { pages: pages.length },
  })

  revalidatePath(`/brands/${brand.slug}`)
  revalidatePath(`/brands/${brand.slug}/knowledge`)
}
