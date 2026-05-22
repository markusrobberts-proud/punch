"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { requireRole } from "@/lib/rbac"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { recordAudit } from "@/lib/audit"
import { generateCalendarPlan } from "@/lib/ai/prompts/calendar"
import { generateEmailCopy } from "@/lib/ai/prompts/copy"
import { generateDesignedBrief, generateTextBrief } from "@/lib/ai/prompts/brief"
import { MONTHS } from "@/lib/campaigns"

const CreatePlanSchema = z.object({
  brandId: z.string().uuid(),
  brandSlug: z.string(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2024).max(2100),
  teamBrief: z.string().max(8000).optional().or(z.literal("")),
  targetDesigned: z.coerce.number().int().min(0).max(50).optional(),
  targetText: z.coerce.number().int().min(0).max(50).optional(),
  targetSms: z.coerce.number().int().min(0).max(50).optional(),
})

export async function createPlan(formData: FormData) {
  const user = await requireRole("strategist")
  const parsed = CreatePlanSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) throw new Error("Invalid plan input")

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("campaign_plans")
    .insert({
      brand_id: parsed.data.brandId,
      name: `${MONTHS[parsed.data.month - 1]} ${parsed.data.year} Campaign Plan`,
      month: parsed.data.month,
      year: parsed.data.year,
      team_brief: parsed.data.teamBrief || null,
      target_designed_count: parsed.data.targetDesigned ?? null,
      target_text_count: parsed.data.targetText ?? null,
      target_sms_count: parsed.data.targetSms ?? null,
      status: "draft",
    })
    .select("id")
    .single()

  if (error || !data) throw new Error(error?.message ?? "Could not create plan")

  await recordAudit({
    userId: user.id,
    brandId: parsed.data.brandId,
    entityType: "campaign_plan",
    entityId: data.id,
    action: "create",
  })

  revalidatePath(`/brands/${parsed.data.brandSlug}/calendar`)
  redirect(`/brands/${parsed.data.brandSlug}/calendar/${data.id}`)
}

export async function generateCalendar(planId: string) {
  const user = await requireRole("strategist")
  const supabase = await createSupabaseServerClient()

  await supabase.from("campaign_plans").update({ status: "generating" }).eq("id", planId)

  const { data: plan } = await supabase
    .from("campaign_plans")
    .select("brand_id, month, year, team_brief, target_designed_count, target_text_count, target_sms_count")
    .eq("id", planId)
    .single()
  if (!plan) throw new Error("Plan not found")

  let generated
  try {
    generated = await generateCalendarPlan({
      brandId: plan.brand_id,
      month: plan.month,
      year: plan.year,
      teamBrief: plan.team_brief,
      targets: {
        designed: plan.target_designed_count,
        text: plan.target_text_count,
        sms: plan.target_sms_count,
      },
    })
  } catch (err) {
    await supabase.from("campaign_plans").update({ status: "error" }).eq("id", planId)
    throw err
  }

  // Insert series first so we can map them onto email rows
  const seriesIdBySeqStart = new Map<number, string>()
  for (const s of generated.series) {
    const { data: sRow } = await supabase
      .from("campaign_series")
      .insert({ plan_id: planId, brand_id: plan.brand_id, name: s.name, theme: s.theme ?? null })
      .select("id")
      .single()
    if (sRow) for (const seq of s.member_sequence) seriesIdBySeqStart.set(seq, sRow.id)
  }

  await supabase.from("campaign_emails").delete().eq("plan_id", planId)
  await supabase.from("campaign_emails").insert(
    generated.emails.map((e) => ({
      plan_id: planId,
      brand_id: plan.brand_id,
      series_id: seriesIdBySeqStart.get(e.sequence_number) ?? null,
      sequence_number: e.sequence_number,
      scheduled_date: e.scheduled_date,
      theme: e.theme,
      email_type: e.email_type,
      format: e.format,
      target_segment: e.target_segment,
      strategic_rationale: e.strategic_rationale,
    })),
  )

  await supabase
    .from("campaign_plans")
    .update({
      status: "pending_review",
      strategic_rationale: generated.strategic_rationale,
    })
    .eq("id", planId)

  await recordAudit({
    userId: user.id,
    brandId: plan.brand_id,
    entityType: "campaign_plan",
    entityId: planId,
    action: "generate_calendar",
    meta: { emails: generated.emails.length, series: generated.series.length },
  })

  revalidatePath(`/brands`)
}

export async function approveCalendar(planId: string) {
  const user = await requireRole("strategist")
  const supabase = await createSupabaseServerClient()
  const { data: plan } = await supabase
    .from("campaign_plans")
    .select("brand_id")
    .eq("id", planId)
    .single()

  await supabase
    .from("campaign_plans")
    .update({ status: "calendar_approved", approved_by_user_id: user.id, approved_at: new Date().toISOString() })
    .eq("id", planId)

  await recordAudit({
    userId: user.id,
    brandId: plan?.brand_id ?? null,
    entityType: "campaign_plan",
    entityId: planId,
    action: "approve_calendar",
  })
  revalidatePath(`/brands`)
}

export async function generateCopyForEmail(emailId: string, feedback?: string) {
  const user = await requireRole("strategist")
  const supabase = await createSupabaseServerClient()
  await supabase.from("campaign_emails").update({ copy_status: "generating" }).eq("id", emailId)

  const { data: e } = await supabase
    .from("campaign_emails")
    .select("brand_id,plan_id,theme,email_type,format,target_segment,strategic_rationale,scheduled_date,sender_identity,series_id,sequence_number")
    .eq("id", emailId)
    .single()
  if (!e) throw new Error("Email not found")

  let siblings: Array<{ sequence_number: number; theme: string | null; subject_line: string | null; body_headline: string | null }> = []
  if (e.series_id) {
    const { data: sibs } = await supabase
      .from("campaign_emails")
      .select("sequence_number,theme,subject_line,body_headline")
      .eq("series_id", e.series_id)
      .neq("id", emailId)
      .order("sequence_number", { ascending: true })
    siblings = (sibs ?? []) as typeof siblings
  }

  try {
    const copy = await generateEmailCopy({
      brandId: e.brand_id,
      email: {
        theme: e.theme,
        email_type: e.email_type,
        format: e.format,
        target_segment: e.target_segment,
        strategic_rationale: e.strategic_rationale,
        scheduled_date: e.scheduled_date,
        sender_identity: e.sender_identity,
      },
      siblings,
      feedback,
    })

    await supabase
      .from("campaign_emails")
      .update({
        subject_line: copy.subject_line,
        preview_text: copy.preview_text,
        body_headline: copy.body_headline,
        body_copy: copy.body_copy,
        cta_text: copy.cta_text,
        cta_url: copy.cta_url_suggestion ?? null,
        sms_body: copy.sms_body ?? null,
        copy_status: "done",
      })
      .eq("id", emailId)

    await recordAudit({
      userId: user.id,
      brandId: e.brand_id,
      entityType: "campaign_email",
      entityId: emailId,
      action: feedback ? "regenerate_copy" : "generate_copy",
      meta: feedback ? { feedback } : undefined,
    })
  } catch (err) {
    await supabase.from("campaign_emails").update({ copy_status: "error" }).eq("id", emailId)
    throw err
  }

  revalidatePath(`/brands`)
}

export async function generateBriefForEmail(emailId: string) {
  const user = await requireRole("strategist")
  const supabase = await createSupabaseServerClient()
  await supabase.from("campaign_emails").update({ brief_status: "generating" }).eq("id", emailId)

  const { data: e } = await supabase
    .from("campaign_emails")
    .select("brand_id,theme,subject_line,body_headline,body_copy,cta_text,target_segment,format")
    .eq("id", emailId)
    .single()
  if (!e) throw new Error("Email not found")

  try {
    if (e.format === "text") {
      const brief = await generateTextBrief({
        brandId: e.brand_id,
        email: {
          theme: e.theme,
          subject_line: e.subject_line,
          body_copy: e.body_copy,
          target_segment: e.target_segment,
        },
      })
      await supabase
        .from("campaign_emails")
        .update({
          sender_identity: brief.sender_identity,
          design_brief: brief.design_brief,
          brief_status: "done",
        })
        .eq("id", emailId)
    } else if (e.format === "sms") {
      await supabase
        .from("campaign_emails")
        .update({ design_brief: "SMS. No design brief required.", brief_status: "done" })
        .eq("id", emailId)
    } else {
      const brief = await generateDesignedBrief({
        brandId: e.brand_id,
        email: {
          theme: e.theme,
          subject_line: e.subject_line,
          body_headline: e.body_headline,
          body_copy: e.body_copy,
          cta_text: e.cta_text,
          target_segment: e.target_segment,
        },
      })
      await supabase
        .from("campaign_emails")
        .update({
          layout_template: brief.layout_template,
          imagery_notes: brief.imagery_notes,
          colour_notes: brief.colour_notes,
          design_brief: brief.design_brief,
          brief_status: "done",
        })
        .eq("id", emailId)
    }

    await recordAudit({
      userId: user.id,
      brandId: e.brand_id,
      entityType: "campaign_email",
      entityId: emailId,
      action: "generate_brief",
    })
  } catch (err) {
    await supabase.from("campaign_emails").update({ brief_status: "error" }).eq("id", emailId)
    throw err
  }

  revalidatePath(`/brands`)
}

export async function generateAllCopy(planId: string) {
  const supabase = await createSupabaseServerClient()
  await supabase.from("campaign_plans").update({ status: "copy_generating" }).eq("id", planId)
  const { data: emails } = await supabase
    .from("campaign_emails")
    .select("id")
    .eq("plan_id", planId)
    .order("sequence_number")
  for (const row of emails ?? []) await generateCopyForEmail(row.id)
  await supabase.from("campaign_plans").update({ status: "copy_done" }).eq("id", planId)
  revalidatePath(`/brands`)
}

export async function generateAllBriefs(planId: string) {
  const supabase = await createSupabaseServerClient()
  const { data: emails } = await supabase
    .from("campaign_emails")
    .select("id")
    .eq("plan_id", planId)
    .order("sequence_number")
  for (const row of emails ?? []) await generateBriefForEmail(row.id)
  await supabase.from("campaign_plans").update({ status: "briefs_done" }).eq("id", planId)
  revalidatePath(`/brands`)
}
