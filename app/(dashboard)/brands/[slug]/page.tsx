import { notFound } from "next/navigation"
import Link from "next/link"
import { requireApprovedUser } from "@/lib/auth"
import { canEditStrategy } from "@/lib/rbac"
import { getBrandBySlug } from "@/lib/brands"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrapeButton } from "./scrape-button"

export default async function BrandDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireApprovedUser()
  const { slug } = await params
  const brand = await getBrandBySlug(slug)
  if (!brand) notFound()
  const canEdit = canEditStrategy(user.role)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Brand</div>
          <h1 className="text-2xl font-semibold tracking-tight">{brand.name}</h1>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            {brand.industry && <span>{brand.industry}</span>}
            {brand.website_url && (
              <>
                <span>·</span>
                <a href={brand.website_url} target="_blank" rel="noreferrer" className="hover:underline">
                  {brand.website_url}
                </a>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={brand.scrape_status === "done" ? "success" : "secondary"} className="capitalize">
            Scrape: {brand.scrape_status}
          </Badge>
          {canEdit && brand.website_url && (
            <ScrapeButton brandId={brand.id} status={brand.scrape_status} />
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/brands/${brand.slug}/calendar`}>Open calendar</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard title="Knowledge bank" href={`/brands/${brand.slug}/knowledge`} description="Docs, scraped pages, forwarded emails, notes." />
        <SummaryCard title="Campaign calendar" href={`/brands/${brand.slug}/calendar`} description="Plan, copy, briefs for this brand." />
        <SummaryCard title="Klaviyo" href={`/brands/${brand.slug}/klaviyo`} description="Phase 2C — flows, campaigns, recommendations." />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voice & audience</CardTitle>
          <CardDescription>What Claude leans on for every generation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ValueBlock label="Tone of voice" value={brand.tone_of_voice} />
          <ValueBlock label="Target audience" value={brand.target_audience} />
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ title, href, description }: { title: string; href: string; description: string }) {
  return (
    <Link href={href} className="block">
      <Card className="glass hover:bg-white/90 transition-colors h-full">
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  )
}

function ValueBlock({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <p className="text-sm whitespace-pre-wrap">{value || <span className="text-muted-foreground italic">Not set yet.</span>}</p>
    </div>
  )
}
