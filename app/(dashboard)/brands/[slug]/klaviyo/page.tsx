import { notFound } from "next/navigation"
import { requireApprovedUser } from "@/lib/auth"
import { getBrandBySlug } from "@/lib/brands"
import { ComingSoon } from "@/components/layout/coming-soon"

export default async function BrandKlaviyoPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  // Route-guard: any approved user with access to this brand can land here,
  // including clients. Once Klaviyo is wired up this is where flows,
  // campaigns, and recommendations for this specific brand will live.
  await requireApprovedUser()
  const { slug } = await params
  const brand = await getBrandBySlug(slug)
  if (!brand) notFound()

  return (
    <ComingSoon
      eyebrow="Coming soon"
      title={`${brand.name} Performance`}
      description="Live Klaviyo performance for this brand: which flows are earning, which campaigns are winning, and what to do next. We're connecting Klaviyo now and this page will fill in the moment it's hooked up."
      features={[
        "Active flows ranked by revenue, with health flags",
        "Recent campaign results: opens, clicks, revenue, unsubs",
        "Month-on-month and year-on-year comparisons",
        "AI recommendations tied to your strategy and brand voice",
      ]}
    />
  )
}
