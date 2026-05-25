import { z } from "zod"
import { generateObject } from "ai"
import { pickModel } from "@/lib/ai/gateway"

const BrandProfileSchema = z.object({
  one_liner: z.string().describe("One sentence that captures what this brand is and stands for."),
  industry: z.string().describe(
    'Best-fit industry label (e.g. "Fashion", "Footwear", "Specialty coffee", "Beauty", "Home"). 1-3 words max.',
  ),
  tone_of_voice: z.string().describe("3-5 sentences on how this brand sounds. Cite specific phrases or stylistic moves from the source pages."),
  target_audience: z.string().describe("Who the brand is for. Demographics, psychographics, the kind of decision they're making."),
  voice_principles: z.array(z.string()).max(8).describe("Concrete dos and don'ts: short, actionable craft rules."),
  positioning: z.string().describe("How this brand differentiates from competitors. What's unique?"),
  product_themes: z.array(z.string()).max(10).describe("The main product categories, lines, or signature offerings observed."),
  key_facts: z.array(z.string()).max(12).describe("Concrete facts a copywriter would want at hand: founding story, materials, locations, founders, awards, partnerships, certifications, dates."),
  suggested_primary_color: z
    .string()
    .optional()
    .describe('Best-guess primary brand colour from the source pages, as a #rrggbb hex string. Omit if unclear.'),
})

export type BrandProfile = z.infer<typeof BrandProfileSchema>

export async function extractBrandProfile(args: {
  brandName: string
  websiteUrl: string
  pages: Array<{ url: string; title: string; text: string }>
}): Promise<BrandProfile> {
  const corpus = args.pages
    .map((p) => `### ${p.title}\n${p.url}\n\n${p.text}`)
    .join("\n\n---\n\n")
    .slice(0, 60_000)

  const system = `You are an expert brand strategist. You read a brand's own website and extract a structured profile a copywriter can use for every future email.

Be specific and concrete. Quote the brand's own language where it sharpens the tone. Avoid generic marketing-speak. If a field can't be determined from the source, write "Insufficient signal in source pages" rather than guessing.

Brand: ${args.brandName}
Website: ${args.websiteUrl}

Source pages:
${corpus}`

  const { object } = await generateObject({
    model: pickModel("parsing"),
    system,
    prompt: "Extract the structured brand profile now.",
    schema: BrandProfileSchema,
  })

  return object
}

export function formatBrandProfileMarkdown(profile: BrandProfile): string {
  return [
    `# Brand profile`,
    ``,
    `**One-liner.** ${profile.one_liner}`,
    `**Industry.** ${profile.industry}`,
    ``,
    `## Tone of voice`,
    profile.tone_of_voice,
    ``,
    `## Target audience`,
    profile.target_audience,
    ``,
    `## Positioning`,
    profile.positioning,
    ``,
    `## Voice principles`,
    ...profile.voice_principles.map((p) => `- ${p}`),
    ``,
    `## Product themes`,
    ...profile.product_themes.map((p) => `- ${p}`),
    ``,
    `## Key facts`,
    ...profile.key_facts.map((p) => `- ${p}`),
  ].join("\n")
}
