"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { inviteUser, type InviteResult } from "./actions"

export function InviteUserForm() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<InviteResult | null>(null)

  return (
    <form
      action={(fd) => {
        setResult(null)
        startTransition(async () => {
          const r = await inviteUser(fd)
          setResult(r)
        })
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-[1fr_140px_auto] gap-3 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required placeholder="teammate@proudcreative.com.au" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            name="role"
            defaultValue="strategist"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="admin">Admin</option>
            <option value="strategist">Strategist</option>
            <option value="designer">Designer</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>{pending ? "Inviting..." : "Invite"}</Button>
      </div>

      {result && !result.ok && <p className="text-sm text-destructive">{result.error}</p>}
      {result && result.ok && result.via === "service" && (
        <p className="text-sm text-emerald-700">Invitation sent. Magic link delivered to their inbox.</p>
      )}
      {result && result.ok && result.via === "magic_link_url" && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
          No service role key configured yet, so we couldn't send the invite email automatically. Ask them to sign in at
          {" "}
          <a href={result.url} className="underline" target="_blank" rel="noreferrer">{result.url}</a>
          . They'll request their own magic link, then you can promote them on this page.
        </div>
      )}
    </form>
  )
}
