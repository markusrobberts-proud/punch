"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, UserPlus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, initialsFromName } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  addBrandMember,
  removeBrandMember,
  updateBrandMemberRole,
} from "./member-actions"

type Member = {
  user_id: string
  role: "admin" | "strategist" | "designer" | "viewer"
  display_name: string | null
  email: string
}

type Candidate = {
  id: string
  display_name: string | null
  email: string
  role: "admin" | "strategist" | "designer" | "viewer"
}

const ROLE_COLOURS: Record<string, string> = {
  admin: "#1D1D1F",
  strategist: "#2D4F6B",
  designer: "#8B5A2B",
  viewer: "#6E6E73",
}

/**
 * Admin-only card on the brand-settings page. Lists current brand_members
 * and offers an Add-member dialog that picks from approved users not yet
 * on this brand.
 *
 * We display strategist+ users with an "org-wide" hint instead of a
 * removable row, because they bypass brand scoping by design.
 */
export function BrandMembers({
  brandId,
  brandSlug,
  members,
  candidates,
  orgWideUsers,
}: {
  brandId: string
  brandSlug: string
  members: Member[]
  candidates: Candidate[]
  orgWideUsers: Candidate[]
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Team on this brand</CardTitle>
            <CardDescription>
              Designers and viewers see this brand only if they're listed below. Strategists, admins, and super admins have access to every brand by default.
            </CardDescription>
          </div>
          <AddMemberDialog
            brandId={brandId}
            brandSlug={brandSlug}
            candidates={candidates}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {members.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-[#86868B]">
            No designers or viewers assigned yet. Add one to give them access.
          </div>
        ) : (
          <div>
            {members.map((m, idx) => (
              <MemberRow
                key={m.user_id}
                brandId={brandId}
                brandSlug={brandSlug}
                member={m}
                last={idx === members.length - 1}
              />
            ))}
          </div>
        )}

        {orgWideUsers.length > 0 && (
          <div className="px-5 py-4 border-t border-[#E5E5EA] bg-[#FAFAFB]">
            <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider mb-2">
              Org-wide access
            </div>
            <div className="flex flex-wrap gap-2">
              {orgWideUsers.map((u) => (
                <div
                  key={u.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-[#E5E5EA] text-[12px]"
                  title={u.email}
                >
                  <Avatar
                    initials={initialsFromName(u.display_name ?? u.email)}
                    color={ROLE_COLOURS[u.role]}
                    size="sm"
                  />
                  <span>{u.display_name ?? u.email.split("@")[0]}</span>
                  <Badge variant="neutral">{u.role.replace(/_/g, " ")}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MemberRow({
  brandId,
  brandSlug,
  member,
  last,
}: {
  brandId: string
  brandSlug: string
  member: Member
  last: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function changeRole(role: string) {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set("brandId", brandId)
      fd.set("brandSlug", brandSlug)
      fd.set("userId", member.user_id)
      fd.set("role", role)
      const res = await updateBrandMemberRole(fd)
      if (!res.ok) setError(res.error)
      router.refresh()
    })
  }

  function remove() {
    if (!confirm(`Remove ${member.display_name ?? member.email} from this brand?`)) return
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set("brandId", brandId)
      fd.set("brandSlug", brandSlug)
      fd.set("userId", member.user_id)
      const res = await removeBrandMember(fd)
      if (!res.ok) setError(res.error)
      router.refresh()
    })
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 px-5 py-3.5 ${
        last ? "" : "border-b border-[#E5E5EA]"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Avatar
          initials={initialsFromName(member.display_name ?? member.email)}
          color={ROLE_COLOURS[member.role]}
          size="md"
        />
        <div className="min-w-0">
          <div className="text-[13px] font-medium truncate">
            {member.display_name ?? member.email.split("@")[0]}
          </div>
          <div className="text-[12px] text-[#86868B] truncate">{member.email}</div>
          {error && <div className="text-[11px] text-[#D70015] mt-1">{error}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={member.role} onValueChange={changeRole} disabled={pending}>
          <SelectTrigger className="h-8 w-[120px] text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="designer">Designer</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
            <SelectItem value="strategist">Strategist</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="p-1.5 rounded-md text-[#86868B] hover:text-[#D70015] hover:bg-[#F5F5F7] transition"
          title="Remove from brand"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

function AddMemberDialog({
  brandId,
  brandSlug,
  candidates,
}: {
  brandId: string
  brandSlug: string
  candidates: Candidate[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState<string>("")
  const [role, setRole] = useState<string>("designer")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!userId) {
      setError("Pick a user.")
      return
    }
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set("brandId", brandId)
      fd.set("brandSlug", brandSlug)
      fd.set("userId", userId)
      fd.set("role", role)
      const res = await addBrandMember(fd)
      if (res.ok) {
        setOpen(false)
        setUserId("")
        setRole("designer")
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={candidates.length === 0}>
          <UserPlus /> Add member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a teammate to this brand</DialogTitle>
          <DialogDescription>
            They'll see this brand in their sidebar and be able to work on it at the role you pick.
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <div className="text-[13px] text-[#86868B]">
            Everyone approved is already on this brand. Approve more teammates in Settings → Team first.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="member-user">Teammate</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger id="member-user">
                  <SelectValue placeholder="Pick a teammate" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.display_name ?? c.email.split("@")[0]} · {c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-role">Brand role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="member-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="designer">Designer (can edit briefs)</SelectItem>
                  <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                  <SelectItem value="strategist">Strategist (full access)</SelectItem>
                  <SelectItem value="admin">Admin (full access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <div className="text-[12px] text-[#D70015]">{error}</div>}
          </div>
        )}

        {candidates.length > 0 && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !userId}>
              <Plus /> {pending ? "Adding..." : "Add to brand"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
