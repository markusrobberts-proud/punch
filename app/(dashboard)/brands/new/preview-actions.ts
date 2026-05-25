"use server"

import { z } from "zod"
import { requireRole } from "@/lib/rbac"
import { scrapeWebsite } from "@/lib/scrape"
import { extractBrandProfile, formatBrandProfileMarkdown, type BrandProfile } from "@/lib/ai/prompts/brand-profile"

const PreviewSchema = z.object({
  websiteUrl: z.string().min(1),
  brandName: z.string().max(120).optional().or(z.literal("")),
})

export type BrandPreviewResult =
  | {
      ok: true
      pages: number
      profile: BrandProfile
      profileMarkdown: string
      pageSummaries: Array<{ url: string; title: string }>
    }
  | { ok: false; error: string }

function normaliseUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/**
 * Scrape + AI-extract a brand profile from a public URL, WITHOUT touching
 * the database. The add-brand form uses this to pre-fill its fields before
 * the user commits to creating the brand record.
 */
export async function previewBrandFromUrl(formData: FormData): Promise<BrandPreviewResult> {
  await requireRole("strategist")

  const parsed = PreviewSchema.safeParse({
    websiteUrl: formData.get("websiteUrl"),
    brandName: formData.get("brandName") ?? "",
  })
  if (!parsed.success) return { ok: false, error: "Enter a website URL." }

  const url = normaliseUrl(parsed.data.websiteUrl)
  try {
    new URL(url)
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." }
  }

  let pages
  try {
    pages = await scrapeWebsite(url)
  } catch (err) {
    return { ok: false, error: `Couldn't fetch the site: ${(err as Error).message}` }
  }
  if (pages.length === 0) {
    return { ok: false, error: "Fetched the site but couldn't extract any readable content." }
  }

  const aiKeyPresent = !!(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY)
  if (!aiKeyPresent) {
    return {
      ok: false,
      error: "AI key is not configured. Add ANTHROPIC_API_KEY on Vercel and redeploy to enable auto-fill.",
    }
  }

  try {
    const profile = await extractBrandProfile({
      brandName: parsed.data.brandName || new URL(url).hostname.replace(/^www\./, ""),
      websiteUrl: url,
      pages,
    })
    return {
      ok: true,
      pages: pages.length,
      profile,
      profileMarkdown: formatBrandProfileMarkdown(profile),
      pageSummaries: pages.map((p) => ({ url: p.url, title: p.title || p.url })),
    }
  } catch (err) {
    return { ok: false, error: `AI extraction failed: ${(err as Error).message}` }
  }
}
