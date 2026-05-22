import { createSupabaseServerClient } from "./supabase/server"

export type PlanStatus =
  | "draft" | "generating" | "pending_review" | "calendar_approved"
  | "copy_generating" | "copy_done" | "briefs_done" | "complete" | "error"

export type StageStatus = "pending" | "generating" | "done" | "needs_review" | "error"

export type CampaignPlan = {
  id: string
  brand_id: string
  name: string
  month: number
  year: number
  team_brief: string | null
  strategic_rationale: string | null
  target_designed_count: number | null
  target_text_count: number | null
  target_sms_count: number | null
  status: PlanStatus
  approved_at: string | null
  created_at: string
}

export type CampaignEmail = {
  id: string
  plan_id: string
  brand_id: string
  series_id: string | null
  sequence_number: number
  scheduled_date: string | null
  theme: string | null
  email_type: string | null
  format: "text" | "designed" | "sms"
  target_segment: string | null
  strategic_rationale: string | null
  subject_line: string | null
  preview_text: string | null
  body_headline: string | null
  body_copy: string | null
  cta_text: string | null
  cta_url: string | null
  sender_identity: string | null
  sms_body: string | null
  layout_template: string | null
  design_brief: string | null
  imagery_notes: string | null
  colour_notes: string | null
  copy_status: StageStatus
  brief_status: StageStatus
  regeneration_feedback: unknown
}

export async function listPlansForBrand(brandId: string): Promise<CampaignPlan[]> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("campaign_plans")
    .select("*")
    .eq("brand_id", brandId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
  return (data ?? []) as CampaignPlan[]
}

export async function getPlanWithEmails(planId: string) {
  const supabase = await createSupabaseServerClient()
  const [{ data: plan }, { data: emails }] = await Promise.all([
    supabase.from("campaign_plans").select("*").eq("id", planId).maybeSingle(),
    supabase
      .from("campaign_emails")
      .select("*")
      .eq("plan_id", planId)
      .order("sequence_number", { ascending: true }),
  ])
  return {
    plan: (plan ?? null) as CampaignPlan | null,
    emails: (emails ?? []) as CampaignEmail[],
  }
}

export { MONTHS } from "./months"
