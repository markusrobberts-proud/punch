import { getDeploymentStatus } from "@/lib/deployment-status"
import { DeploymentBannerView } from "./deployment-banner-view"

/**
 * Server entry point: renders the initial state on first paint so the banner
 * is in the HTML response. The view component then polls every 10s on the
 * client to keep up with new deploys without requiring a navigation.
 */
export async function DeploymentBanner() {
  const initial = await getDeploymentStatus()
  if (!initial) return null
  return <DeploymentBannerView initial={initial} />
}
