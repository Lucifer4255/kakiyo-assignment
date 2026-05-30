import { Firecrawl } from "@mendable/firecrawl-js";

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });

export async function scrapeUrl(url: string): Promise<string> {
  const result = await firecrawl.scrapeUrl(url, { formats: ["markdown"] });
  // Document type — markdown field holds the result
  return (result as { markdown?: string }).markdown ?? "";
}
