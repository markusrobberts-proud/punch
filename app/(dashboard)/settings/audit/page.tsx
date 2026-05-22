import { requireRole } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type AuditRow = {
  id: number
  user_id: string | null
  brand_id: string | null
  entity_type: string
  entity_id: string | null
  action: string
  meta: Record<string, unknown> | null
  created_at: string
}

export default async function AuditLogPage() {
  await requireRole("admin")
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200)
  const rows = (data ?? []) as AuditRow[]

  // Fetch user emails for display
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[]
  const brandIds = Array.from(new Set(rows.map((r) => r.brand_id).filter(Boolean))) as string[]

  const [{ data: users }, { data: brands }] = await Promise.all([
    userIds.length > 0
      ? supabase.from("users").select("id,email,display_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    brandIds.length > 0
      ? supabase.from("brands").select("id,name,slug").in("id", brandIds)
      : Promise.resolve({ data: [] }),
  ])

  const userMap = new Map((users ?? []).map((u: { id: string; email: string; display_name: string | null }) => [u.id, u]))
  const brandMap = new Map((brands ?? []).map((b: { id: string; name: string; slug: string }) => [b.id, b]))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every mutation, last 200 entries. For trust and traceability.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nothing logged yet</CardTitle>
            <CardDescription>Create a brand or generate a calendar to see activity.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const user = row.user_id ? userMap.get(row.user_id) : null
            const brand = row.brand_id ? brandMap.get(row.brand_id) : null
            return (
              <Card key={row.id}>
                <CardContent className="py-3 flex items-center justify-between gap-4 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{user?.display_name || user?.email || "—"}</span>
                      <span className="text-muted-foreground">·</span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{row.action}</code>
                      <span className="text-muted-foreground">on</span>
                      <span className="capitalize">{row.entity_type.replace(/_/g, " ")}</span>
                      {brand && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span>{brand.name}</span>
                        </>
                      )}
                    </div>
                    {row.meta && Object.keys(row.meta).length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1 truncate font-mono">
                        {JSON.stringify(row.meta)}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {new Date(row.created_at).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
