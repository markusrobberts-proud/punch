import { Sidebar } from "./sidebar"
import { ViewAsBanner } from "./view-as-banner"
import { DeploymentBanner } from "./deployment-banner"
import { WelcomeTour } from "./welcome-tour"
import { initialsFromName } from "@/components/ui/avatar"
import type { AppUser } from "@/lib/auth"
import { listNotifications, unreadCount } from "@/lib/notifications"
import { tourFor } from "@/lib/welcome-tour"
import { createSupabaseServerClient } from "@/lib/supabase/server"

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

  // Seed the notification bell with first-paint data + check whether to
  // pop the welcome tour. Parallelised so first paint stays fast.
  const supabase = await createSupabaseServerClient()
  const [initialNotifications, initialUnread, welcomeRow] = await Promise.all([
    listNotifications(user.id, 30),
    unreadCount(user.id),
    supabase.from("users").select("welcome_seen_at").eq("id", user.id).maybeSingle(),
  ])

  // Only show the tour when their actual role matches their effective
  // role: super admins viewing as another role should keep the tour
  // dismissed so their preview isn't interrupted. Steps come from the
  // effective role's tour so the preview is honest.
  // If 0008_welcome_seen.sql hasn't been applied yet the column doesn't
  // exist, the query errors, and we treat them as "seen" so we don't spam
  // the modal on every page load. Run the migration to enable the tour.
  const hasSeen = welcomeRow.error ? true : !!welcomeRow.data?.welcome_seen_at
  const isViewingAs = user.viewingAs !== null
  const tour = tourFor(user.role)
  const shouldShowTour = !hasSeen && !isViewingAs && tour.steps.length > 0

  return (
    <div className="min-h-screen flex flex-col">
      {showDeployBanner && <DeploymentBanner />}
      {user.viewingAs && <ViewAsBanner role={user.viewingAs} />}
      <div className="flex flex-1 min-h-0">
        <Sidebar
          role={user.role}
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
      {shouldShowTour && (
        <WelcomeTour
          intro={tour.intro}
          steps={tour.steps}
          roleLabel={user.role.replace(/_/g, " ")}
        />
      )}
    </div>
  )
}
