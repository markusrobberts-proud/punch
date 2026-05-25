"use client"

import { useActionState, useEffect, useState } from "react"
import { Check, AlertCircle } from "lucide-react"
import { updateBrandAction, type UpdateBrandState } from "./update-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const initial: UpdateBrandState = { ok: false }

type Props = {
  brand: {
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
  }
  canEdit: boolean
}

export function EditBrandForm({ brand, canEdit }: Props) {
  const [state, formAction, pending] = useActionState(updateBrandAction, initial)
  const [savedTick, setSavedTick] = useState(false)

  useEffect(() => {
    if (state?.saved) {
      setSavedTick(true)
      const t = setTimeout(() => setSavedTick(false), 2200)
      return () => clearTimeout(t)
    }
  }, [state])

  const fe = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="brandId" value={brand.id} />
      <input type="hidden" name="brandSlug" value={brand.slug} />

      <FieldRow>
        <Field label="Brand name" name="name" defaultValue={brand.name} required error={fe.name} />
        <Field label="Industry" name="industry" defaultValue={brand.industry ?? ""} error={fe.industry} />
      </FieldRow>

      <Field label="Website" name="website_url" defaultValue={brand.website_url ?? ""} placeholder="https://yourbrand.com" error={fe.website_url} />

      <Divider label="Voice and audience" />
      <TextareaField label="Tone of voice" name="tone_of_voice" defaultValue={brand.tone_of_voice ?? ""} rows={4} error={fe.tone_of_voice} />
      <TextareaField label="Target audience" name="target_audience" defaultValue={brand.target_audience ?? ""} rows={3} error={fe.target_audience} />

      <Divider label="Visual identity" />
      <FieldRow>
        <ColorField label="Primary colour" name="primary_color" defaultValue={brand.primary_color ?? ""} error={fe.primary_color} />
        <ColorField label="Secondary colour" name="secondary_color" defaultValue={brand.secondary_color ?? ""} error={fe.secondary_color} />
      </FieldRow>
      <FieldRow>
        <Field label="Heading font" name="font_heading" defaultValue={brand.font_heading ?? ""} placeholder="Display or serif" error={fe.font_heading} />
        <Field label="Body font" name="font_body" defaultValue={brand.font_body ?? ""} placeholder="Sans-serif" error={fe.font_body} />
      </FieldRow>

      <Divider label="Client contact" />
      <FieldRow>
        <Field label="Contact name" name="contact_name" defaultValue={brand.contact_name ?? ""} placeholder="First and last name" error={fe.contact_name} />
        <Field label="Contact email" name="contact_email" type="email" defaultValue={brand.contact_email ?? ""} placeholder="name@yourbrand.com" error={fe.contact_email} />
      </FieldRow>

      <Divider label="AI behaviour" />
      <Toggle
        label="Prefer this brand's voice over Proud Strategy when they conflict"
        name="prefer_brand_over_strategy"
        defaultChecked={!!brand.prefer_brand_over_strategy}
        description="When on, Claude will lean on the brand's tone and guidelines first. When off, Proud Strategy wins ties."
      />
      <Toggle
        label="Auto-ingest forwarded emails"
        name="auto_ingest_forwarded_emails"
        defaultChecked={brand.auto_ingest_forwarded_emails ?? true}
        description="When on, emails forwarded to this brand's inbox land in the knowledge bank automatically."
      />

      {state?.error && (
        <div className="rounded-xl border border-[#FFD5D1] bg-[#FFF5F4] p-3 text-[13px] flex items-start gap-2">
          <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
          {state.error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E5EA]">
        {savedTick && (
          <span className="flex items-center gap-1.5 text-[12px] text-[#166D2F]">
            <Check className="size-4" /> Saved
          </span>
        )}
        <Button type="submit" size="lg" disabled={!canEdit || pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="text-[11px] font-semibold tracking-widest uppercase text-[#86868B]">{label}</div>
      <div className="flex-1 h-px bg-[#E5E5EA]" />
    </div>
  )
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  placeholder,
  error,
}: {
  label: string
  name: string
  defaultValue: string
  required?: boolean
  type?: string
  placeholder?: string
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-[12px]">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} placeholder={placeholder} />
      {error && <p className="text-[11.5px] text-destructive">{error}</p>}
    </div>
  )
}

function ColorField({
  label,
  name,
  defaultValue,
  error,
}: {
  label: string
  name: string
  defaultValue: string
  error?: string
}) {
  const [value, setValue] = useState(defaultValue)
  const showSwatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-[12px]">
        {label}
      </Label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={showSwatch ? value : "#1D1D1F"}
          onChange={(e) => setValue(e.target.value)}
          className="h-10 w-10 rounded-md border border-[#D2D2D7] cursor-pointer bg-transparent"
        />
        <Input
          id={name}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="#000000"
          className="flex-1"
        />
      </div>
      {error && <p className="text-[11.5px] text-destructive">{error}</p>}
    </div>
  )
}

function TextareaField({
  label,
  name,
  defaultValue,
  rows = 3,
  error,
}: {
  label: string
  name: string
  defaultValue: string
  rows?: number
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-[12px]">{label}</Label>
      <Textarea id={name} name={name} defaultValue={defaultValue} rows={rows} />
      {error && <p className="text-[11.5px] text-destructive">{error}</p>}
    </div>
  )
}

function Toggle({
  label,
  name,
  defaultChecked,
  description,
}: {
  label: string
  name: string
  defaultChecked: boolean
  description?: string
}) {
  const [on, setOn] = useState(defaultChecked)
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={`shrink-0 w-[38px] h-[22px] rounded-full relative transition ${on ? "bg-[#30D158]" : "bg-[#C7C7CC]"}`}
      >
        <span
          className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition ${on ? "left-[18px]" : "left-[2px]"}`}
        />
      </button>
      <input type="hidden" name={name} value={on ? "on" : ""} />
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        {description && <div className="text-[11.5px] text-[#6E6E73] mt-0.5 leading-relaxed">{description}</div>}
      </div>
    </label>
  )
}
