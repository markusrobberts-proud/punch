"use client"

import { useTransition } from "react"
import Link from "next/link"
import { Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { clearViewAs } from "@/app/(dashboard)/settings/view-as-actions"

export function ViewAsBanner({ role }: { role: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="bg-[#007AFF] text-white px-4 py-2 flex items-center justify-center gap-3 text-[12.5px]">
      <Eye className="size-3.5" />
      <span>
        Previewing as <span className="font-semibold capitalize">{role}</span>. Server actions are gated to that role.
      </span>
      <Link href="/settings" className="underline underline-offset-2 hover:text-white/90">
        Change in settings
      </Link>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => startTransition(() => clearViewAs())}
        className="ml-2"
      >
        Stop preview
      </Button>
    </div>
  )
}
