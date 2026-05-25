"use server"

import { revalidatePath } from "next/cache"
import { requireApprovedUser } from "@/lib/auth"
import { createSupabaseServiceClient } from "@/lib/supabase/server"
import { listNotifications, unreadCount, type Notification } from "@/lib/notifications"

export type NotificationsPayload = {
  unread: number
  items: Notification[]
}

/**
 * Polled by the NotificationBell. Returns the most recent notifications
 * and the unread count in a single round-trip.
 */
export async function fetchNotifications(): Promise<NotificationsPayload> {
  const user = await requireApprovedUser()
  const [items, unread] = await Promise.all([
    listNotifications(user.id, 30),
    unreadCount(user.id),
  ])
  return { items, unread }
}

export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  const user = await requireApprovedUser()
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("read_at", null)
  if (error) return { ok: false }
  revalidatePath("/notifications")
  return { ok: true }
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const user = await requireApprovedUser()
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null)
  if (error) return { ok: false }
  revalidatePath("/notifications")
  return { ok: true }
}
