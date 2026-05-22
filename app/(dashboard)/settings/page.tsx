import Link from "next/link"
import { requireApprovedUser } from "@/lib/auth"
import { canManageUsers } from "@/lib/rbac"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function SettingsPage() {
  const user = await requireApprovedUser()
  const isAdmin = canManageUsers(user.role)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Account, team and integrations.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your account</CardTitle>
          <CardDescription>Signed in as {user.email}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Display name</span>
            <span>{user.displayName ?? "—"}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Role</span>
            <span className="capitalize">{user.role}</span>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <>
          <Link href="/settings/team" className="block">
            <Card className="glass hover:bg-white/90 transition-colors">
              <CardHeader>
                <CardTitle className="text-base">Team</CardTitle>
                <CardDescription>Invite teammates, change roles, deactivate users.</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/settings/audit" className="block">
            <Card className="glass hover:bg-white/90 transition-colors">
              <CardHeader>
                <CardTitle className="text-base">Audit log</CardTitle>
                <CardDescription>Every mutation across the platform.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </>
      )}
    </div>
  )
}
