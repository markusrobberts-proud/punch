"use server"

import { fetchLatestDeployment, type DeploymentStatus } from "@/lib/deployment-status"
import { getUser } from "@/lib/auth"

/**
 * Polled by the deployment banner on the client every ~10s. We bypass the
 * unstable_cache used for server-render so the response reflects the very
 * latest Vercel state, and we still gate by super_admin so a normal user
 * can't probe the project's deploy history.
 */
export async function pollDeploymentStatus(): Promise<DeploymentStatus | null> {
  const user = await getUser()
  if (!user || user.actualRole !== "super_admin") return null
  return fetchLatestDeployment()
}
