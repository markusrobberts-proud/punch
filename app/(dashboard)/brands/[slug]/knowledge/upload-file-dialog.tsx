"use client"

import { useState, useTransition } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { uploadKnowledgeFile } from "./actions"

const SOURCE_TYPES = [
  { value: "uploaded_file", label: "Uploaded file" },
  { value: "brand_guide", label: "Brand guide" },
  { value: "strategy_doc", label: "Strategy doc" },
  { value: "meeting_notes", label: "Meeting notes" },
  { value: "campaign_debrief", label: "Campaign debrief" },
]

export function UploadFileDialog({ brandId, brandSlug }: { brandId: string; brandSlug: string }) {
  const [open, setOpen] = useState(false)
  const [sourceType, setSourceType] = useState("uploaded_file")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="size-4" /> Upload file
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          action={(fd) => {
            fd.set("brandId", brandId)
            fd.set("brandSlug", brandSlug)
            fd.set("sourceType", sourceType)
            setError(null)
            startTransition(async () => {
              try {
                await uploadKnowledgeFile(fd)
                setOpen(false)
              } catch (err) {
                setError((err as Error).message)
              }
            })
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Upload to the knowledge bank</DialogTitle>
            <DialogDescription>
              PDF, Word, plain text or markdown. Max 20 MB. Uploaded files are auto-approved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="file">File</Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required placeholder="e.g. Brand guidelines v3" />
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
            <Label htmlFor="extractedText">Extracted text (optional)</Label>
            <Textarea
              id="extractedText"
              name="extractedText"
              rows={5}
              placeholder="Paste the readable text content if you have it. Claude reads this. Without it, the file is stored but won't be in the AI context."
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>{pending ? "Uploading..." : "Upload"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
