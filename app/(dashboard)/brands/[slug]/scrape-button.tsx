"use client"

import { useTransition } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { runWebsiteScrape } from "./scrape-actions"

export function ScrapeButton({ brandId, status }: { brandId: string; status: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending || status === "running"}
      onClick={() =>
        startTransition(async () => {
          try {
            await runWebsiteScrape(brandId)
          } catch (err) {
            alert((err as Error).message)
          }
        })
      }
    >
      <RefreshCw className={`size-4 ${pending || status === "running" ? "animate-spin" : ""}`} />
      {status === "done" ? "Re-scrape website" : "Scrape website"}
    </Button>
  )
}
