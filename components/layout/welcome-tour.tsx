"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TourStep } from "@/lib/welcome-tour"
import { dismissWelcomeTour } from "./welcome-tour-actions"

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
 * Full-screen overlay that walks a new user through what they can do.
 * Closes when they finish or skip; mark-seen happens server-side so it
 * doesn't pop again on the next page load.
 */
export function WelcomeTour({
  intro,
  steps,
  roleLabel,
  /**
   * When provided, dismiss closes the modal via this callback instead of
   * writing welcome_seen_at server-side. The Replay button on /guide
   * passes this so a replay doesn't redundantly stamp the user's record.
   */
  onDismiss,
}: {
  intro: string
  steps: TourStep[]
  roleLabel: string
  onDismiss?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [index, setIndex] = useState(0)
  const [, startTransition] = useTransition()

  if (!open || steps.length === 0) return null
  const step = steps[index]
  const isLast = index === steps.length - 1
  const Icon = ICONS[step.icon]

  function dismiss() {
    setOpen(false)
    if (onDismiss) {
      onDismiss()
      return
    }
    startTransition(async () => {
      await dismissWelcomeTour()
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 fade-in">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={dismiss} />

      <div className="relative w-full max-w-[520px] bg-white rounded-2xl card-shadow-hover overflow-hidden">
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 w-7 h-7 rounded-md text-[#86868B] hover:bg-[#F5F5F7] flex items-center justify-center transition"
          aria-label="Skip tour"
        >
          <X className="size-4" />
        </button>

        {index === 0 && (
          <div className="px-7 pt-7 pb-3">
            <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
              Welcome, {roleLabel}
            </div>
            <p className="text-[13.5px] text-[#1D1D1F] mt-1 leading-relaxed">{intro}</p>
          </div>
        )}

        <div className="px-7 pt-3 pb-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#007AFF] flex items-center justify-center shrink-0">
              <Icon className="size-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[20px] font-semibold tracking-display leading-tight">{step.title}</h2>
              <p className="text-[14px] text-[#1D1D1F] mt-2 leading-relaxed">{step.body}</p>
              {step.cta && (
                <Link
                  href={step.cta.href}
                  onClick={dismiss}
                  className="inline-flex items-center gap-1 mt-3 text-[13px] font-medium text-[#007AFF] hover:underline"
                >
                  {step.cta.label} <ArrowRight className="size-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="px-7 py-4 border-t border-[#E5E5EA] bg-[#FAFAFB] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition",
                  i === index ? "bg-[#1D1D1F]" : "bg-[#D2D2D7]",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setIndex((i) => i - 1)}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={dismiss}>
                Got it
              </Button>
            ) : (
              <Button size="sm" onClick={() => setIndex((i) => i + 1)}>
                Next <ArrowRight />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
