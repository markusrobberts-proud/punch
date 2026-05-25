"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { markAllNotificationsRead } from "@/components/layout/notifications-actions"

export function MarkAllReadButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markAllNotificationsRead()
          router.refresh()
        })
      }
    >
      <CheckCheck /> {pending ? "Marking..." : "Mark all read"}
    </Button>
  )
}
