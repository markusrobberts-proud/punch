"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MONTHS } from "@/lib/months"
import { createPlan, type CreatePlanState } from "../actions"

/** How many full or partial weeks the selected month spans. */
function weeksInMonth(month: number, year: number): number {
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0)
  // Days in month plus the offset to the start of the first week.
  const total = last.getDate() + first.getDay()
  return Math.ceil(total / 7)
}

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
  const [state, formAction] = useActionState<CreatePlanState | null, FormData>(
    createPlan,
    null,
  )

  const [month, setMonth] = useState(defaultMonth)
  const [year, setYear] = useState(defaultYear)
  const [perWeek, setPerWeek] = useState<string>("")
  const [total, setTotal] = useState<string>("")
  // Tracks whether the user has hand-edited the total; we only auto-fill
  // while it's still derived from per-week so we don't overwrite their input.
  const [totalIsAuto, setTotalIsAuto] = useState(true)

  const weeks = weeksInMonth(month, year)
  const defaultName = `${MONTHS[month - 1]} ${year} Campaign`

  function handlePerWeekChange(v: string) {
    setPerWeek(v)
    if (totalIsAuto) {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0) {
        setTotal(String(Math.round(n * weeks)))
      } else {
        setTotal("")
      }
    }
  }

  function handleTotalChange(v: string) {
    setTotal(v)
    setTotalIsAuto(v.trim() === "")
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="brandSlug" value={brandSlug} />

      <div className="space-y-1.5">
        <Label htmlFor="name">Campaign name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultName}
          placeholder={defaultName}
          maxLength={160}
        />
        {state?.fieldErrors?.name && (
          <p className="text-[12px] text-[#D70015]">{state.fieldErrors.name}</p>
        )}
        <p className="text-[11.5px] text-[#86868B]">
          Anything you like. "October Launch", "Black Friday", "Always-On".
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="month">Month</Label>
          <select
            id="month"
            name="month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="year">Year</Label>
          <Input
            id="year"
            name="year"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min={2024}
            max={2100}
          />
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">
          Cadence
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="emailsPerWeek">Emails per week</Label>
            <Input
              id="emailsPerWeek"
              name="emailsPerWeek"
              type="number"
              min={0}
              max={50}
              placeholder="2"
              value={perWeek}
              onChange={(e) => handlePerWeekChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="totalEmails">Total emails this campaign</Label>
            <Input
              id="totalEmails"
              name="totalEmails"
              type="number"
              min={0}
              max={200}
              placeholder="8"
              value={total}
              onChange={(e) => handleTotalChange(e.target.value)}
            />
          </div>
        </div>
        <p className="text-[11.5px] text-[#86868B] mt-2">
          {perWeek && totalIsAuto && total
            ? `Auto-calculated from ${perWeek}/week × ${weeks} weeks in ${MONTHS[month - 1]}. Edit total directly to override.`
            : "Either is optional. Leave blank to let Claude decide cadence from strategy."}
        </p>
      </div>

      <div>
        <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">
          Format mix (per month)
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
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

      {state?.error && (
        <div className="rounded-md border border-[#FFD8D8] bg-[#FFF5F5] px-3 py-2 text-[12.5px] text-[#86181A]">
          {state.error}
        </div>
      )}

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating..." : "Create plan"}
    </Button>
  )
}
