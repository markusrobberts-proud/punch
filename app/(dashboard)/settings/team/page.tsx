import { requireRole } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, initialsFromName } from "@/components/ui/avatar"
import { PageHeader, PageShell } from "@/components/layout/page-header"
import { InviteUserForm } from "./invite-form"
import { RoleSelect } from "./role-select"

type UserRow = {
  id: string
  email: string
  display_name: string | null
  role: "super_admin" | "admin" | "strategist" | "designer" | "viewer" | "pending"
  created_at: string
}

const ROLE_COLOURS: Record<string, string> = {
  super_admin: "#0A4B91",
  admin: "#1D1D1F",
  strategist: "#2D4F6B",
  designer: "#8B5A2B",
  viewer: "#6E6E73",
  pending: "#B45309",
}

export default async function TeamPage() {
  const admin = await requireRole("admin")
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("users")
    .select("id,email,display_name,role,created_at")
    .order("created_at", { ascending: true })
  const users = (data ?? []) as UserRow[]
  const pendingCount = users.filter((u) => u.role === "pending").length

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="Team"
        description="Invite teammates, change roles, deactivate accounts."
        actions={
          pendingCount > 0 ? (
            <Badge variant="warning">{pendingCount} pending</Badge>
          ) : undefined
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Invite a teammate</CardTitle>
          <CardDescription>
            They get a magic-link sign-in. With no service-role key set, the form will surface a link you can share manually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteUserForm />
        </CardContent>
      </Card>

      <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-3">Members</div>
      <Card>
        <CardContent className="p-0">
          {users.map((u, idx) => (
            <div
              key={u.id}
              className={`flex items-center justify-between gap-3 px-5 py-3.5 ${
                idx === users.length - 1 ? "" : "border-b border-[#E5E5EA]"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  initials={initialsFromName(u.display_name ?? u.email)}
                  color={ROLE_COLOURS[u.role]}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">
                    {u.display_name || u.email.split("@")[0]}
                    {u.id === admin.id && <span className="text-[11px] text-[#86868B] ml-2">(you)</span>}
                  </div>
                  <div className="text-[12px] text-[#86868B] truncate">{u.email}</div>
                </div>
              </div>
              <RoleSelect
                userId={u.id}
                currentRole={u.role}
                isSelf={u.id === admin.id}
                canAssignSuperAdmin={admin.actualRole === "super_admin"}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  )
}
