import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { generateText } from "ai";
import { openrouter, MODELS } from "@/lib/ai/client";

const SYSTEM = {
  prompt:
    "You write outreach system-prompts. Produce a sharp, specific system-prompt that controls tone, length, and style for cold outreach. Return only the prompt text.",
  offering:
    "You write crisp sales/recruiting offerings. Produce an offering in two short paragraphs covering: what it is, who it's for, the problem solved, what's different, and any proof points. Return only the offering text.",
} as const;

export async function POST(req: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;

  const { kind, text, instruction } = await req.json();
  if (!kind || !(kind in SYSTEM)) {
    return NextResponse.json(
      { error: "kind ('prompt'|'offering') required" },
      { status: 400 }
    );
  }
  if (!text && !instruction) {
    return NextResponse.json(
      { error: "Provide source text, guidance, or both" },
      { status: 400 }
    );
  }

  // Build a prompt from whatever's provided: raw material + guidance
  const parts: string[] = [];
  if (instruction) parts.push(`What this should be: ${instruction}`);
  if (text) parts.push(`Source material / draft to work from:\n${text}`);
  parts.push(
    "Write the final version. Follow the guidance above; use the source material only as raw facts to draw from, not as a template to preserve."
  );

  const { text: improved } = await generateText({
    model: openrouter(MODELS.fast),
    system: SYSTEM[kind as keyof typeof SYSTEM],
    prompt: parts.join("\n\n"),
    maxRetries: 1,
  });

  return NextResponse.json({ improved });
}
