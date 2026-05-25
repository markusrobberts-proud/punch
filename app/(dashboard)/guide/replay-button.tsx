"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WelcomeTour } from "@/components/layout/welcome-tour"
import type { TourStep } from "@/lib/welcome-tour"

/**
 * Pops the welcome tour right here on /guide, without a navigation or
 * cache invalidation dance. Modal is locally controlled so the dismiss
 * just hides it again instead of writing to the DB.
 *
 * The DB flag (welcome_seen_at) is left alone on replay because the
 * user has already seen the tour; this is just a re-watch.
 */
export function ReplayTourButton({
  intro,
  steps,
  roleLabel,
}: {
  intro: string
  steps: TourStep[]
  roleLabel: string
}) {
  const [showing, setShowing] = useState(false)

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setShowing(true)}>
        <Play /> Replay tour
      </Button>
      {showing && (
        <WelcomeTour
          intro={intro}
          steps={steps}
          roleLabel={roleLabel}
          onDismiss={() => setShowing(false)}
        />
      )}
    </>
  )
}
