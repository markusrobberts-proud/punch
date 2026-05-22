"use client"

import { useTransition } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { setViewAs } from "./view-as-actions"

type Role = "admin" | "strategist" | "designer" | "viewer"

const ROLE_OPTIONS: Array<{ value: Role; label: string; description: string }> = [
  { value: "admin", label: "Admin", description: "Full access, team, audit, system status" },
  { value: "strategist", label: "Strategist", description: "Pipeline, knowledge review, Proud Strategy" },
  { value: "designer", label: "Designer", description: "Brief queue, Asana exports, calendars" },
  { value: "viewer", label: "Viewer", description: "Read-only, recent client actions" },
]

export function ViewAsCard({ currentViewAs }: { currentViewAs: Role | null }) {
  const [pending, startTransition] = useTransition()

  function apply(role: Role | null) {
    const fd = new FormData()
    fd.set("role", role ?? "")
    startTransition(async () => {
      await setViewAs(fd)
    })
  }

  return (
    <Card variant={currentViewAs ? "glass-tinted-blue" : "glass"}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1D1D1F] flex items-center justify-center shrink-0">
            <Eye className="size-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle>View as another role</CardTitle>
            <CardDescription>
              Super admin only. Previews exactly what someone with that role sees and can do. The UI swaps and server
              actions enforce the previewed role's permissions until you turn it off.
            </CardDescription>
          </div>
          {currentViewAs && (
            <Badge variant="info" className="capitalize">Viewing as {currentViewAs}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {ROLE_OPTIONS.map((opt) => {
            const active = currentViewAs === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                disabled={pending}
                onClick={() => apply(active ? null : opt.value)}
                className={`text-left p-3 rounded-xl border transition disabled:opacity-50 ${
                  active
                    ? "border-[#007AFF] bg-[#007AFF]/5"
                    : "border-[#E5E5EA] bg-white/40 hover:border-[#D2D2D7] hover:bg-white/80"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-medium">{opt.label}</div>
                  {active && <Badge variant="info">Active</Badge>}
                </div>
                <div className="text-[11.5px] text-[#6E6E73] mt-0.5 leading-snug">{opt.description}</div>
              </button>
            )
          })}
        </div>
        {currentViewAs && (
          <div className="mt-4 flex items-center justify-between gap-3 pt-4 border-t border-[#E5E5EA]">
            <p className="text-[12px] text-[#6E6E73]">
              Toggle off to return to full super-admin powers.
            </p>
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => apply(null)}>
              <EyeOff /> Stop viewing as
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
