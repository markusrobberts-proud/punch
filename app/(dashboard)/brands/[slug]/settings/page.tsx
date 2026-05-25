import { notFound } from "next/navigation"
import { requireApprovedUser } from "@/lib/auth"
import { canEditStrategy, canManageUsers } from "@/lib/rbac"
import { getBrandBySlug } from "@/lib/brands"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader, PageShell } from "@/components/layout/page-header"
import { EditBrandForm } from "./edit-brand-form"
import { DangerZone } from "./danger-zone"

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
        <div className="mt-8">
          <DangerZone brandId={brand.id} brandSlug={brand.slug} brandName={brand.name} />
        </div>
      )}
    </PageShell>
  )
}
