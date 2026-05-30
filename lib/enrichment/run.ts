import { db } from "@/lib/db";
import { prospect, prospectSource } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { extractGitHub } from "./github";
import { scrapeUrl } from "./firecrawl";
import { extractLinkedInScreenshot } from "./vision";
import { synthesizeProfile } from "./synthesize";

export async function runEnrichment(
  prospectId: string,
  screenshots: string[] = []
): Promise<void> {
  await db
    .update(prospect)
    .set({ enrichmentStatus: "enriching" })
    .where(eq(prospect.id, prospectId));

  const sources = await db
    .select()
    .from(prospectSource)
    .where(eq(prospectSource.prospectId, prospectId));

  const labelled: string[] = [];

  // Extract each URL-based source — one failure must not abort the rest
  for (const source of sources) {
    if (source.type === "linkedin_screenshot") continue; // handled via screenshots arg

    try {
      let extracted = "";
      if (source.type === "github" && source.value) {
        extracted = await extractGitHub(source.value);
      } else if (
        ["website", "company", "other"].includes(source.type) &&
        source.value
      ) {
        extracted = await scrapeUrl(source.value);
      }

      if (extracted) {
        labelled.push(`[${source.type.toUpperCase()}]\n${extracted}`);
        await db
          .update(prospectSource)
          .set({ rawExtracted: extracted })
          .where(eq(prospectSource.id, source.id));
      }
    } catch (err) {
      console.error(`[enrichment] source ${source.id} (${source.type}) failed:`, err);
    }
  }

  // Extract LinkedIn screenshots via vision
  const screenshotSources = sources.filter((s) => s.type === "linkedin_screenshot");
  for (let i = 0; i < screenshots.length; i++) {
    try {
      const extracted = await extractLinkedInScreenshot(screenshots[i]);
      labelled.push(`[LINKEDIN_SCREENSHOT]\n${extracted}`);
      if (screenshotSources[i]) {
        await db
          .update(prospectSource)
          .set({ rawExtracted: extracted })
          .where(eq(prospectSource.id, screenshotSources[i].id));
      }
    } catch (err) {
      console.error(`[enrichment] vision extraction failed:`, err);
    }
  }

  if (labelled.length === 0) {
    await db
      .update(prospect)
      .set({ enrichmentStatus: "failed" })
      .where(eq(prospect.id, prospectId));
    return;
  }

  try {
    const profile = await synthesizeProfile(labelled.join("\n\n---\n\n"));
    await db
      .update(prospect)
      .set({ profile: profile as Record<string, unknown>, enrichmentStatus: "ready" })
      .where(eq(prospect.id, prospectId));
  } catch (err) {
    console.error(`[enrichment] synthesis failed:`, err);
    await db
      .update(prospect)
      .set({ enrichmentStatus: "failed" })
      .where(eq(prospect.id, prospectId));
  }
}
