"use client"

import { useTransition } from "react"
import { updateUserRole } from "./actions"

const ROLES = ["super_admin", "admin", "strategist", "designer", "viewer", "pending"] as const
type Role = (typeof ROLES)[number]

export function RoleSelect({
  userId,
  currentRole,
  isSelf,
  canAssignSuperAdmin,
}: {
  userId: string
  currentRole: Role
  isSelf: boolean
  canAssignSuperAdmin: boolean
}) {
  const [pending, startTransition] = useTransition()
  const options = ROLES.filter((r) => canAssignSuperAdmin || r !== "super_admin")

  return (
    <select
      defaultValue={currentRole}
      disabled={pending || isSelf}
      onChange={(e) => {
        const fd = new FormData()
        fd.set("userId", userId)
        fd.set("role", e.target.value)
        startTransition(async () => {
          try {
            await updateUserRole(fd)
          } catch (err) {
            alert((err as Error).message)
          }
        })
      }}
      className="h-8 rounded-md border border-input bg-background px-2 text-sm capitalize"
    >
      {options.map((r) => (
        <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
      ))}
    </select>
  )
}
