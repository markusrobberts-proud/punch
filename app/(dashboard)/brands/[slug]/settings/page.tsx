import { notFound } from "next/navigation"
import { requireApprovedUser } from "@/lib/auth"
import { canEditStrategy, canManageUsers } from "@/lib/rbac"
import { getBrandBySlug } from "@/lib/brands"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader, PageShell } from "@/components/layout/page-header"
import { EditBrandForm } from "./edit-brand-form"
import { DangerZone } from "./danger-zone"
import { BrandMembers } from "./brand-members"

type BrandRow = {
  id: string
  slug: string
  name: string
  website_url: string | null
  industry: string | null
  contact_name: string | null
  contact_email: string | null
  primary_color: string | null
  secondary_color: string | null
  font_heading: string | null
  font_body: string | null
  tone_of_voice: string | null
  target_audience: string | null
  prefer_brand_over_strategy: boolean | null
  auto_ingest_forwarded_emails: boolean | null
  inbox_alias: string | null
}

export default async function BrandSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireApprovedUser()
  const { slug } = await params
  const brand = (await getBrandBySlug(slug)) as BrandRow | null
  if (!brand) notFound()

  const canEdit = canEditStrategy(user.role)
  const isAdmin = canManageUsers(user.role)

  return (
    <PageShell className="max-w-3xl">
      <PageHeader
        eyebrow={brand.name}
        title="Settings"
        description="Edit the brand fields Claude reads on every generation. Changes apply immediately to the next calendar, copy, or brief."
      />

      <Card>
        <CardHeader>
          <CardTitle>Brand details</CardTitle>
          <CardDescription>All fields are optional except name.</CardDescription>
        </CardHeader>
        <CardContent>
          <EditBrandForm brand={brand} canEdit={canEdit} />
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="mt-8 space-y-8">
          <BrandMembersPanel brandId={brand.id} brandSlug={brand.slug} />
          <DangerZone brandId={brand.id} brandSlug={brand.slug} brandName={brand.name} />
        </div>
      )}
    </PageShell>
  )
}

/**
 * Server-rendered panel that loads brand_members + candidate users and
 * hands them to the client component. Kept inline because it's tightly
 * coupled to the brand-settings page layout.
 */
async function BrandMembersPanel({ brandId, brandSlug }: { brandId: string; brandSlug: string }) {
  const supabase = await createSupabaseServerClient()
  const { data: memberRows } = await supabase
    .from("brand_members")
    .select("user_id, role, users(display_name, email)")
    .eq("brand_id", brandId)

  type MemberRow = {
    user_id: string
    role: "admin" | "strategist" | "designer" | "viewer"
    users: { display_name: string | null; email: string } | { display_name: string | null; email: string }[] | null
  }

  const members = ((memberRows ?? []) as MemberRow[]).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users
    return {
      user_id: m.user_id,
      role: m.role,
      display_name: u?.display_name ?? null,
      email: u?.email ?? "",
    }
  })

  // Candidate users: approved (not pending), not already a member, and
  // not org-wide (strategist+ always have access so we list them
  // separately as a hint instead of as an addable option).
  const memberIds = new Set(members.map((m) => m.user_id))
  const { data: allUsers } = await supabase
    .from("users")
    .select("id, display_name, email, role")
    .neq("role", "pending")
    .order("display_name", { ascending: true })
  type UserRow = {
    id: string
    display_name: string | null
    email: string
    role: "super_admin" | "admin" | "strategist" | "designer" | "viewer"
  }

  const candidates: UserRow[] = []
  const orgWide: UserRow[] = []
  for (const u of (allUsers ?? []) as UserRow[]) {
    if (memberIds.has(u.id)) continue
    if (u.role === "super_admin") continue // implicit, not stored as a brand_member
    if (u.role === "admin" || u.role === "strategist") {
      orgWide.push(u)
      continue
    }
    candidates.push(u)
  }

  return (
    <BrandMembers
      brandId={brandId}
      brandSlug={brandSlug}
      members={members}
      candidates={candidates.map((c) => ({ id: c.id, display_name: c.display_name, email: c.email, role: c.role as "admin" | "strategist" | "designer" | "viewer" }))}
      orgWideUsers={orgWide.map((u) => ({ id: u.id, display_name: u.display_name, email: u.email, role: u.role as "admin" | "strategist" | "designer" | "viewer" }))}
    />
  )
}
