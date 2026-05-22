import { createSupabaseServerClient } from "@/lib/supabase/server"

type BrandRow = {
  id: string
  name: string
  tone_of_voice: string | null
  target_audience: string | null
  prefer_brand_over_strategy: boolean
}

type KnowledgeRow = {
  source_type: string
  title: string
  content: string | null
  created_at: string
}

type StrategySection = { title: string; body: string | null; position: number }

export type GenerationContext = {
  brand: BrandRow
  proudStrategy: string
  brandKnowledge: string
  recentCampaigns: string
}

/**
 * Builds the system-prompt context that every Claude generation reads.
 * Honours the per-brand "prefer brand over strategy" toggle by ordering
 * the relevant blocks in the system prompt.
 */
export async function buildBrandContext(brandId: string): Promise<GenerationContext> {
  const supabase = await createSupabaseServerClient()

  const [{ data: brand }, { data: knowledge }, { data: strategy }, { data: recent }] = await Promise.all([
    supabase
      .from("brands")
      .select("id,name,tone_of_voice,target_audience,prefer_brand_over_strategy")
      .eq("id", brandId)
      .maybeSingle(),
    supabase
      .from("knowledge_items")
      .select("source_type,title,content,created_at")
      .eq("brand_id", brandId)
      .eq("review_status", "approved")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("proud_strategy_sections")
      .select("title,body,position")
      .order("position", { ascending: true }),
    supabase
      .from("campaign_emails")
      .select("theme,email_type,format,subject_line,body_headline,scheduled_date")
      .eq("brand_id", brandId)
      .not("subject_line", "is", null)
      .order("scheduled_date", { ascending: false })
      .limit(15),
  ])

  const proudStrategy = (strategy as StrategySection[] | null ?? [])
    .filter((s) => s.body && s.body.trim().length > 0)
    .map((s) => `## ${s.title}\n${s.body}`)
    .join("\n\n")

  const brandKnowledge = (knowledge as KnowledgeRow[] | null ?? [])
    .map((k) => `### [${k.source_type}] ${k.title}\n${k.content ?? ""}`)
    .join("\n\n---\n\n")

  const recentCampaigns = (recent as Array<{ theme: string | null; email_type: string | null; format: string | null; subject_line: string | null; body_headline: string | null; scheduled_date: string | null }> | null ?? [])
    .map((c) =>
      `- ${c.scheduled_date ?? "?"} · ${c.format ?? "?"} · ${c.theme ?? "–"} · "${c.subject_line ?? ""}" / ${c.body_headline ?? ""}`,
    )
    .join("\n")

  return {
    brand: (brand as BrandRow) ?? { id: brandId, name: "Unknown", tone_of_voice: null, target_audience: null, prefer_brand_over_strategy: false },
    proudStrategy,
    brandKnowledge,
    recentCampaigns,
  }
}

export function renderSystemPrompt(ctx: GenerationContext, intent: string) {
  const brandBlock = `# Brand: ${ctx.brand.name}
Tone of voice: ${ctx.brand.tone_of_voice ?? "(not set)"}
Target audience: ${ctx.brand.target_audience ?? "(not set)"}

## Approved brand knowledge
${ctx.brandKnowledge || "(none yet)"}

## Recent campaigns
${ctx.recentCampaigns || "(none yet)"}`

  const strategyBlock = `# Proud Strategy: how we think about email at Proud
${ctx.proudStrategy || "(strategy doc empty)"}`

  const first = ctx.brand.prefer_brand_over_strategy ? brandBlock : strategyBlock
  const second = ctx.brand.prefer_brand_over_strategy ? strategyBlock : brandBlock

  return `You are Proud Creative's expert email marketing strategist for ${ctx.brand.name}.

${first}

${second}

# Your task
${intent}

Ground every choice in the inputs above. Show your reasoning.`
}
