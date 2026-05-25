import { GitBranch, ExternalLink } from "lucide-react"
import { getDeploymentStatus, deploymentStateLabel, shortRelativeTime } from "@/lib/deployment-status"

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

export async function DeploymentBanner() {
  const status = await getDeploymentStatus()
  if (!status) return null

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
