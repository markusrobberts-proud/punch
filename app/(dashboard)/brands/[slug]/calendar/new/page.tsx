import { notFound } from "next/navigation"
import { requireRole } from "@/lib/rbac"
import { getBrandBySlug } from "@/lib/brands"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { NewPlanForm } from "./new-plan-form"

export default async function NewPlanPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireRole("strategist")
  const { slug } = await params
  const brand = await getBrandBySlug(slug)
  if (!brand) notFound()

  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{brand.name}</div>
        <h1 className="text-2xl font-semibold tracking-tight">Plan next month</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set cadence targets and any strategic direction. Claude will draft the calendar against Proud Strategy + the brand's knowledge bank.
        </p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Plan details</CardTitle>
          <CardDescription>You can regenerate the calendar after creating the plan.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewPlanForm
            brandId={brand.id}
            brandSlug={brand.slug}
            defaultMonth={nextMonth.getMonth() + 1}
            defaultYear={nextMonth.getFullYear()}
          />
        </CardContent>
      </Card>
    </div>
  )
}
