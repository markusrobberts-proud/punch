"use client"

import { useActionState, useState, useTransition } from "react"
import { Sparkles, Check, AlertCircle, Globe } from "lucide-react"
import { createBrandAction, type BrandFormState } from "../actions"
import { previewBrandFromUrl, type BrandPreviewResult } from "./preview-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

const initial: BrandFormState = { ok: false }

type Profile = Extract<BrandPreviewResult, { ok: true }>

export function CreateBrandForm() {
  const [state, formAction, pending] = useActionState(createBrandAction, initial)
  const [previewState, setPreviewState] = useState<BrandPreviewResult | null>(null)
  const [previewing, startPreview] = useTransition()
  const [form, setForm] = useState({
    name: "",
    website_url: "",
    industry: "",
    contact_name: "",
    contact_email: "",
    primary_color: "",
    secondary_color: "",
    font_heading: "",
    font_body: "",
    tone_of_voice: "",
    target_audience: "",
  })

  const fe = state?.fieldErrors ?? {}

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function runPreview() {
    setPreviewState(null)
    const fd = new FormData()
    fd.set("websiteUrl", form.website_url)
    fd.set("brandName", form.name)
    startPreview(async () => {
      const r = await previewBrandFromUrl(fd)
      setPreviewState(r)
      if (r.ok) {
        setForm((f) => ({
          ...f,
          industry: f.industry || r.profile.industry,
          tone_of_voice: r.profile.tone_of_voice,
          target_audience: r.profile.target_audience,
          primary_color: f.primary_color || r.profile.suggested_primary_color || "",
        }))
      }
    })
  }

  const preview = previewState?.ok ? (previewState as Profile) : null
  const canPreview = !!form.website_url && !previewing

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="prefilled_profile_md" value={preview?.profileMarkdown ?? ""} />

      <div className="space-y-4">
        <FieldRow>
          <Field
            label="Brand name"
            name="name"
            required
            value={form.name}
            onChange={(v) => set("name", v)}
            placeholder="Walnut Melbourne"
            error={fe.name}
          />
          <Field
            label="Industry"
            name="industry"
            value={form.industry}
            onChange={(v) => set("industry", v)}
            placeholder="Fashion"
            error={fe.industry}
          />
        </FieldRow>

        <div className="space-y-1.5">
          <Label htmlFor="website_url" className="flex items-center gap-2 text-[12px] text-[#1D1D1F]">
            <Globe className="size-3.5 text-[#86868B]" />
            Website
          </Label>
          <div className="flex gap-2">
            <Input
              id="website_url"
              name="website_url"
              value={form.website_url}
              onChange={(e) => set("website_url", e.target.value)}
              placeholder="https://walnutmelbourne.com.au"
              className="flex-1"
            />
            <Button
              type="button"
              variant="accent"
              onClick={runPreview}
              disabled={!canPreview}
              title="Scrape the website and let Claude pre-fill brand details"
            >
              <Sparkles /> {previewing ? "Reading site..." : "Auto-fill"}
            </Button>
          </div>
          {fe.website_url && <p className="text-[12px] text-destructive">{fe.website_url}</p>}
          <p className="text-[11.5px] text-[#86868B]">
            Optional. With AI on, "Auto-fill" reads the homepage and a few key pages, then prepopulates tone, audience, industry and a brand profile that Claude will use on every generation.
          </p>
        </div>

        {previewing && (
          <div className="rounded-xl border border-[#E5E5EA] bg-white/60 p-4 flex items-center gap-3 text-[13px] text-[#6E6E73]">
            <Sparkles className="size-4 text-[#007AFF]" />
            <div>
              <div className="font-medium text-[#1D1D1F]">Reading {form.website_url}</div>
              <div className="text-[11.5px] mt-0.5">Fetching pages and extracting a brand profile. About 10-20 seconds.</div>
            </div>
            <div className="ml-auto flex gap-1">
              <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-[#007AFF]" />
              <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-[#007AFF]" />
              <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-[#007AFF]" />
            </div>
          </div>
        )}

        {previewState && !previewState.ok && (
          <div className="rounded-xl border border-[#FFD5D1] bg-[#FFF5F4] p-4 flex items-start gap-3 text-[13px]">
            <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Could not auto-fill</div>
              <div className="text-[12px] text-[#6E6E73] mt-0.5">{previewState.error}</div>
            </div>
          </div>
        )}

        {preview && (
          <div className="rounded-xl border border-[#BFE3CB] bg-[#F2FBF5] p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Check className="size-4 text-[#166D2F]" />
              <div className="font-medium text-[13px]">
                Pre-filled from {preview.pages} page{preview.pages === 1 ? "" : "s"}
              </div>
              <Badge variant="success" className="ml-1">
                {preview.profile.industry}
              </Badge>
            </div>
            <p className="text-[12.5px] text-[#6E6E73] leading-relaxed">"{preview.profile.one_liner}"</p>
            <div className="text-[11.5px] text-[#86868B] flex flex-wrap gap-1.5">
              {preview.pageSummaries.slice(0, 5).map((p) => (
                <span
                  key={p.url}
                  className="px-2 py-0.5 rounded-full bg-white/80 border border-[#E5E5EA]"
                >
                  {(p.title || p.url).slice(0, 40)}
                </span>
              ))}
            </div>
            <p className="text-[11.5px] text-[#86868B] mt-1">
              Full profile lands in this brand's Knowledge Bank on save. Tweak any field below first.
            </p>
          </div>
        )}
      </div>

      <Divider label="Voice and audience" />

      <TextareaField
        label="Tone of voice"
        name="tone_of_voice"
        value={form.tone_of_voice}
        onChange={(v) => set("tone_of_voice", v)}
        rows={4}
        placeholder="How this brand sounds. Specifics beat adjectives."
        error={fe.tone_of_voice}
      />
      <TextareaField
        label="Target audience"
        name="target_audience"
        value={form.target_audience}
        onChange={(v) => set("target_audience", v)}
        rows={3}
        placeholder="Who the brand is for. Demographics, psychographics, decisions they're making."
        error={fe.target_audience}
      />

      <Divider label="Visual identity" />

      <FieldRow>
        <ColorField
          label="Primary colour"
          name="primary_color"
          value={form.primary_color}
          onChange={(v) => set("primary_color", v)}
          error={fe.primary_color}
        />
        <ColorField
          label="Secondary colour"
          name="secondary_color"
          value={form.secondary_color}
          onChange={(v) => set("secondary_color", v)}
          error={fe.secondary_color}
        />
      </FieldRow>
      <FieldRow>
        <Field
          label="Heading font"
          name="font_heading"
          value={form.font_heading}
          onChange={(v) => set("font_heading", v)}
          placeholder="GT Sectra"
          error={fe.font_heading}
        />
        <Field
          label="Body font"
          name="font_body"
          value={form.font_body}
          onChange={(v) => set("font_body", v)}
          placeholder="Inter"
          error={fe.font_body}
        />
      </FieldRow>

      <Divider label="Client contact" />

      <FieldRow>
        <Field
          label="Contact name"
          name="contact_name"
          value={form.contact_name}
          onChange={(v) => set("contact_name", v)}
          error={fe.contact_name}
        />
        <Field
          label="Contact email"
          name="contact_email"
          type="email"
          value={form.contact_email}
          onChange={(v) => set("contact_email", v)}
          error={fe.contact_email}
        />
      </FieldRow>

      {state?.error && (
        <div className="rounded-xl border border-[#FFD5D1] bg-[#FFF5F4] p-3 text-[13px] flex items-start gap-2">
          <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
          {state.error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E5EA]">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creating..." : "Create brand"}
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
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  error,
}: {
  label: string
  name: string
  value: string
  onChange: (v: string) => void
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
      <Input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
      />
      {error && <p className="text-[11.5px] text-destructive">{error}</p>}
    </div>
  )
}

function ColorField({
  label,
  name,
  value,
  onChange,
  error,
}: {
  label: string
  name: string
  value: string
  onChange: (v: string) => void
  error?: string
}) {
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
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 rounded-md border border-[#D2D2D7] cursor-pointer bg-transparent"
        />
        <Input
          id={name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1D1D1F"
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
  value,
  onChange,
  rows = 3,
  placeholder,
  error,
}: {
  label: string
  name: string
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-[12px]">
        {label}
      </Label>
      <Textarea
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
      />
      {error && <p className="text-[11.5px] text-destructive">{error}</p>}
    </div>
  )
}
