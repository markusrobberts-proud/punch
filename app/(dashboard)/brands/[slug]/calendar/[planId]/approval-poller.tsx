"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { checkApprovalActivity } from "./approval-poller-actions"

/**
 * Small client component that polls the plan's approval activity every
 * 8 seconds. When a new action lands (count changed since last reading),
 * it triggers a router refresh so the email rows render the fresh status,
 * and flashes a transient "new client activity" toast pinned bottom-right.
 *
 * Only mounted when the plan has at least one share link, to avoid useless
 * polling for plans nobody's shared yet.
 */
export function ApprovalPoller({ planId, initialCount }: { planId: string; initialCount: number }) {
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)
  const lastCount = useRef(initialCount)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    async function tick() {
      try {
        const ping = await checkApprovalActivity(planId)
        if (cancelled) return
        if (ping.count !== lastCount.current) {
          const delta = ping.count - lastCount.current
          lastCount.current = ping.count
          if (delta > 0) {
            setToast(`${delta} new client ${delta === 1 ? "action" : "actions"}`)
            setTimeout(() => setToast(null), 4000)
          }
          router.refresh()
        }
      } catch {
        // Soft-fail. Keep polling.
      } finally {
        if (!cancelled) timer = setTimeout(tick, 8000)
      }
    }

    timer = setTimeout(tick, 8000)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [planId, router])

  if (!toast) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 fade-in">
      <div className="glass-strong rounded-xl px-4 py-3 flex items-center gap-2 text-[13px] font-medium">
        <MessageCircle className="size-4 text-[#007AFF]" />
        {toast}
      </div>
    </div>
  )
}
