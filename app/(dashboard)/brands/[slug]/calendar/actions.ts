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
import { notify, recipientsForBrand } from "@/lib/notifications"

const CreatePlanSchema = z.object({
  brandId: z.string().uuid(),
  brandSlug: z.string(),
  name: z.string().max(160).optional().or(z.literal("")),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2024).max(2100),
  teamBrief: z.string().max(8000).optional().or(z.literal("")),
  targetDesigned: z.coerce.number().int().min(0).max(50).optional(),
  targetText: z.coerce.number().int().min(0).max(50).optional(),
  targetSms: z.coerce.number().int().min(0).max(50).optional(),
  emailsPerWeek: z.coerce.number().int().min(0).max(50).optional(),
  totalEmails: z.coerce.number().int().min(0).max(200).optional(),
})

export type CreatePlanState = {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/**
 * Creates a campaign plan and redirects to its detail page. Uses a
 * useActionState-friendly signature so the form can surface field errors
 * (e.g. invalid name length) and the dup-key case if someone re-submits
 * the same plan, instead of throwing a 500.
 */
export async function createPlan(
  _prev: CreatePlanState | null,
  formData: FormData,
): Promise<CreatePlanState> {
  const user = await requireRole("strategist")
  const parsed = CreatePlanSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message
    return { ok: false, fieldErrors }
  }

  const fallbackName = `${MONTHS[parsed.data.month - 1]} ${parsed.data.year} Campaign`
  const name = parsed.data.name?.trim() || fallbackName

  // Build the row defensively: if the 0005_plan_cadence.sql migration hasn't
  // been applied yet, the emails_per_week / total_emails columns won't exist
  // and Postgres will reject the insert. We retry without those keys when we
  // see the missing-column signal so the new-plan form still works mid-migration.
  const supabase = await createSupabaseServerClient()
  const base = {
    brand_id: parsed.data.brandId,
    name,
    month: parsed.data.month,
    year: parsed.data.year,
    team_brief: parsed.data.teamBrief || null,
    target_designed_count: parsed.data.targetDesigned ?? null,
    target_text_count: parsed.data.targetText ?? null,
    target_sms_count: parsed.data.targetSms ?? null,
    status: "draft" as const,
  }
  const withCadence = {
    ...base,
    emails_per_week: parsed.data.emailsPerWeek ?? null,
    total_emails: parsed.data.totalEmails ?? null,
  }

  let { data, error } = await supabase
    .from("campaign_plans")
    .insert(withCadence)
    .select("id")
    .single()

  if (error && /emails_per_week|total_emails|column .* does not exist/i.test(error.message)) {
    const retry = await supabase.from("campaign_plans").insert(base).select("id").single()
    data = retry.data
    error = retry.error
  }

  if (error || !data) {
    const msg = error?.message ?? "Could not create plan"
    if (msg.includes("duplicate key") || msg.includes("unique")) {
      return {
        ok: false,
        error:
          "A plan for that brand and month already exists. Apply the 0005_plan_cadence.sql migration in Supabase to allow multiple plans per month, or pick a different month.",
      }
    }
    return { ok: false, error: msg }
  }

  await recordAudit({
    userId: user.id,
    brandId: parsed.data.brandId,
    entityType: "campaign_plan",
    entityId: data.id,
    action: "create",
    meta: { name, emails_per_week: parsed.data.emailsPerWeek ?? null, total_emails: parsed.data.totalEmails ?? null },
  })

  revalidatePath(`/brands/${parsed.data.brandSlug}/calendar`)
  redirect(`/brands/${parsed.data.brandSlug}/calendar/${data.id}`)
}

export type GenerateResult = { ok: true } | { ok: false; error: string }

export async function generateCalendar(planId: string): Promise<GenerateResult> {
  try {
    const user = await requireRole("strategist")
    const supabase = await createSupabaseServerClient()

    await supabase.from("campaign_plans").update({ status: "generating" }).eq("id", planId)

    // select * so we degrade cleanly if the 0005_plan_cadence.sql migration
    // hasn't been applied yet in this environment. emails_per_week and
    // total_emails are read defensively below.
    const { data: plan } = await supabase
      .from("campaign_plans")
      .select("*")
      .eq("id", planId)
      .single()
    if (!plan) return { ok: false, error: "Plan not found" }

    if (!process.env.AI_GATEWAY_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      await supabase.from("campaign_plans").update({ status: "error" }).eq("id", planId)
      return {
        ok: false,
        error: "AI key isn't configured. Set ANTHROPIC_API_KEY (or wire the Vercel AI Gateway) and redeploy.",
      }
    }

    let generated
    try {
      generated = await generateCalendarPlan({
        brandId: plan.brand_id as string,
        campaignName: (plan.name as string | null) ?? null,
        month: plan.month as number,
        year: plan.year as number,
        teamBrief: (plan.team_brief as string | null) ?? null,
        targets: {
          designed: (plan.target_designed_count as number | null) ?? null,
          text: (plan.target_text_count as number | null) ?? null,
          sms: (plan.target_sms_count as number | null) ?? null,
        },
        cadence: {
          emailsPerWeek: (plan.emails_per_week as number | null | undefined) ?? null,
          totalEmails: (plan.total_emails as number | null | undefined) ?? null,
        },
      })
    } catch (err) {
      await supabase.from("campaign_plans").update({ status: "error" }).eq("id", planId)
      console.error("[generateCalendar] AI call failed:", err)
      return { ok: false, error: `Claude couldn't generate the calendar: ${(err as Error).message}` }
    }
    // Continues with the original body below once we have `generated`.
    // The rest of the function expects: supabase, user, plan, generated.
    return await persistGeneratedCalendar({ supabase, user, plan, planId, generated })
  } catch (err) {
    console.error("[generateCalendar] unexpected:", err)
    return { ok: false, error: (err as Error).message ?? "Generate failed" }
  }
}

type PersistArgs = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  user: { id: string }
  plan: { brand_id: string }
  planId: string
  generated: Awaited<ReturnType<typeof generateCalendarPlan>>
}

async function persistGeneratedCalendar({ supabase, user, plan, planId, generated }: PersistArgs): Promise<GenerateResult> {

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
  return { ok: true }
}

export async function approveCalendar(planId: string) {
  const user = await requireRole("strategist")
  const supabase = await createSupabaseServerClient()
  const { data: plan } = await supabase
    .from("campaign_plans")
    .select("brand_id, name, brands(slug, name)")
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

  // Heads-up to the brand's designers: copy is incoming, briefs will
  // follow shortly. Strategists know already (they just approved).
  if (plan?.brand_id) {
    const brandJoin = Array.isArray(plan.brands) ? plan.brands[0] : plan.brands
    const brandName = (brandJoin?.name as string | null) ?? "Brand"
    const brandSlug = (brandJoin?.slug as string | null) ?? null
    const recipients = await recipientsForBrand({
      brandId: plan.brand_id as string,
      minRole: "designer",
      excludeUserId: user.id,
    })
    await notify({
      recipients,
      kind: "plan_approved",
      title: `Calendar approved for "${plan.name}"`,
      body: `${brandName} · ${(user.displayName ?? user.email)} approved the calendar. Copy + briefs are next.`,
      link: brandSlug ? `/brands/${brandSlug}/calendar/${planId}` : null,
      brandId: plan.brand_id as string,
      entityType: "campaign_plan",
      entityId: planId,
      actorUserId: user.id,
    })
  }

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
  const user = await requireRole("strategist")
  const supabase = await createSupabaseServerClient()
  const { data: emails } = await supabase
    .from("campaign_emails")
    .select("id")
    .eq("plan_id", planId)
    .order("sequence_number")
  for (const row of emails ?? []) await generateBriefForEmail(row.id)
  await supabase.from("campaign_plans").update({ status: "briefs_done" }).eq("id", planId)

  // Ping the designers: briefs are ready for them to work.
  const { data: plan } = await supabase
    .from("campaign_plans")
    .select("brand_id, name, brands(slug, name)")
    .eq("id", planId)
    .single()
  if (plan?.brand_id) {
    const brandJoin = Array.isArray(plan.brands) ? plan.brands[0] : plan.brands
    const brandName = (brandJoin?.name as string | null) ?? "Brand"
    const brandSlug = (brandJoin?.slug as string | null) ?? null
    const recipients = await recipientsForBrand({
      brandId: plan.brand_id as string,
      minRole: "designer",
      excludeUserId: user.id,
    })
    await notify({
      recipients,
      kind: "briefs_ready",
      title: `Briefs ready for "${plan.name}"`,
      body: `${brandName} · ${(emails?.length ?? 0)} ${emails && emails.length === 1 ? "brief is" : "briefs are"} ready to work.`,
      link: brandSlug ? `/brands/${brandSlug}/calendar/${planId}` : null,
      brandId: plan.brand_id as string,
      entityType: "campaign_plan",
      entityId: planId,
      actorUserId: user.id,
    })
  }

  revalidatePath(`/brands`)
}

const DeletePlanSchema = z.object({
  planId: z.string().uuid(),
  brandSlug: z.string().min(1),
  confirm: z.string().optional(),
  // Optional. When set, the action issues a server-side redirect to this
  // path on success so callers that are currently *on* the plan-detail
  // page don't try to refresh the deleted URL (which would 404).
  redirectTo: z.string().optional(),
})

export type DeletePlanResult = { ok: true } | { ok: false; error: string }

/**
 * Permanently deletes a plan plus its emails and series (FK cascades take
 * care of the children). Strategist+ only, audit-logged. Used from the
 * calendar list and from the plan detail header.
 */
export async function deletePlan(formData: FormData): Promise<DeletePlanResult> {
  const user = await requireRole("strategist")
  const parsed = DeletePlanSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, error: "Invalid input" }

  const supabase = await createSupabaseServerClient()
  const { data: plan } = await supabase
    .from("campaign_plans")
    .select("id, name, brand_id")
    .eq("id", parsed.data.planId)
    .single()
  if (!plan) return { ok: false, error: "Plan not found" }

  // Optional confirm-by-name. The plan-detail page asks for the campaign
  // name; the list-page quick delete skips this and trusts the modal.
  if (parsed.data.confirm && parsed.data.confirm.trim().toLowerCase() !== (plan.name as string).toLowerCase()) {
    return { ok: false, error: "Confirmation text didn't match the campaign name." }
  }

  const { error } = await supabase.from("campaign_plans").delete().eq("id", parsed.data.planId)
  if (error) return { ok: false, error: error.message }

  await recordAudit({
    userId: user.id,
    brandId: plan.brand_id as string,
    entityType: "campaign_plan",
    entityId: parsed.data.planId,
    action: "delete",
    meta: { name: plan.name },
  })

  revalidatePath(`/brands/${parsed.data.brandSlug}/calendar`)
  revalidatePath(`/brands/${parsed.data.brandSlug}`)
  revalidatePath("/")

  // Server-side redirect when requested so the caller (plan-detail page)
  // never gets a chance to refresh its own now-404 URL.
  if (parsed.data.redirectTo && parsed.data.redirectTo.startsWith("/")) {
    redirect(parsed.data.redirectTo)
  }
  return { ok: true }
}
