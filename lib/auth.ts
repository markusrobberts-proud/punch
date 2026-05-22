import { cache } from "react"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "./supabase/server"

export type AppUser = {
  id: string
  email: string
  displayName: string | null
  role: "admin" | "strategist" | "designer" | "viewer" | "pending"
}

/**
 * `cache()` memoises the result per request, so calling `getUser()` from
 * a layout and a page does just one DB round trip.
 */
export const getUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createSupabaseServerClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData?.user) return null

  const { data: profile } = await supabase
    .from("users")
    .select("id,email,display_name,role")
    .eq("id", authData.user.id)
    .maybeSingle()

  if (!profile) {
    return {
      id: authData.user.id,
      email: authData.user.email ?? "",
      displayName: null,
      role: "pending",
    }
  }

  return {
    id: profile.id as string,
    email: profile.email as string,
    displayName: (profile.display_name as string | null) ?? null,
    role: (profile.role as AppUser["role"]) ?? "pending",
  }
})

export async function requireUser(): Promise<AppUser> {
  const user = await getUser()
  if (!user) redirect("/login")
  return user
}

export async function requireApprovedUser(): Promise<AppUser> {
  const user = await requireUser()
  if (user.role === "pending") redirect("/awaiting-approval")
  return user
}
