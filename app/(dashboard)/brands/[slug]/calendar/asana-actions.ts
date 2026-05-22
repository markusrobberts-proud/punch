"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { recordAudit } from "@/lib/audit"
import { createAsanaTask } from "@/lib/asana"

export async function exportEmailToAsana(emailId: string) {
  const user = await requireRole("strategist")
  const workspaceId = process.env.ASANA_WORKSPACE_ID
  if (!workspaceId) throw new Error("ASANA_WORKSPACE_ID is not set")

  const supabase = await createSupabaseServerClient()
  const { data: email } = await supabase
    .from("campaign_emails")
    .select("id,brand_id,plan_id,theme,scheduled_date,format,subject_line,body_headline,body_copy,cta_text,layout_template,design_brief,imagery_notes,colour_notes,sender_identity")
    .eq("id", emailId)
    .single()
  if (!email) throw new Error("Email not found")

  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("id", email.brand_id)
    .single()

  const name = `${brand?.name ?? "Brand"} · ${email.scheduled_date ?? "TBD"} · ${email.subject_line ?? email.theme ?? "Email"}`

  const notes = [
    `Format: ${email.format}`,
    `Scheduled: ${email.scheduled_date ?? "TBD"}`,
    `Theme: ${email.theme ?? "–"}`,
    "",
    `Subject: ${email.subject_line ?? ""}`,
    `Headline: ${email.body_headline ?? ""}`,
    "",
    "Body:",
    email.body_copy ?? "",
    "",
    `CTA: ${email.cta_text ?? ""}`,
    "",
    email.format === "designed"
      ? [
          `Layout: ${email.layout_template ?? ""}`,
          `Imagery: ${email.imagery_notes ?? ""}`,
          `Colours: ${email.colour_notes ?? ""}`,
          "",
          "Design brief:",
          email.design_brief ?? "",
        ].join("\n")
      : email.format === "text"
        ? [`Sender: ${email.sender_identity ?? ""}`, "", "Brief:", email.design_brief ?? ""].join("\n")
        : `SMS · ${email.design_brief ?? ""}`,
  ].join("\n")

  const task = await createAsanaTask({ name, notes, workspaceId })

  await supabase
    .from("campaign_emails")
    .update({
      asana_task_id: task.gid,
      asana_task_url: task.permalink_url,
      asana_exported_at: new Date().toISOString(),
    })
    .eq("id", emailId)

  await recordAudit({
    userId: user.id,
    brandId: email.brand_id,
    entityType: "campaign_email",
    entityId: emailId,
    action: "export_asana",
    meta: { asana_task_id: task.gid },
  })

  revalidatePath(`/brands`)
}
