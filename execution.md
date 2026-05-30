# Execution Plan — AI Outreach Platform

Derived from `spec.md`. This is the build runbook: concrete, ordered steps, the files each touches, and a check to confirm the step is done. Order follows the spec's build phases (§10), which front-load de-risking (deploy on day 0) and protect the graded surface (P2–P4: enrichment, generation, reply).

**Guiding rule (from §1):** message quality > enrichment > reply continuity > visible customization > UI polish. When time slips, cut from P5; never from P2–P4.

---

## P0 — Scaffold & de-risk (Fri eve)

Goal: a deployed skeleton with auth, DB, and AI keys proven to work end to end. No features yet.

| # | Task | Files / commands | Done when |
|---|---|---|---|
| 0.1 | Init Next.js (App Router, TS strict, Tailwind) | `npx create-next-app@latest` → `tsconfig.json` strict, `tailwind.config.ts` | `npm run dev` serves a page; `tsc --noEmit` clean |
| 0.2 | Add shadcn/ui | `npx shadcn@latest init` then add `button card input dialog badge textarea sonner skeleton` | components render |
| 0.3 | Drizzle + Neon | `lib/db/index.ts`, `lib/db/schema.ts`, `drizzle.config.ts`, `DATABASE_URL` | `drizzle-kit push` connects to Neon |
| 0.4 | Better Auth (email + password only) | `lib/auth.ts`, `app/api/auth/[...all]/route.ts`, `lib/auth-client.ts` | sign-up writes a `user` row |
| 0.5 | OpenRouter smoke test | `lib/ai/client.ts` (Vercel AI SDK → OpenRouter base URL), `OPENROUTER_API_KEY` | a test `generateText` returns tokens |
| 0.6 | Firecrawl smoke test | `lib/enrichment/firecrawl.ts`, `FIRECRAWL_API_KEY` | scraping kakiyo.com returns markdown |
| 0.7 | Env scaffolding | `.env.local`, `.env.example` (all of §12) | `.env.example` lists every key |
| 0.8 | **Deploy skeleton to Vercel** | Vercel project + Neon integration; set env vars | live URL serves the app; auth works on prod |

**Exit P0:** fresh visitor can sign up and sign in on the deployed URL.

---

## P1 — Schema + CRUD (Sat AM)

Goal: all app tables and the commodity CRUD for offerings, prompts, prospects, wired through Route Handlers + TanStack Query with basic UI.

### Schema (`lib/db/schema.ts`) — §4
- [ ] `offering`, `prompt`, `prospect`, `prospect_source`, `conversation`, `message` exactly per §4.
- [ ] Indexes: `prospect.userId`, `conversation.prospectId`, `message.conversationId`.
- [ ] `prospect.profile` is `jsonb`; `message.role` ∈ `assistant|prospect`; `enrichmentStatus` ∈ `pending|enriching|ready|failed`.
- [ ] Run `drizzle-kit push`.

### Shared plumbing
- [ ] `lib/auth-helpers.ts` — `requireUser()` resolving Better Auth session, returns 401 if absent. **Every handler uses it and scopes every query by `userId`.**
- [ ] TanStack Query provider in `app/(app)/layout.tsx`; `QueryClient` setup.
- [ ] `app/(app)/layout.tsx` — sidebar nav + session guard (redirect to sign-in).

### Route Handlers (§6) + Query hooks
| Handler | Methods | Hook file |
|---|---|---|
| `/api/offerings` (+ `/[id]`, `/scrape`) | GET POST PATCH DELETE + POST scrape | `hooks/use-offerings.ts` |
| `/api/prompts` (+ `/[id]`, setDefault) | GET POST PATCH DELETE | `hooks/use-prompts.ts` |
| `/api/prospects` (+ `/[id]`) | GET POST PATCH DELETE | `hooks/use-prospects.ts` |

### Pages (basic, list + form)
- [ ] `app/(auth)/sign-in/page.tsx`, `sign-up/page.tsx`
- [ ] `app/(app)/offerings/page.tsx` — list + create/edit
- [ ] `app/(app)/prompts/page.tsx` — list + edit + set default
- [ ] `app/(app)/prospects/page.tsx` — list with status badge (stub badges OK)

**Exit P1 / AC:** a second user can never see or fetch the first user's rows (verify by signing in as user B and hitting user A's `/[id]`).

---

## P2 — Enrichment pipeline (Sat midday) — GRADED, do not cut

Goal: prospect save kicks off enrichment that produces a stored, specific `ProspectProfile`. Profile shown + editable.

### Per-source extractors (§5.2) — `lib/enrichment/`
- [ ] `github.ts` — parse username from URL → `GET api.github.com/users/{u}` + `/repos?sort=updated&per_page=10` → bio, top languages, notable/recent repos. (Optional `GITHUB_TOKEN`.)
- [ ] `firecrawl.ts` — `website|company|other` → markdown.
- [ ] `vision.ts` — `linkedin_screenshot` → base64 to vision model → extracted text (prompt 5.4a verbatim as start). **Screenshot not persisted** — store only text in `prospect_source.rawExtracted`.

### Synthesis (§5.1, §5.4b)
- [ ] `lib/ai/schema.ts` — Zod schema mirroring `ProspectProfile` exactly.
- [ ] `lib/enrichment/synthesize.ts` — concatenate all `rawExtracted` labelled by source → one `generateObject` call (prompt 5.4b verbatim) → `ProspectProfile`.
- [ ] `lib/enrichment/run.ts` — orchestrator: set `enriching`; run each source, **one failed source must not abort** (collect, note gaps); synthesize; store profile; set `ready` (or `failed`). Run inline in the POST request or fire-and-forget + status polling. **No job queue.**

### API + UI
- [ ] `POST /api/prospects` accepts `{ name, sources, screenshots? }`, creates rows, triggers `run.ts`.
- [ ] `POST /api/prospects/[id]/reenrich` (optional).
- [ ] `app/(app)/prospects/[id]/page.tsx` — editable profile view + sources list + status badge; `PATCH` saves manual profile edits.

**Tune synthesis until `personalizationHooks` are SPECIFIC and timely** — concrete referenceable things, no generic filler. This is the highest-leverage field.

**Exit P2 / AC:** GitHub-only prospect enriches; screenshot + 2 URLs → coherent profile; one bad URL doesn't fail the whole enrichment.

---

## P3 — Generation + streaming + history (Sat PM) — GRADED, do not cut

Goal: offering + prompt + profile → streamed message saved to history, with full controls.

### Generation core (§5.3, §5.4c)
- [ ] `lib/ai/generate.ts` — build message array: **system** = user's `systemPrompt` verbatim + minimal output guard (prompt 5.4c); **user** = offering + readable profile + hooks; optional tone/angle override appended.
- [ ] `POST /api/generate` `{ prospectId, offeringId, promptId, tone? }` → **stream** (Route Handler returning streamed text via `streamText`). Creates `conversation` + first `assistant` `message`. **Persist final message server-side after stream completes.**

### History controls (§5.4e assists too)
- [ ] `PATCH /api/messages/[id]` `{ rating?, isFavorite? }`; `DELETE /api/messages/[id]`.
- [ ] `POST /api/assist` `{ kind:'prompt'|'offering', text } → { improved }` (cheap model).
- [ ] `POST /api/offerings/scrape` → `{ scraped, suggestedContent }` using offering-from-scrape assist (5.4e).

### UI — generate panel on prospect page (§7)
- [ ] Stream message into thread; copy / rate / favorite / regenerate controls.
- [ ] Regenerate offers tone/angle chips (Direct / Warm / Lead with pain point / Shorter) — **no re-entry**.

### Model A/B (§3)
- [ ] Verify exact OpenRouter slugs (they drift). A/B generation models; pick the most human, least salesy. Tune the generation prompt against the Sarah/Kakiyo example until quality matches or beats it.

**Exit P3 / AC:** generated message references a specific hook (not filler); regenerate with a different tone produces a meaningfully different message for the same prospect; editing the prompt visibly changes output; switching offering changes output.

---

## P4 — Reply handling (Sun AM) — GRADED, do not cut

Goal: paste a reply → contextual continuation using the full thread.

- [ ] `lib/ai/reply.ts` — same system + offering/profile context; **pass full thread as message history** (`assistant`→`assistant`, `prospect`→`user`); generate next `assistant` turn (prompt 5.4d).
- [ ] `POST /api/conversations/[id]/reply` `{ replyText }` → **stream**; appends `prospect` message + new `assistant` message; persist after stream.
- [ ] `GET /api/conversations/[id]` → conversation + messages.
- [ ] Thread UI on prospect page — always visible; paste-reply input; streams the continuation.

**Exit P4 / AC:** follow-up addresses the actual pasted reply content, keeps original tone, reads as continuation not restart.

---

## P5 — Analytics + UI polish (Sun midday) — cut here first if time slips

### Analytics (§9)
- [ ] `GET /api/analytics` (user-scoped): `totalMessages` (count assistant msgs), `offeringUsage[]` (count conversations grouped by offeringId + name), `prospectCount`, `conversationsWithReplies` (distinct conversations having a `prospect` message).
- [ ] `app/(app)/dashboard/page.tsx` — 4 stat cards + one bar chart for offering usage. No more.

### Polish
- [ ] Empty states carry the explainer copy (assignment's own wording) for offerings + prompts.
- [ ] Loading / streaming / error states everywhere; toasts on mutations.
- [ ] Mobile sanity pass.

**Exit P5 / AC:** numbers match the DB; "conversations with replies" only counts threads with a `prospect` message.

---

## P6 — Ship (Sun PM)

- [ ] Final deploy to Vercel; all env vars set in prod.
- [ ] End-to-end smoke test **as a fresh user**: sign up → offering via URL scrape → customize prompt → save multi-input prospect → generate → handle a reply → analytics.
- [ ] README (§13): local run, project structure + architecture decisions, env vars, tradeoffs + why, "what I'd do with more time" (pull from §11 non-goals), and **3–4 real input→output examples** showing range (different prompt/offering → visibly different output).
- [ ] Video walkthrough narrating decisions (§13).

---

## Cross-cutting invariants (hold throughout)

- **User scoping (§6):** every handler resolves session, 401 if absent, filters every query by `userId`. No cross-user row reachable. This is AC #1 and the easiest thing to get wrong.
- **Streaming persistence:** generation and reply both stream; persist the final message server-side *after* the stream completes — never rely on the client to save.
- **Profile is the pivot (§2):** enrichment writes `prospect.profile` once; generation reads it and never re-scrapes.
- **System prompt verbatim (§5.3):** user's `systemPrompt` goes in as the system message almost verbatim + only a minimal output guard. Customization must steer the model.
- **Retries:** at most a single retry on AI calls. No caching, rate limiting, or queues (§11).
- **TS strict + no LLM framework** (no LangChain/LlamaIndex; no RAG/agents).

## Decisions to defend (§14) — keep notes for README/video

Structured profile over raw text; vision for LinkedIn but scrape elsewhere; GitHub API over scraping; user prompt as literal system prompt; thread-as-history for replies; no LLM framework; Next.js + TanStack Query over TanStack Start; screenshots not persisted.

## Models to lock at build time (§3) — slugs drift, verify live
- Generation: top writing model (e.g. `anthropic/claude-sonnet-4` or `openai/gpt-4o`) — A/B for least-salesy.
- Vision: `openai/gpt-4o` or `google/gemini-2.0-flash`.
- Synthesis / assists: fast cheap model (`google/gemini-2.0-flash` or similar).
