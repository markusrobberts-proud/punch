"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deleteBrandAction } from "./update-actions"

export function DangerZone({ brandId, brandSlug, brandName }: { brandId: string; brandSlug: string; brandName: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onDelete() {
    setError(null)
    const fd = new FormData()
    fd.set("brandId", brandId)
    fd.set("brandSlug", brandSlug)
    fd.set("confirm", confirm)
    startTransition(async () => {
      const r = await deleteBrandAction(fd)
      if (!r.ok) {
        setError(r.error ?? "Could not delete")
        return
      }
      router.push("/brands")
      router.refresh()
    })
  }

  return (
    <Card className="border-[#FFD5D1] bg-[#FFF5F4]/60">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#FFE8E5] flex items-center justify-center shrink-0">
            <AlertTriangle className="size-4 text-destructive" />
          </div>
          <div>
            <CardTitle>Danger zone</CardTitle>
            <CardDescription>
              Deleting a brand removes everything: knowledge bank items, campaign plans, emails, audit history. This cannot be undone.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="confirm-delete" className="text-[12px]">
            Type <span className="font-mono">{brandName}</span> to confirm
          </Label>
          <Input
            id="confirm-delete"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={brandName}
          />
        </div>
        {error && <p className="text-[12px] text-destructive">{error}</p>}
        <div>
          <Button
            variant="danger"
            disabled={pending || confirm.trim().toLowerCase() !== brandName.toLowerCase()}
            onClick={onDelete}
          >
            <Trash2 /> {pending ? "Deleting..." : "Delete brand permanently"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
