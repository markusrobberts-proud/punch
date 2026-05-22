import { z } from "zod"
import { generateObject } from "ai"
import { pickModel } from "@/lib/ai/gateway"
import { buildBrandContext, renderSystemPrompt } from "@/lib/knowledge/context-builder"

const EmailCopySchema = z.object({
  subject_line: z.string(),
  preview_text: z.string(),
  body_headline: z.string(),
  body_copy: z.string().describe("Full body copy. For text emails, write as a letter."),
  cta_text: z.string(),
  cta_url_suggestion: z.string().optional(),
  sms_body: z.string().optional().describe("Only for SMS sends."),
})

export type GeneratedCopy = z.infer<typeof EmailCopySchema>

export async function generateEmailCopy(args: {
  brandId: string
  email: {
    theme: string | null
    email_type: string | null
    format: "text" | "designed" | "sms"
    target_segment: string | null
    strategic_rationale: string | null
    scheduled_date: string | null
    sender_identity: string | null
  }
  siblings?: Array<{ sequence_number: number; theme: string | null; subject_line: string | null; body_headline: string | null }>
  feedback?: string
}): Promise<GeneratedCopy> {
  const ctx = await buildBrandContext(args.brandId)

  const formatGuidance =
    args.email.format === "text"
      ? `This is a TEXT email — write it as a letter from ${args.email.sender_identity ?? "the founder"}. No design treatment. Plain, personal, signed off.`
      : args.email.format === "sms"
        ? "This is an SMS send. Keep sms_body under 160 chars. body fields can be empty."
        : "This is a DESIGNED email. Body copy should pair well with imagery."

  const sibContext = args.siblings && args.siblings.length > 0
    ? `\n\nSibling campaigns in the same series (for tone consistency):\n${args.siblings
        .map((s) => `- #${s.sequence_number} "${s.subject_line ?? ""}" / ${s.body_headline ?? ""}`)
        .join("\n")}`
    : ""

  const intent = `Write the copy for this email:

- Theme: ${args.email.theme ?? "(unspecified)"}
- Type: ${args.email.email_type ?? "(unspecified)"}
- Format: ${args.email.format}
- Target segment: ${args.email.target_segment ?? "all subscribers"}
- Scheduled date: ${args.email.scheduled_date ?? "TBD"}
- Strategic rationale: ${args.email.strategic_rationale ?? "(none)"}

${formatGuidance}${sibContext}

${args.feedback ? `Previous feedback to incorporate this round: ${args.feedback}` : ""}`

  const { object } = await generateObject({
    model: pickModel("drafting"),
    system: renderSystemPrompt(ctx, intent),
    prompt: "Draft the copy now.",
    schema: EmailCopySchema,
  })

  return object
}
