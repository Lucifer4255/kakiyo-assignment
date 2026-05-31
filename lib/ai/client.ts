import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// OpenRouter's own AI SDK provider. It targets /chat/completions (never the
// OpenAI Responses API), so multi-turn `messages` threads stream correctly —
// the generic OpenAI provider defaulted to /responses, which OpenRouter rejects.
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  appName: "Kakiyo Outreach",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
});

// Slugs verified against openrouter.ai/models
export const MODELS = {
  generation: "deepseek/deepseek-v4-pro",        // best writer for the graded message
  vision: "google/gemini-3.1-flash-lite",        // image → text (linkedin screenshots)
  fast: "deepseek/deepseek-v4-flash",            // synthesis + assists; cheap + fast
} as const;
