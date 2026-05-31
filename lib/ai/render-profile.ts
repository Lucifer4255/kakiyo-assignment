import type { ProspectProfile } from "./schema";

/** Human-readable rendering of a ProspectProfile for injection into prompts. */
export function renderProfile(p: ProspectProfile): string {
  const lines: string[] = [];
  lines.push(`Name: ${p.name}`);
  lines.push(`Headline: ${p.headline}`);
  if (p.role || p.company) {
    lines.push(`Role: ${[p.role, p.company].filter(Boolean).join(" @ ")}`);
  }
  if (p.location) lines.push(`Location: ${p.location}`);
  lines.push(`Background: ${p.background}`);
  if (p.recentSignals.length) {
    lines.push(`Recent signals:\n${p.recentSignals.map((s) => `  - ${s}`).join("\n")}`);
  }
  if (p.technicalProfile) lines.push(`Technical profile: ${p.technicalProfile}`);
  if (p.interests.length) lines.push(`Interests: ${p.interests.join(", ")}`);
  if (p.likelyPainPoints.length) {
    lines.push(`Likely pain points:\n${p.likelyPainPoints.map((s) => `  - ${s}`).join("\n")}`);
  }
  return lines.join("\n");
}
