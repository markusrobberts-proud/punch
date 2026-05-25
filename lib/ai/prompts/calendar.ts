import { z } from "zod"
import { generateObject } from "ai"
import { pickModel } from "@/lib/ai/gateway"
import { buildBrandContext, renderSystemPrompt } from "@/lib/knowledge/context-builder"
import { MONTHS } from "@/lib/campaigns"

const CalendarSchema = z.object({
  strategic_rationale: z
    .string()
    .describe("Why this calendar shape: cadence, themes, what's escalating across the month."),
  series: z
    .array(
      z.object({
        name: z.string(),
        theme: z.string().optional(),
        member_sequence: z
          .array(z.number().int())
          .describe("Sequence numbers of emails in this series, in send order."),
      }),
    )
    .describe("Multi-touch arcs (teaser/launch/reminder). Empty array if none."),
  emails: z
    .array(
      z.object({
        sequence_number: z.number().int().min(1),
        scheduled_date: z.string().describe("YYYY-MM-DD"),
        theme: z.string(),
        email_type: z.string().describe("e.g. promotional, nurture, announcement"),
        format: z.enum(["text", "designed", "sms"]),
        target_segment: z.string().describe("e.g. all subscribers, VIP, lapsed-90d"),
        strategic_rationale: z.string(),
      }),
    )
    .min(1),
})

export type GeneratedCalendar = z.infer<typeof CalendarSchema>

export async function generateCalendarPlan(args: {
  brandId: string
  campaignName?: string | null
  month: number
  year: number
  teamBrief: string | null
  targets: { designed: number | null; text: number | null; sms: number | null }
  cadence?: { emailsPerWeek: number | null; totalEmails: number | null }
}): Promise<GeneratedCalendar> {
  const ctx = await buildBrandContext(args.brandId)
  const monthName = MONTHS[args.month - 1]

  const cadenceLines: string[] = []
  if (args.cadence?.totalEmails != null) cadenceLines.push(`- Total emails this campaign: ${args.cadence.totalEmails}`)
  if (args.cadence?.emailsPerWeek != null) cadenceLines.push(`- Emails per week: ${args.cadence.emailsPerWeek}`)

  const intent = `Generate a ${monthName} ${args.year} email calendar for ${ctx.brand.name}.${
    args.campaignName ? `\n\nCampaign name: ${args.campaignName}` : ""
  }

Cadence targets:
- Designed emails: ${args.targets.designed ?? "use your judgement"}
- Text emails: ${args.targets.text ?? "use your judgement"}
- SMS sends: ${args.targets.sms ?? "0"}${cadenceLines.length ? `\n${cadenceLines.join("\n")}` : ""}

Team brief: ${args.teamBrief?.trim() || "(none provided; work from strategy + knowledge)"}

Output an ordered list of emails with theme, type, format, target segment, scheduled date, and rationale. Group multi-touch moments (launches, sales, events) into series with consistent tone and escalating urgency. If you need to go over or under the cadence targets to tell a better story, do, and explain why in strategic_rationale.`

  const { object } = await generateObject({
    model: pickModel("reasoning"),
    system: renderSystemPrompt(ctx, intent),
    prompt: "Produce the calendar now.",
    schema: CalendarSchema,
  })

  return object
}
