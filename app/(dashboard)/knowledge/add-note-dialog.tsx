"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addManualKnowledgeNote } from "./actions"

const SOURCE_TYPES = [
  { value: "manual_note", label: "Manual note" },
  { value: "brand_guide", label: "Brand guide" },
  { value: "strategy_doc", label: "Strategy doc" },
  { value: "meeting_notes", label: "Meeting notes" },
  { value: "campaign_debrief", label: "Campaign debrief" },
]

export function AddNoteDialog({ brands }: { brands: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false)
  const [brandId, setBrandId] = useState<string>(brands[0]?.id ?? "")
  const [sourceType, setSourceType] = useState("manual_note")
  const [pending, startTransition] = useTransition()

  if (brands.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add note
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          action={(fd) => {
            fd.set("brandId", brandId)
            fd.set("sourceType", sourceType)
            startTransition(async () => {
              await addManualKnowledgeNote(fd)
              setOpen(false)
            })
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Add to the knowledge bank</DialogTitle>
            <DialogDescription>
              Manual notes are auto-approved and immediately available to Claude.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source type</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="e.g. Q3 launch debrief" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="content">Content</Label>
            <Textarea id="content" name="content" required rows={8} placeholder="Paste the note, summary, or excerpt..." />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save note"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
