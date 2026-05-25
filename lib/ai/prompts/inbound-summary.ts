import { z } from "zod"
import { generateObject } from "ai"
import { pickModel } from "@/lib/ai/gateway"

const InboundSummarySchema = z.object({
  title: z.string().max(180).describe("A short, scannable title for this email (under 120 chars)."),
  summary: z.string().describe("3-6 sentences capturing the substance: who said what, what decisions or facts emerged, anything Claude should remember on future generations."),
  key_facts: z.array(z.string()).max(8).describe("Concrete bullet points a copywriter would want to lift from this email."),
})

export type InboundSummary = z.infer<typeof InboundSummarySchema>

export async function summariseInboundEmail(args: {
  brandName: string
  from: string
  subject: string
  body: string
}): Promise<InboundSummary> {
  const trimmedBody = args.body.slice(0, 30_000)
  const { object } = await generateObject({
    model: pickModel("parsing"),
    system: `You parse forwarded emails into a knowledge-bank entry for ${args.brandName}'s email marketing. Be concrete, lift specifics, drop signatures and footers.

From: ${args.from}
Subject: ${args.subject}

Body:
${trimmedBody}`,
    prompt: "Extract the summary now.",
    schema: InboundSummarySchema,
  })
  return object
}
