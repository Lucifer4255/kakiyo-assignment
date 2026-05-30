import { generateText } from "ai";
import { openrouter, MODELS } from "@/lib/ai/client";

const VISION_SYSTEM = `You extract professional context from a LinkedIn profile screenshot.
Return concise plain text covering: name, current role and company, headline,
location, recent posts or activity visible, career background, and any signals
about what they care about or struggle with. Only state what is visible in the
image. Do not invent. If something isn't shown, omit it.`;

export async function extractLinkedInScreenshot(base64: string): Promise<string> {
  // Strip data URI prefix if present
  const imageData = base64.replace(/^data:image\/[a-z]+;base64,/, "");

  const { text } = await generateText({
    model: openrouter(MODELS.vision),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VISION_SYSTEM },
          {
            type: "image",
            image: imageData,
          },
        ],
      },
    ],
  });

  return text;
}
