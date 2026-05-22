import { requireRole } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InviteUserForm } from "./invite-form"
import { RoleSelect } from "./role-select"

type UserRow = {
  id: string
  email: string
  display_name: string | null
  role: "admin" | "strategist" | "designer" | "viewer" | "pending"
  created_at: string
}

export default async function TeamPage() {
  const admin = await requireRole("admin")
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("users")
    .select("id,email,display_name,role,created_at")
    .order("created_at", { ascending: true })
  const users = (data ?? []) as UserRow[]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invite teammates and assign roles. New signups land as `pending` — promote them here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite a teammate</CardTitle>
          <CardDescription>
            They'll get a magic-link sign-in. If no service role key is set in env, you'll see a link to share manually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteUserForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0 border-border/60">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {u.display_name || u.email.split("@")[0]}
                    {u.id === admin.id && <span className="text-xs text-muted-foreground ml-2">(you)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
                <RoleSelect userId={u.id} currentRole={u.role} isSelf={u.id === admin.id} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
