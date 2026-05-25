import { unstable_cache } from "next/cache"

export type DeploymentStatus = {
  state: "READY" | "BUILDING" | "INITIALIZING" | "QUEUED" | "ERROR" | "CANCELED" | "UNKNOWN"
  url: string | null
  /** Inspector URL (Vercel dashboard for this deploy). */
  inspectorUrl: string | null
  commitSha: string | null
  commitMessage: string | null
  createdAt: number | null
  /** True when this is the deployment currently aliased to production. */
  isProduction: boolean
}

type VercelDeployment = {
  uid: string
  state?: DeploymentStatus["state"]
  readyState?: DeploymentStatus["state"]
  url?: string
  inspectorUrl?: string
  meta?: { githubCommitSha?: string; githubCommitMessage?: string }
  target?: string
  createdAt?: number
}

async function fetchLatestDeployment(): Promise<DeploymentStatus | null> {
  const token = process.env.VERCEL_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  const teamId = process.env.VERCEL_TEAM_ID
  if (!token || !projectId) return null

  const params = new URLSearchParams({
    projectId,
    limit: "1",
    target: "production",
  })
  if (teamId) params.set("teamId", teamId)

  try {
    const res = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const json = (await res.json()) as { deployments?: VercelDeployment[] }
    const d = json.deployments?.[0]
    if (!d) return null

    return {
      state: (d.state ?? d.readyState ?? "UNKNOWN") as DeploymentStatus["state"],
      url: d.url ? `https://${d.url}` : null,
      inspectorUrl: d.inspectorUrl ?? null,
      commitSha: d.meta?.githubCommitSha ?? null,
      commitMessage: d.meta?.githubCommitMessage ?? null,
      createdAt: d.createdAt ?? null,
      isProduction: d.target === "production",
    }
  } catch {
    return null
  }
}

/**
 * 30-second cache: shaves load on the Vercel API + keeps the status fresh
 * enough to feel live without spamming.
 */
export const getDeploymentStatus = unstable_cache(
  fetchLatestDeployment,
  ["deployment-status"],
  { revalidate: 30, tags: ["deployment-status"] },
)

export function deploymentStateLabel(state: DeploymentStatus["state"]): {
  label: string
  tone: "ready" | "building" | "error" | "neutral"
} {
  switch (state) {
    case "READY":
      return { label: "Live", tone: "ready" }
    case "BUILDING":
    case "INITIALIZING":
    case "QUEUED":
      return { label: "Deploying", tone: "building" }
    case "ERROR":
    case "CANCELED":
      return { label: "Deploy failed", tone: "error" }
    default:
      return { label: state, tone: "neutral" }
  }
}

export function shortRelativeTime(ms: number): string {
  const diff = Math.max(0, Date.now() - ms)
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}
