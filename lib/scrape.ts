/**
 * Lightweight website crawler.
 * Fetches the homepage + a few top-level links from the same origin,
 * strips HTML to readable text, and returns an array of pages.
 *
 * Intentionally minimal — no external service dependency. For richer
 * extraction, swap in Firecrawl or a headless browser later.
 */

const MAX_PAGES = 6
const MAX_BYTES = 1_500_000
const FETCH_TIMEOUT_MS = 12_000

export type ScrapedPage = {
  url: string
  title: string
  text: string
}

export async function scrapeWebsite(rootUrl: string): Promise<ScrapedPage[]> {
  const root = normaliseUrl(rootUrl)
  if (!root) return []

  const pages: ScrapedPage[] = []
  const visited = new Set<string>()
  const queue: string[] = [root.href]

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const url = queue.shift()!
    if (visited.has(url)) continue
    visited.add(url)

    const fetched = await tryFetch(url)
    if (!fetched) continue

    const { html, finalUrl } = fetched
    const title = extractTitle(html) || finalUrl
    const text = extractReadableText(html)
    if (text.length > 200) {
      pages.push({ url: finalUrl, title, text: text.slice(0, 60_000) })
    }

    if (pages.length === 1) {
      const sameOriginLinks = extractSameOriginLinks(html, root.origin)
      for (const link of sameOriginLinks) {
        if (!visited.has(link) && queue.length + pages.length < MAX_PAGES + 2) queue.push(link)
      }
    }
  }

  return pages
}

function normaliseUrl(u: string): URL | null {
  try {
    const trimmed = u.trim()
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    return new URL(withScheme)
  } catch {
    return null
  }
}

async function tryFetch(url: string): Promise<{ html: string; finalUrl: string } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "ProudEmailOS-Scraper/0.1 (+https://proudemail.studio)" },
      signal: controller.signal,
    })
    if (!res.ok) return null
    const ctype = res.headers.get("content-type") ?? ""
    if (!ctype.includes("text/html")) return null
    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_BYTES) return null
    return { html: new TextDecoder("utf-8").decode(buf), finalUrl: res.url }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? decodeEntities(stripTags(m[1])).trim().slice(0, 240) : null
}

function extractReadableText(html: string): string {
  const noScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
  const stripped = stripTags(noScripts)
  return decodeEntities(stripped).replace(/\s+/g, " ").trim()
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ")
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function extractSameOriginLinks(html: string, origin: string): string[] {
  const hrefs = new Set<string>()
  const re = /<a\s+[^>]*href=["']([^"'#]+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    try {
      const u = new URL(m[1], origin)
      if (u.origin !== origin) continue
      // Skip obvious non-content links
      if (/\/(login|signin|signup|account|cart|checkout|api|wp-admin)\b/i.test(u.pathname)) continue
      if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|css|js)$/i.test(u.pathname)) continue
      u.hash = ""
      hrefs.add(u.toString())
    } catch {
      // ignore malformed
    }
  }
  return Array.from(hrefs).slice(0, 8)
}
