"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Bell, Check } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { updateDigestFrequency } from "./digest-actions"

type Frequency = "daily" | "weekly" | "off"

const OPTIONS: Array<{ value: Frequency; label: string; hint: string }> = [
  { value: "daily", label: "Daily", hint: "One email each morning with anything you missed." },
  { value: "weekly", label: "Weekly", hint: "One email on Monday morning with the past week." },
  { value: "off", label: "Off", hint: "Just the bell. No emails." },
]

export function DigestCard({ initial }: { initial: Frequency }) {
  const router = useRouter()
  const [value, setValue] = useState<Frequency>(initial)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function pick(next: Frequency) {
    if (next === value || pending) return
    const prev = value
    setValue(next)
    setSaved(false)
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set("frequency", next)
      const res = await updateDigestFrequency(fd)
      if (res.ok) {
        setSaved(true)
        router.refresh()
        setTimeout(() => setSaved(false), 2000)
      } else {
        setValue(prev)
        setError(res.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#F5F5F7] flex items-center justify-center shrink-0">
            <Bell className="size-4 text-[#6E6E73]" />
          </div>
          <div>
            <CardTitle>Notification digests</CardTitle>
            <CardDescription>
              How often we email you a roundup of in-app notifications. The bell stays live regardless.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {OPTIONS.map((opt) => {
            const active = value === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => pick(opt.value)}
                disabled={pending}
                className={`text-left p-3 rounded-lg border transition ${
                  active
                    ? "border-[#1D1D1F] bg-white card-shadow"
                    : "border-[#E5E5EA] hover:border-[#C7C7CC] hover:bg-white/60"
                } ${pending ? "opacity-70" : ""}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium">{opt.label}</span>
                  {active && <Check className="size-3.5 text-[#007AFF]" />}
                </div>
                <div className="text-[11.5px] text-[#6E6E73] mt-1 leading-snug">{opt.hint}</div>
              </button>
            )
          })}
        </div>
        {error && <div className="text-[12px] text-[#D70015] mt-3">{error}</div>}
        {saved && <div className="text-[12px] text-[#30A14E] mt-3">Saved.</div>}
      </CardContent>
    </Card>
  )
}
