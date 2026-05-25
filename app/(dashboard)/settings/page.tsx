import Link from "next/link"
import { ArrowRight, Users, ListChecks, KeyRound } from "lucide-react"
import { requireApprovedUser } from "@/lib/auth"
import { canManageUsers, canViewAs } from "@/lib/rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader, PageShell } from "@/components/layout/page-header"
import { ViewAsCard } from "./view-as-card"
// Email digests are parked for now. To re-enable: uncomment the
// DigestCard import + render below, restore the crons block in
// vercel.json, and make sure RESEND_API_KEY + CRON_SECRET are set.
// import { DigestCard } from "./digest-card"

export default async function SettingsPage() {
  const user = await requireApprovedUser()
  const isAdmin = canManageUsers(user.actualRole)
  const isSuper = canViewAs(user.actualRole)

  return (
    <PageShell>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your account, your team, and what the platform connects to."
      />

      {isSuper && (
        <div className="mb-8">
          <ViewAsCard
            currentViewAs={
              (user.viewingAs as "admin" | "strategist" | "designer" | "viewer" | null) ?? null
            }
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
            <CardDescription>Signed in as {user.email}</CardDescription>
          </CardHeader>
          <CardContent className="text-[13px]">
            <Row label="Display name" value={user.displayName ?? "–"} />
            <Row
              label="Role"
              value={
                <span className="inline-flex items-center gap-2">
                  <span className="capitalize">{user.actualRole.replace(/_/g, " ")}</span>
                  {user.viewingAs && <Badge variant="info">viewing as {user.viewingAs}</Badge>}
                </span>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sign-in</CardTitle>
            <CardDescription>Clerk handles sessions. Google SSO + email magic link.</CardDescription>
          </CardHeader>
          <CardContent className="text-[13px] text-[#6E6E73]">
            <p className="leading-relaxed">
              Sign out from the top right when you're done. Your session refreshes silently in the background.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Email digest card parked. See note at top of file. */}

      {isAdmin && (
        <>
          <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-3 mt-10">
            Admin
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SettingsTile
              href="/settings/team"
              icon={<Users className="size-4 text-[#6E6E73]" />}
              title="Team"
              description="Promote teammates and assign roles."
            />
            <SettingsTile
              href="/settings/audit"
              icon={<ListChecks className="size-4 text-[#6E6E73]" />}
              title="Audit log"
              description="Every mutation, last 200 entries."
            />
            <SettingsTile
              href="#"
              icon={<KeyRound className="size-4 text-[#6E6E73]" />}
              title="Integrations"
              description="Asana, Resend, AI keys"
              badge="Soon"
              disabled
            />
          </div>
        </>
      )}
    </PageShell>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b last:border-0 border-[#E5E5EA]">
      <span className="text-[#86868B]">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function SettingsTile({
  href,
  icon,
  title,
  description,
  badge,
  disabled,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  badge?: string
  disabled?: boolean
}) {
  const inner = (
    <Card hoverable={!disabled} className={disabled ? "opacity-60" : ""}>
      <CardContent className="p-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#F5F5F7] flex items-center justify-center shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[13px] flex items-center gap-2">
            {title}
            {badge && <Badge variant="neutral">{badge}</Badge>}
          </div>
          <div className="text-[12px] text-[#6E6E73] mt-0.5 leading-snug">{description}</div>
        </div>
        {!disabled && <ArrowRight className="size-4 text-[#C7C7CC] shrink-0" />}
      </CardContent>
    </Card>
  )

  return disabled ? inner : <Link href={href} className="block">{inner}</Link>
}
