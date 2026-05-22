"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MONTHS } from "@/lib/months"
import { createPlan } from "../actions"

export function NewPlanForm({
  brandId,
  brandSlug,
  defaultMonth,
  defaultYear,
}: {
  brandId: string
  brandSlug: string
  defaultMonth: number
  defaultYear: number
}) {
  const [pending, startTransition] = useTransition()

  return (
    <form action={(fd) => startTransition(() => createPlan(fd))} className="space-y-5">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="brandSlug" value={brandSlug} />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="month">Month</Label>
          <select
            id="month"
            name="month"
            defaultValue={defaultMonth}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="year">Year</Label>
          <Input id="year" name="year" type="number" defaultValue={defaultYear} min={2024} max={2100} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="targetDesigned">Designed</Label>
          <Input id="targetDesigned" name="targetDesigned" type="number" min={0} max={50} placeholder="4" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="targetText">Text</Label>
          <Input id="targetText" name="targetText" type="number" min={0} max={50} placeholder="2" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="targetSms">SMS</Label>
          <Input id="targetSms" name="targetSms" type="number" min={0} max={50} placeholder="0" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="teamBrief">Team brief (optional)</Label>
        <Textarea
          id="teamBrief"
          name="teamBrief"
          rows={6}
          placeholder="Strategic focus, key dates, launches, promotions, anything Claude should weigh heavily."
        />
      </div>

      <Button type="submit" disabled={pending}>{pending ? "Creating..." : "Create plan"}</Button>
    </form>
  )
}
