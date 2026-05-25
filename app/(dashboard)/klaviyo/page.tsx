import { ComingSoon } from "@/components/layout/coming-soon"

export default function KlaviyoPage() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="Klaviyo Intelligence"
      description="Org-wide view of flows, campaigns, and revenue across every connected brand. Per-brand performance pages land first, then this rolls them up so you can compare and spot patterns."
      features={[
        "All flows across every brand, ranked by revenue and health",
        "Recent campaign performance with winners flagged",
        "AI recommendations: which flows to fix, which to clone",
        "Drill into any brand for the full per-account view",
      ]}
    />
  )
}
