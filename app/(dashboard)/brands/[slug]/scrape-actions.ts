"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { recordAudit } from "@/lib/audit"
import { scrapeWebsite, type ScrapedPage } from "@/lib/scrape"
import { extractBrandProfile, formatBrandProfileMarkdown } from "@/lib/ai/prompts/brand-profile"
import { notify } from "@/lib/notifications"

export async function runWebsiteScrape(brandId: string) {
  const user = await requireRole("strategist")
  const supabase = await createSupabaseServerClient()
  const { data: brand } = await supabase
    .from("brands")
    .select("id, slug, name, website_url, tone_of_voice, target_audience")
    .eq("id", brandId)
    .single()
  if (!brand || !brand.website_url) throw new Error("Brand has no website URL")

  await supabase.from("brands").update({ scrape_status: "running" }).eq("id", brandId)

  let pages: ScrapedPage[] = []
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

  // Replace previous scraped pages for this brand to avoid duplicates.
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

  // AI brand-profile extraction. Only runs if an AI key is configured.
  // Failure here is non-fatal: scraped pages already landed.
  const aiKeyPresent = !!(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY)
  let profileGenerated = false
  if (aiKeyPresent) {
    try {
      const profile = await extractBrandProfile({
        brandName: brand.name as string,
        websiteUrl: brand.website_url as string,
        pages,
      })
      const markdown = formatBrandProfileMarkdown(profile)

      // Replace any prior auto-generated profile for this brand.
      await supabase
        .from("knowledge_items")
        .delete()
        .eq("brand_id", brandId)
        .eq("source_type", "brand_guide")
        .eq("title", "Brand profile (auto-extracted)")

      await supabase.from("knowledge_items").insert({
        brand_id: brandId,
        source_type: "brand_guide",
        title: "Brand profile (auto-extracted)",
        content: markdown,
        source_url: brand.website_url,
        review_status: "approved",
        added_by_user_id: user.id,
      })

      // Backfill the brand record's tone + audience fields if empty.
      const updates: Record<string, string> = {}
      if (!brand.tone_of_voice && profile.tone_of_voice) updates.tone_of_voice = profile.tone_of_voice
      if (!brand.target_audience && profile.target_audience) updates.target_audience = profile.target_audience
      if (Object.keys(updates).length > 0) {
        await supabase.from("brands").update(updates).eq("id", brandId)
      }

      profileGenerated = true
    } catch (err) {
      console.error("[scrape] brand profile extraction failed:", err)
    }
  }

  await supabase.from("brands").update({ scrape_status: "done" }).eq("id", brandId)

  await recordAudit({
    userId: user.id,
    brandId,
    entityType: "brand",
    entityId: brandId,
    action: "scrape_website",
    meta: { pages: pages.length, profile_generated: profileGenerated },
  })

  // Tell the strategist who kicked it off that the bank is ready to use.
  // We loop back to them specifically because the scrape can take a while
  // and they may have moved on to other work.
  await notify({
    recipients: [user.id],
    kind: "scrape_complete",
    title: `${brand.name as string}'s knowledge bank is ready`,
    body: profileGenerated
      ? `Scraped ${pages.length} pages and auto-extracted a brand profile.`
      : `Scraped ${pages.length} pages.`,
    link: `/brands/${brand.slug}/knowledge`,
    brandId,
    entityType: "brand",
    entityId: brandId,
    actorUserId: user.id,
  })

  revalidatePath(`/brands/${brand.slug}`)
  revalidatePath(`/brands/${brand.slug}/knowledge`)
}
