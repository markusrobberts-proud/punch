import { Sidebar } from "./sidebar"
import { ViewAsBanner } from "./view-as-banner"
import { DeploymentBanner } from "./deployment-banner"
import { initialsFromName } from "@/components/ui/avatar"
import type { AppUser } from "@/lib/auth"
import { listNotifications, unreadCount } from "@/lib/notifications"

type Brand = {
  id: string
  slug: string
  name: string
  primary_color: string | null
  website_url: string | null
}

export async function DashboardLayout({
  user,
  brands,
  activeBrandSlug,
  claudeStatus,
  children,
}: {
  user: AppUser
  brands: Brand[]
  activeBrandSlug: string | null
  claudeStatus: { connected: boolean; docs: number; brandName: string | null }
  children: React.ReactNode
}) {
  const showDeployBanner = user.actualRole === "super_admin"

  // Seed the notification bell with first-paint data so it doesn't flash
  // an empty state while the client poller spins up.
  const [initialNotifications, initialUnread] = await Promise.all([
    listNotifications(user.id, 30),
    unreadCount(user.id),
  ])

  return (
    <div className="min-h-screen flex flex-col">
      {showDeployBanner && <DeploymentBanner />}
      {user.viewingAs && <ViewAsBanner role={user.viewingAs} />}
      <div className="flex flex-1 min-h-0">
        <Sidebar
          brands={brands}
          activeBrandSlug={activeBrandSlug}
          userInitials={initialsFromName(user.displayName ?? user.email)}
          claudeStatus={claudeStatus}
          initialNotifications={initialNotifications}
          initialUnread={initialUnread}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  )
}
