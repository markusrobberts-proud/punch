import { headers } from "next/headers"
import { Webhook } from "svix"
import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { createSupabaseServiceClient } from "@/lib/supabase/server"
import { USER_CACHE_TAG } from "@/lib/auth"
import { notify, recipientsForAdmins } from "@/lib/notifications"

type ClerkUserEvent = {
  type: "user.created" | "user.updated" | "user.deleted"
  data: {
    id: string
    email_addresses?: Array<{ id: string; email_address: string }>
    primary_email_address_id?: string
    first_name?: string | null
    last_name?: string | null
    username?: string | null
  }
}

function pickEmail(data: ClerkUserEvent["data"]): string {
  const primary =
    data.email_addresses?.find((e) => e.id === data.primary_email_address_id) ??
    data.email_addresses?.[0]
  return primary?.email_address ?? ""
}

function pickName(data: ClerkUserEvent["data"]): string | null {
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim()
  return name || data.username || null
}

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CLERK_WEBHOOK_SIGNING_SECRET not set" }, { status: 500 })
  }

  const h = await headers()
  const svixId = h.get("svix-id")
  const svixTimestamp = h.get("svix-timestamp")
  const svixSignature = h.get("svix-signature")
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
  }

  const payload = await req.text()
  let event: ClerkUserEvent
  try {
    event = new Webhook(secret).verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent
  } catch (err) {
    return NextResponse.json({ error: `Bad signature: ${(err as Error).message}` }, { status: 400 })
  }

  const supabase = createSupabaseServiceClient()
  const id = event.data.id

  if (event.type === "user.created") {
    const email = pickEmail(event.data)
    const displayName = pickName(event.data)
    await supabase.from("users").upsert(
      { id, email, display_name: displayName, role: "pending" },
      { onConflict: "id", ignoreDuplicates: false },
    )
    // Tell the admins someone's waiting in the lobby.
    try {
      const recipients = await recipientsForAdmins(id)
      await notify({
        recipients,
        kind: "user_pending",
        title: `${displayName ?? email} is awaiting approval`,
        body: `Sign-up just landed. Promote them to a role from Settings → Team.`,
        link: `/settings/team`,
        entityType: "user",
        entityId: id,
        actorUserId: id,
      })
    } catch (err) {
      console.error("[clerk-webhook] notify failed:", err)
    }
  } else if (event.type === "user.updated") {
    // Only sync email + display_name; never touch role from Clerk.
    await supabase
      .from("users")
      .update({ email: pickEmail(event.data), display_name: pickName(event.data) })
      .eq("id", id)
  } else if (event.type === "user.deleted") {
    await supabase.from("users").delete().eq("id", id)
  }

  revalidateTag(USER_CACHE_TAG, "default")
  return NextResponse.json({ ok: true })
}
