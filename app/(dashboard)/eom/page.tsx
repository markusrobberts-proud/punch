import { ComingSoon } from "@/components/layout/coming-soon"

export default function EomPage() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="End-of-Month Reports"
      description="Live Klaviyo performance per brand, with Claude writing the narrative: what worked, what to repeat, what to retire. We're wiring up the Klaviyo integration first, then this page lights up."
      features={[
        "Revenue, opens, clicks, and unsubs pulled live from Klaviyo",
        "Side-by-side comparison against last month and last year",
        "Claude-written narrative for each brand, in plain English",
        "Recommendations rolled into next month's plan automatically",
      ]}
    />
  )
}
