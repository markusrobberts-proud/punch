import { ComingSoon } from "@/components/layout/coming-soon"

export default function CalendarPage() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="Unified Campaign Calendar"
      description="One calendar across every brand you work on: see what's going out this week, what's stuck in review, and where the gaps are. Until it lands, open a brand from the Brands page to see its calendar."
      features={[
        "Filter by brand, status, format, or owner",
        "Spot scheduling clashes between brands at a glance",
        "Jump straight into any plan, brief, or email",
        "Drag to reschedule once a calendar is approved",
      ]}
    />
  )
}
