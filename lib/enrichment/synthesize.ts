import { generateObject } from "ai";
import { openrouter, MODELS } from "@/lib/ai/client";
import { ProspectProfileSchema, type ProspectProfile } from "@/lib/ai/schema";

const SYNTHESIS_SYSTEM = `You build a structured outreach profile from raw context about a prospect.
Rules:
- personalizationHooks must be SPECIFIC and timely — things a human could
  reference in a first line that prove "I actually looked you up." No generic
  filler like "passionate about technology." Examples of good hooks:
  "posted last week about struggling with cold email reply rates",
  "just open-sourced an MCP client with 300 stars",
  "recently moved from IC engineer to Head of Product at a 20-person startup".
- recentSignals are datable/recent events only (job changes, posts, launches, repos).
- likelyPainPoints must be inferred from their actual context, not generic.
- If a field is unknown, use null or an empty array. Never fabricate.`;

export async function synthesizeProfile(labelledSources: string): Promise<ProspectProfile> {
  const { object } = await generateObject({
    model: openrouter(MODELS.fast),
    schema: ProspectProfileSchema,
    system: SYNTHESIS_SYSTEM,
    prompt: `Here is everything gathered about the prospect, labelled by source:\n\n${labelledSources}`,
  });

  return object;
}
