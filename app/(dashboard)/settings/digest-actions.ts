"use server"

import { revalidateTag } from "next/cache"
import { z } from "zod"
import { requireApprovedUser, USER_CACHE_TAG } from "@/lib/auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const Schema = z.object({
  frequency: z.enum(["daily", "weekly", "off"]),
})

export type DigestPrefResult = { ok: true } | { ok: false; error: string }

/**
 * Lets a user pick how often (or whether) they want PUNCH to email them
 * a notification digest. Stored on the users table so the cron only
 * touches users opted in.
 */
export async function updateDigestFrequency(formData: FormData): Promise<DigestPrefResult> {
  const user = await requireApprovedUser()
  const parsed = Schema.safeParse({ frequency: formData.get("frequency") })
  if (!parsed.success) return { ok: false, error: "Invalid frequency" }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from("users")
    .update({ notification_digest: parsed.data.frequency })
    .eq("id", user.id)
  if (error) return { ok: false, error: error.message }

  // Bust the cached profile so the new value is visible immediately.
  revalidateTag(USER_CACHE_TAG, "default")
  return { ok: true }
}
