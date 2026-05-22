import { z } from "zod"
import { generateObject } from "ai"
import { pickModel } from "@/lib/ai/gateway"
import { buildBrandContext, renderSystemPrompt } from "@/lib/knowledge/context-builder"

const DesignedBriefSchema = z.object({
  layout_template: z.string().describe("Recommended layout pattern (hero / split / cards / longform / etc.)"),
  imagery_notes: z.string(),
  colour_notes: z.string(),
  design_brief: z.string().describe("Full written brief the designer will work from."),
})

const TextBriefSchema = z.object({
  sender_identity: z.string().describe("Who signs the email — name + role."),
  design_brief: z.string().describe("Formatting + tone notes for the writer/sender."),
})

export type DesignedBrief = z.infer<typeof DesignedBriefSchema>
export type TextBrief = z.infer<typeof TextBriefSchema>

export async function generateDesignedBrief(args: {
  brandId: string
  email: {
    theme: string | null
    subject_line: string | null
    body_headline: string | null
    body_copy: string | null
    cta_text: string | null
    target_segment: string | null
  }
}): Promise<DesignedBrief> {
  const ctx = await buildBrandContext(args.brandId)
  const intent = `Write a design brief for this approved email:

Theme: ${args.email.theme ?? "—"}
Subject: ${args.email.subject_line ?? ""}
Headline: ${args.email.body_headline ?? ""}
Body: ${args.email.body_copy ?? ""}
CTA: ${args.email.cta_text ?? ""}
Audience: ${args.email.target_segment ?? "all subscribers"}

Output a designed-email brief: layout pattern, imagery direction, colour usage, and a full written brief for the designer.`

  const { object } = await generateObject({
    model: pickModel("drafting"),
    system: renderSystemPrompt(ctx, intent),
    prompt: "Write the design brief.",
    schema: DesignedBriefSchema,
  })

  return object
}

export async function generateTextBrief(args: {
  brandId: string
  email: {
    theme: string | null
    subject_line: string | null
    body_copy: string | null
    target_segment: string | null
  }
}): Promise<TextBrief> {
  const ctx = await buildBrandContext(args.brandId)
  const intent = `Write a brief for this text email:

Theme: ${args.email.theme ?? "—"}
Subject: ${args.email.subject_line ?? ""}
Body: ${args.email.body_copy ?? ""}
Audience: ${args.email.target_segment ?? "all subscribers"}

Decide who signs it (sender_identity — name + role at the brand) and provide formatting + tone notes. No visual design.`

  const { object } = await generateObject({
    model: pickModel("drafting"),
    system: renderSystemPrompt(ctx, intent),
    prompt: "Write the text-email brief.",
    schema: TextBriefSchema,
  })

  return object
}
