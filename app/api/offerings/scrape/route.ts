import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { scrapeUrl } from "@/lib/enrichment/firecrawl";
import { generateText } from "ai";
import { openrouter, MODELS } from "@/lib/ai/client";

export async function POST(req: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;

  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const scraped = await scrapeUrl(url);

  const { text: suggestedContent } = await generateText({
    model: openrouter(MODELS.fast),
    prompt: `Turn this scraped page into a crisp offering: what they do, who they sell to, the problem solved, what's different, proof points. Two short paragraphs.\n\n${scraped.slice(0, 8000)}`,
  });

  return NextResponse.json({ scraped, suggestedContent });
}
