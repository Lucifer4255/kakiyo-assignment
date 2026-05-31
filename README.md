# Kakiyo — AI Cold Outreach Platform

Generate hyper-personalized cold outreach, manage prospects, and handle replies — AI-powered end to end. You add a prospect (GitHub URL, any web URL, and/or LinkedIn screenshots), the app enriches them into a structured profile, and generation writes a message grounded in that profile plus your offering and your custom prompt. Paste a reply and it continues the thread naturally.

**Live demo:** _<add Vercel URL>_ · **Walkthrough video:** _<add link>_

---

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run db:push              # push Drizzle schema to your Neon Postgres
npm run dev                  # http://localhost:3000
```

### Environment variables (`.env.local`)

| Var | What |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string (use the **`-pooler`** host) |
| `BETTER_AUTH_SECRET` | Random 32+ char secret for Better Auth |
| `BETTER_AUTH_URL` | App origin (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_APP_URL` | Same app origin, exposed to the client |
| `OPENROUTER_API_KEY` | OpenRouter key — all LLM + vision calls |
| `FIRECRAWL_API_KEY` | Firecrawl key — URL scraping |
| `BETTER_AUTH_API_KEY` | Optional — for the Better Auth `dash()` monitor |
| `GITHUB_TOKEN` | Optional — raises the GitHub API rate limit |

---

## Architecture

The pivot is the **structured profile**. Enrichment runs once per prospect and writes a synthesized `ProspectProfile` (JSON). Generation only ever *reads* that profile — it never re-scrapes. Reply handling is the same generation call with the whole thread prepended as message history.

```
Prospect inputs            Enrichment                 Structured profile
(GitHub · URL ·     ──►    Firecrawl · GitHub    ──►  synthesized JSON
 LinkedIn shots)           API · vision model         (stored on prospect)
                                                              │
        Offering ─┐                                          ▼
   Custom prompt ─┼──────────────────────────────►  Generation (streamed)
                  │                                          │
                  └──────────  thread as history  ◄── Prospect reply (pasted)
```

**Flow by layer**

- **Enrichment** (`lib/enrichment/*`): each source is extracted independently (one failure doesn't abort the run) — GitHub via the REST API, web URLs via Firecrawl → markdown, LinkedIn screenshots via a vision model. The labelled sources are synthesized into a `ProspectProfile` with `generateObject` + a Zod schema, emphasizing *specific* personalization hooks.
- **Generation** (`lib/ai/generate.ts`): `streamText` over OpenRouter. The system prompt is the user's prompt + an output guard; the user turn carries the offering, the rendered profile, and the top hooks. A shared **grounding rule** forbids inventing specifics (comp, pricing, dates) not present in the offering.
- **Reply continuity**: `generateReply` maps the saved thread to `ModelMessage[]` (assistant/user roles) so the model continues the conversation rather than starting fresh.
- **Persistence**: streaming responses persist the final message server-side via the AI SDK `onFinish` callback; a failed stream cleans up its empty conversation via `onError`.
- **Analytics** (`app/api/analytics`): user-scoped aggregates — prospects, messages, conversations, reply rate, favorites, avg rating, and per-offering usage.

---

## Key decisions & tradeoffs

- **OpenRouter's own AI SDK provider** (`@openrouter/ai-sdk-provider`), not the generic OpenAI provider pointed at OpenRouter's base URL. The generic provider defaults to the OpenAI **Responses API** (`/responses`), which OpenRouter rejects for multi-turn `messages` — it broke reply handling. The dedicated provider targets `/chat/completions` and matches the AI SDK v6 model spec.
- **`pg` connection pool, not the Neon HTTP driver.** The HTTP driver does a one-shot fetch per query, which intermittently failed under network jitter on a long-running Node server. A pooled TCP connection (singleton-guarded against dev hot-reload) is more resilient and is the Neon-recommended setup with the pooled endpoint.
- **LinkedIn via vision over screenshots, not scraping.** LinkedIn blocks scraping by design. Screenshots are sent to the vision model as base64 and **not persisted** — only the extracted text is stored. Drops a file-storage dependency; flip to object storage if image retention is ever wanted.
- **Models** (`lib/ai/client.ts`): a strong writer for the graded message; a cheap/fast model for synthesis and the in-app "assist" generations; a vision model for screenshots. One key, switchable slugs.
- **Grounding guard** on generation so the model never fabricates numbers it wasn't given (e.g. it says "competitive comp" instead of inventing a salary band) — directly serves the "every message is read" grading bar.
- **Auth/CRUD kept minimal** (Better Auth email+password, Drizzle, TanStack Query) — correct and fast, not gold-plated, per the spec's priority order.

---

## Example: input → output

**Offering:** hiring a Backend/AI Engineer at Kakiyo.
**Prospect:** enriched from a GitHub profile + 3 LinkedIn screenshots (shipped an agentic legal-AI platform).

> The agentic legal AI platform you shipped at aLawyer.ai — handling real-time reasoning across complex legal contexts — is exactly the kind of infrastructure work we're tackling. We're hiring a Backend/AI Engineer to own our inference pipeline… Would you be open to learning more?

**Then the prospect replies:** _"Thanks! I'm happy where I am, but what's the comp range?"_

> Totally fair — glad you're in a good spot! Compensation is competitive, and I'd be happy to share specifics if you ever want to hop on a quick call. No pressure either way.

_(The follow-up addresses the actual question and stays in voice, without inventing a number.)_

---

## What I'd do with more time

- Manual edit of the synthesized profile on the prospect page (currently re-enrich to change it).
- AI-assist "Generate" on the Prompts page (Offerings already has it).
- Background job queue for enrichment instead of an in-request orchestrator.
- A/B compare two prompts on the same prospect side by side.
- Richer analytics (rating trend over time, per-prompt win rate).

---

## Tech stack

Next.js 16 (App Router, Turbopack) · TypeScript (strict) · Tailwind + shadcn/ui · TanStack Query · Drizzle ORM + Neon Postgres · Better Auth · Vercel AI SDK v6 · OpenRouter · Firecrawl.
