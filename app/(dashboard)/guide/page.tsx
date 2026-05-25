import Link from "next/link"
import {
  Sparkles,
  Calendar,
  BookOpen,
  Users,
  Bell,
  Shield,
  FileText,
  Compass,
  Eye,
  Mail,
  ArrowRight,
} from "lucide-react"
import { requireApprovedUser } from "@/lib/auth"
import { tourFor, type TourStep } from "@/lib/welcome-tour"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader, PageShell } from "@/components/layout/page-header"
import { ReplayTourButton } from "./replay-button"

const ICONS: Record<TourStep["icon"], React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  calendar: Calendar,
  bookopen: BookOpen,
  users: Users,
  bell: Bell,
  shield: Shield,
  filetext: FileText,
  compass: Compass,
  eye: Eye,
  mail: Mail,
}

/**
 * Always-available reference. Shows the same content the welcome tour
 * walks through, in a scannable layout the user can search and revisit.
 * Strategists send this URL to teammates as the official "how PUNCH works".
 */
export default async function GuidePage() {
  const user = await requireApprovedUser()
  const tour = tourFor(user.role)

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        eyebrow="How to use PUNCH"
        title={`Welcome, ${user.displayName ?? user.email.split("@")[0]}`}
        description={tour.intro}
        actions={
          tour.steps.length > 0 ? (
            <ReplayTourButton
              intro={tour.intro}
              steps={tour.steps}
              roleLabel={user.role.replace(/_/g, " ")}
            />
          ) : undefined
        }
      />

      <div className="space-y-4">
        {tour.steps.map((step, i) => {
          const Icon = ICONS[step.icon]
          return (
            <Card key={i}>
              <CardContent className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#007AFF] flex items-center justify-center shrink-0">
                  <Icon className="size-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold tracking-display">{step.title}</h3>
                  <p className="text-[13.5px] text-[#1D1D1F] mt-1.5 leading-relaxed">{step.body}</p>
                  {step.cta && (
                    <Link
                      href={step.cta.href}
                      className="inline-flex items-center gap-1 mt-3 text-[13px] font-medium text-[#007AFF] hover:underline"
                    >
                      {step.cta.label} <ArrowRight className="size-3.5" />
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mt-10 pt-6 border-t border-[#E5E5EA] text-[12.5px] text-[#86868B]">
        Want a different angle? Ask anyone on the team or open Settings → Audit log to see what's been happening across the platform.
      </div>
    </PageShell>
  )
}
