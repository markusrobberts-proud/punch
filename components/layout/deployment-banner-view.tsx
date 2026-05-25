"use client"

import { useEffect, useRef, useState } from "react"
import { GitBranch, ExternalLink } from "lucide-react"
import {
  deploymentStateLabel,
  shortRelativeTime,
  type DeploymentStatus,
} from "@/lib/deployment-status"
import { pollDeploymentStatus } from "./deployment-banner-actions"

const TONE_DOT: Record<string, string> = {
  ready: "bg-[#30D158]",
  building: "bg-[#FFA940] animate-pulse",
  error: "bg-[#FF3B30]",
  neutral: "bg-[#86868B]",
}

const TONE_TEXT: Record<string, string> = {
  ready: "text-[#166D2F]",
  building: "text-[#8B5A00]",
  error: "text-[#A8160C]",
  neutral: "text-[#1D1D1F]",
}

/**
 * Live deployment banner. Re-fetches every 10s while the tab is visible so
 * the banner catches up with a fresh push within a few seconds, and bumps
 * to ~3s while a build is BUILDING/QUEUED so the "Live" flip feels instant.
 * Stops polling when the tab is hidden to avoid wasted Vercel API calls.
 */
export function DeploymentBannerView({ initial }: { initial: DeploymentStatus }) {
  const [status, setStatus] = useState<DeploymentStatus>(initial)
  // Tick every second so the relative-time label stays honest even when
  // the underlying status hasn't changed.
  const [, setTick] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    function intervalFor(state: DeploymentStatus["state"]) {
      // Tighter loop while a build is in flight; otherwise back off.
      if (state === "BUILDING" || state === "QUEUED" || state === "INITIALIZING") return 3000
      return 10000
    }

    async function tick() {
      if (document.hidden) {
        // Skip the network round-trip while hidden; reschedule cheap.
        if (!cancelled) timerRef.current = setTimeout(tick, 4000)
        return
      }
      try {
        const next = await pollDeploymentStatus()
        if (!cancelled && next) setStatus(next)
      } catch {
        // Soft-fail. Keep polling.
      }
      if (!cancelled) timerRef.current = setTimeout(tick, intervalFor(status.state))
    }

    timerRef.current = setTimeout(tick, intervalFor(status.state))
    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [status.state])

  // Lightweight 1s clock for the "Xs ago" label.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const { label, tone } = deploymentStateLabel(status.state)
  const sha = status.commitSha?.slice(0, 7)
  const age = status.createdAt ? shortRelativeTime(status.createdAt) : null
  const href = status.inspectorUrl ?? "#"

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="w-full bg-white/70 backdrop-blur-md border-b border-[#E5E5EA] px-6 py-1.5 flex items-center justify-center gap-3 text-[11.5px] hover:bg-white transition group"
    >
      <span className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[tone]}`} />
        <span className={`font-medium ${TONE_TEXT[tone]}`}>{label}</span>
      </span>
      {sha && (
        <span className="flex items-center gap-1 text-[#6E6E73]">
          <GitBranch className="size-3" />
          <code className="text-[10.5px] font-mono">{sha}</code>
        </span>
      )}
      {status.commitMessage && (
        <span className="text-[#86868B] truncate max-w-[420px] hidden sm:inline">
          {status.commitMessage.split("\n")[0]}
        </span>
      )}
      {age && <span className="text-[#86868B]">· {age}</span>}
      <ExternalLink className="size-3 text-[#C7C7CC] opacity-0 group-hover:opacity-100 transition" />
    </a>
  )
}
