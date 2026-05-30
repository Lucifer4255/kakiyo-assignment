import { createOpenAI } from "@ai-sdk/openai";

export const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "",
    "X-Title": "Kakiyo Outreach",
  },
});

// Verify slugs at openrouter.ai/models — they drift
export const MODELS = {
  generation: "deepseek/deepseek-chat-v3-0324",    // best writer; swap to claude-sonnet-4 if quality suffers
  vision: "google/gemini-2.0-flash-lite",           // image → text (linkedin screenshots)
  fast: "google/gemini-2.0-flash-lite",             // synthesis + assists; cheap + fast
} as const;
