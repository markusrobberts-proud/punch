import { Sparkles, Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { PageShell } from "@/components/layout/page-header"

/**
 * Single, consistent "this surface isn't ready yet" screen.
 *
 * Used for any route that exists in the nav but doesn't have a real
 * implementation yet. Keeps the Apple-OS aesthetic of the rest of the
 * dashboard: glass card, soft type, blue accent on the eyebrow, and a
 * grounded sign-off so the user knows where to look when it lands.
 */
export function ComingSoon({
  title,
  eyebrow,
  description,
  features,
  note,
}: {
  /** Page title, e.g. "End-of-Month Reports". */
  title: string
  /** Optional small label above the title. Skip for client-facing surfaces where roadmap labels add noise. */
  eyebrow?: string
  /** One or two sentences describing what this page will do when it ships. */
  description: string
  /** Optional bullets of what's planned. Render up to ~5. */
  features?: string[]
  /** Optional override for the sign-off line. Defaults to the standard "check the bell" message. */
  note?: string
}) {
  const signOff =
    note ?? "We're building this next. Check the bell, we'll let you know when it lands."

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto pt-10">
        <Card variant="glass">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] flex items-center justify-center shrink-0">
                <Sparkles className="size-5 text-[#007AFF]" />
              </div>
              <div className="min-w-0 flex-1">
                {eyebrow && (
                  <div className="text-[11px] uppercase tracking-wider text-[#007AFF] mb-1.5">
                    {eyebrow}
                  </div>
                )}
                <h1 className="text-[26px] font-semibold tracking-display leading-tight">
                  {title}
                </h1>
                <p className="text-[14.5px] text-[#6E6E73] mt-3 leading-relaxed">
                  {description}
                </p>
              </div>
            </div>

            {features && features.length > 0 && (
              <div className="mt-7 pt-6 border-t border-[#E5E5EA]">
                <div className="text-[11px] uppercase tracking-wider text-[#86868B] mb-3">
                  What's planned
                </div>
                <ul className="space-y-2.5">
                  {features.slice(0, 5).map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-[13.5px] text-[#1D1D1F]">
                      <Check className="size-4 text-[#34C759] shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-7 pt-5 border-t border-[#E5E5EA]">
              <p className="text-[12.5px] text-[#86868B] leading-relaxed">{signOff}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
