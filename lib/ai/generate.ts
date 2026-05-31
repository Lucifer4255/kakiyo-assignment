import { streamText, type ModelMessage } from "ai";
import { openrouter, MODELS } from "./client";
import { renderProfile } from "./render-profile";
import type { ProspectProfile } from "./schema";

// Never let the model invent specifics that weren't given. Asked-for details that
// aren't in the OFFERING (comp, pricing, timelines, headcount, dates) must be
// deflected with honest general language, not fabricated numbers.
const GROUNDING = `
Only state facts present in the OFFERING or PROSPECT context. Never invent
specifics — no salary/comp figures, prices, percentages, dates, team sizes, or
named claims — that aren't given. If they ask about something not specified
(e.g. compensation), say it's competitive and offer to share specifics on a call;
do not make up a number.`;

const OUTPUT_GUARD = `

---
Output ONLY the message text the user will send. No subject line, no label
scaffolding, no explanation, no surrounding quotes.${GROUNDING}`;

const REPLY_GUARD = `

---
Continue this outreach conversation naturally. Stay in the same voice and length
as the earlier messages. Address what they actually said. Output ONLY your next reply.${GROUNDING}`;

type OnFinish = (text: string) => void | Promise<void>;

type GenInput = {
  systemPrompt: string;
  offeringContent: string;
  profile: ProspectProfile;
  tone?: string | null;
  onFinish?: OnFinish;
  onError?: (error: unknown) => void | Promise<void>;
};

/** Cold outreach generation (§5.4c). */
export function generateOutreach({
  systemPrompt,
  offeringContent,
  profile,
  tone,
  onFinish,
  onError,
}: GenInput) {
  const system = systemPrompt + OUTPUT_GUARD;

  let userContext =
    `OFFERING (the value I bring):\n${offeringContent}\n\n` +
    `PROSPECT:\n${renderProfile(profile)}\n\n` +
    `Most relevant angles: ${profile.personalizationHooks.join(" | ")}`;

  if (tone) {
    userContext += `\n\nFor this version, write it: ${tone}`;
  }

  return streamText({
    model: openrouter(MODELS.generation),
    system,
    prompt: userContext,
    maxRetries: 1,
    onFinish: onFinish ? ({ text }) => onFinish(text) : undefined,
    onError: onError ? ({ error }) => onError(error) : undefined,
  });
}

type ReplyInput = {
  systemPrompt: string;
  offeringContent: string;
  profile: ProspectProfile;
  thread: { role: "assistant" | "prospect"; content: string }[];
  onFinish?: OnFinish;
};

/** Reply continuation (§5.4d) — full thread as message history. */
export function generateReply({
  systemPrompt,
  offeringContent,
  profile,
  thread,
  onFinish,
}: ReplyInput) {
  const system =
    systemPrompt +
    REPLY_GUARD +
    `\n\nOFFERING: ${offeringContent}\nPROSPECT: ${renderProfile(profile)}`;

  const messages: ModelMessage[] = thread.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  return streamText({
    model: openrouter(MODELS.generation),
    system,
    messages,
    maxRetries: 1,
    onFinish: onFinish ? ({ text }) => onFinish(text) : undefined,
  });
}
