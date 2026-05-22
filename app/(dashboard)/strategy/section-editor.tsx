"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { updateStrategySection } from "./actions"

export function StrategySectionEditor({
  sectionId,
  initialBody,
}: {
  sectionId: string
  initialBody: string
}) {
  const [body, setBody] = useState(initialBody)
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!editing) {
    return (
      <div className="space-y-3">
        {body ? (
          <p className="text-sm whitespace-pre-wrap">{body}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">Empty. Click edit to write the first version.</p>
        )}
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    )
  }

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          await updateStrategySection(fd)
          setEditing(false)
        })
      }}
      className="space-y-3"
    >
      <input type="hidden" name="sectionId" value={sectionId} />
      <Textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setBody(initialBody)
            setEditing(false)
          }}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
