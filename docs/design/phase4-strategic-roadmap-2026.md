# CodexAtlas — Phase 4 Strategic Roadmap
**Date:** 2026-03-19
**Status:** Approved for execution
**Author:** H. Tall + Claude Sonnet 4.6

---

## Context

Phase 3 (ingestion rework, corpus browser, translation quality, admin bulk ops) is complete. This document governs Phase 4, which addresses four parallel threads:

1. **Translation reliability** — AI translation jobs fail occasionally; need rock-solid reliability before scaling
2. **Comparison** — the compare UI exists but is shallow; comparison data in the DB is not surfaced
3. **Hierarchical summary pyramid** — vision for passage → chapter → book → grand unified AI assessment
4. **Contributor model** — how users eventually fund AI tasks (deferred until credit system is viable)

---

## 1. Translation Reliability

### Root causes of current failures

| Issue | Root Cause | Severity |
|-------|-----------|---------|
| JSON parse failure | Model returns markdown fences or preamble; `parseTranslationResponse` fallback doesn't cover all cases | High |
| Timeout on long passages | 50s AbortController inside 60s Vercel function limit; close to the edge on dense texts | Medium |
| Batch stops on tab close | Client-side orchestration in `batch-translate-panel.tsx`; browser close = job stops | Medium |
| Retries too narrow | Only 429/529 retried; 500/502/503 and network errors fail immediately | Medium |
| Outdated model | `claude-sonnet-4-20250514` — should be `claude-sonnet-4-6` | Low |
| Partial DB writes | Evidence record + translation version written separately; second write failure orphans evidence record | Low |

### Fix sequence

#### Fix 1 — Tool use for guaranteed structured output
**File:** `app/src/app/api/translate/route.ts`
**Effort:** 2–3 hrs
**Impact:** Eliminates parse failures completely

Replace the JSON-in-prompt approach with Anthropic's `tool_choice: "any"` forced output. The model cannot respond without calling the tool, so the response is always a typed object — no regex stripping, no fallback parsing.

```typescript
tools: [{
  name: "submit_translation",
  description: "Submit the completed translation with confidence assessment",
  input_schema: {
    type: "object" as const,
    properties: {
      translated_text: { type: "string", description: "The full translation" },
      confidence_score: { type: "number", minimum: 0, maximum: 1 },
      translation_notes: { type: "string", description: "Scholarly notes on the translation" },
      key_decisions: { type: "array", items: { type: "string" }, description: "Key translation decisions" }
    },
    required: ["translated_text", "confidence_score", "translation_notes", "key_decisions"]
  }
}],
tool_choice: { type: "tool", name: "submit_translation" }
// Extract: const toolResult = message.content.find(b => b.type === "tool_use");
// const result = toolResult.input as TranslationResult;
```

Remove `parseTranslationResponse()` function and all JSON parsing code from the route. Also update `buildTranslationPrompt()` to remove the "respond with JSON only" instruction — it's no longer needed and may confuse tool use.

#### Fix 2 — Model update
**File:** `app/src/app/api/translate/route.ts`
**Effort:** 30 min

Change `claude-sonnet-4-20250514` → `claude-sonnet-4-6`.
Search for hardcoded model strings in `lib/utils/translation-prompts.ts` and update.

#### Fix 3 — Exponential backoff + broader retry scope
**File:** `app/src/app/api/translate/route.ts`
**Effort:** 2 hrs

```typescript
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 529]);
const MAX_RETRIES = 3;

async function callWithRetry(fn: () => Promise<Response>): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fn();
    if (res.ok || !RETRYABLE_STATUSES.has(res.status) || attempt === MAX_RETRIES) return res;
    const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 30000);
    await new Promise(r => setTimeout(r, delay));
  }
}
```

Also handle `AbortError` (timeout) with 1 retry after 5s delay.

#### Fix 4 — Streaming to defeat Vercel function timeout
**File:** `app/src/app/api/translate/route.ts`
**Effort:** 4–6 hrs

Replace `anthropic.messages.create()` with `anthropic.messages.stream()`. Stream the SSE response to the client via a `ReadableStream`. Streaming functions on Vercel stay alive for the duration of the stream (not subject to the 60s CPU limit in the same way). The client reads the full streamed response before parsing — no change needed to client-side code if the final payload format is unchanged.

```typescript
// Route returns a streaming Response
const stream = anthropic.messages.stream({ ... tools ... });
const readable = new ReadableStream({
  async start(controller) {
    for await (const event of stream) {
      if (event.type === "message_stop") {
        const finalMsg = await stream.finalMessage();
        const toolBlock = finalMsg.content.find(b => b.type === "tool_use");
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ result: toolBlock?.input, usage: finalMsg.usage })));
        controller.close();
      }
    }
  }
});
return new Response(readable, { headers: { "Content-Type": "application/json" } });
```

#### Fix 5 — Resumable batch
**File:** `app/src/app/(main)/admin/batch-translate-panel.tsx`
**Effort:** 1 hr

The batch scan already skips already-translated passages. Add a "Resume batch" button that re-runs the scan (same manuscript + language) and starts from the first untranslated passage. Store the current job's `{ manuscriptId, language, agentTaskId }` in `sessionStorage` so the state survives a page reload (but not a full browser close).

#### Fix 6 — DB write atomicity
**File:** Supabase stored procedure (new migration)
**Effort:** 1 hr

Create RPC `create_translation_with_evidence(...)` that wraps evidence record creation + translation version creation in a single transaction. Call from the translate route instead of two separate Supabase calls.

---

## 2. Comparison Enhancements

### What already exists
- `/read/[book]/[chapter]/compare` — side-by-side two manuscripts, toggle between original/translation
- `computeWordDiff()` utility in `variant-comparison-view.tsx` — word-level diff already written
- `variant_comparisons` table — pairwise `similarity_score`, `diff_data` JSONB — **not wired to UI**
- `variants` + `variant_readings` — scholarly variant metadata from admin detect-variants

### What to add

#### Enhancement 1 — Show translation diff + confidence in compare view
**File:** `app/src/app/(main)/read/[book]/[chapter]/compare/compare-selector.tsx`
**Effort:** 1–2 days

In translation mode:
- Render a word-level diff between the two translations using the existing `computeWordDiff()` utility (import it from `variant-comparison-view.tsx` or move to a shared util)
- Show confidence score badges under each manuscript header
- Show translation notes as an expandable section ("Show notes →")
- Show key decisions as a collapsible bullet list

In original text mode (current behaviour):
- If a `variant_comparisons` row exists for this pair, show the similarity score as a badge ("87% similar")

#### Enhancement 2 — Cross-passage summary comparison
When chapter summaries exist (Tier 3), add a "Compare summaries" toggle to the compare view showing both manuscripts' chapter-level AI summaries side by side.

---

## 3. Hierarchical Summary Pyramid

### Vision
```
Passage summary         → ~80 words,  Haiku    [EXISTS: passages.metadata.ai_summary]
       ↓ (aggregate N passages per chapter per manuscript)
Chapter summary         → ~200 words, Haiku    [MISSING]
       ↓ (aggregate N chapter summaries per book per manuscript)
Book summary            → ~400 words, Sonnet   [MISSING]
       ↓
Manuscript summary      → ~500 words, Haiku    [EXISTS: manuscripts.metadata.ai_summary]
       ↓ (aggregate across manuscripts for the same text)
Cross-manuscript synthesis → ~600 words, Sonnet [MISSING]
       ↓ (all of the above)
Grand unified assessment → ~1500 words, Opus   [MISSING — the centrepiece]
```

Each level is generated on demand and cached. The grand assessment is regenerated by admins as more data accumulates — it should evolve visibly over time as more translations and comparisons are added.

### Storage
New `ai_summaries` table (migration 027):
```sql
CREATE TABLE ai_summaries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level       TEXT NOT NULL,          -- 'chapter' | 'book' | 'cross_manuscript' | 'grand'
  scope_type  TEXT NOT NULL,          -- 'chapter' | 'book' | 'cross_manuscript' | 'grand'
  scope_key   TEXT NOT NULL,          -- e.g. 'Genesis:1' | 'Genesis' | 'Genesis:1:cross' | 'all'
  content     TEXT NOT NULL,
  model       TEXT NOT NULL,
  token_count INT,
  cost_usd    NUMERIC(10,6),
  generated_at TIMESTAMPTZ DEFAULT now(),
  version     INT DEFAULT 1,
  UNIQUE (scope_type, scope_key)      -- one active summary per scope; append-only via new version
);
```

### API endpoints

| Endpoint | Model | Scope | Cached |
|----------|-------|-------|--------|
| `POST /api/summaries/chapter` | Haiku | book + chapter | `ai_summaries` |
| `POST /api/summaries/book` | Sonnet | book | `ai_summaries` |
| `POST /api/summaries/cross-manuscript` | Sonnet | book + chapter | `ai_summaries` |
| `POST /api/summaries/grand` | Opus | all | `ai_summaries` — admin only |

#### Chapter summary prompt outline
Input: all passage summaries + all translations + their confidence scores for a given book/chapter, across all manuscripts.
Output: thematic overview, key translation tensions, notable variants, significance.

#### Grand assessment prompt outline
Input: all book summaries, cross-manuscript synthesis summaries, variant detection results, confidence distributions, key decisions across all translations.
Output: overarching assessment of the corpus — textual tradition, scholarly confidence, notable divergences between manuscript families, thematic threads, open questions.

### UI integration

- **Read view** (`/read/[book]/[chapter]`): Show chapter summary as a collapsible card below the chapter heading. Load on demand (click to expand + generate if missing). Do NOT auto-load on every page visit — too expensive.
- **Insights page** (`/insights`): Dedicated page showing:
  - Book-level summary cards (browseable)
  - Grand assessment (full text, last-generated date, model badge)
  - "Regenerate" button (admin only)
  - Cost display per generation
- Public access to `/insights` — but "Regenerate" is admin-only.

---

## 4. Contributor / Credit System (Deferred)

**Do nothing** for donations or basic contribution features. Only worth building if we can go straight to the full credit system:

### Credit system (Phase 2 — future)
- Users deposit credits via Stripe (dollars → credit balance)
- Each AI task deducts credits proportional to actual token cost (`agent_tasks.estimated_cost_usd` already tracked)
- Admin users get a monthly credit allocation
- Schema additions: `user_credits (user_id, balance_usd, last_topped_up_at)`, `credit_transactions (user_id, amount, type, task_id, created_at)`
- Gate AI task endpoints: check `user_credits.balance_usd >= estimated_cost` before executing
- Non-admins currently have no access to AI tasks, so this is additive

### Legal framing (when built)
- Credits pay for AI computational costs, not for access to content
- All non-commercial source texts remain free
- Donations/credits cannot be used to gate scholarly content
- Add per-corpus attribution + license notice page (`/about/sources`)

---

## 5. Execution Sequence

```
Sprint 4.1 — Translation Reliability
  Fix 2: Model update                         (30 min)
  Fix 1: Tool use structured output           (2-3 hrs)
  Fix 3: Exponential backoff + retry scope    (2 hrs)
  Fix 4: Streaming                            (4-6 hrs)
  Fix 5: Resumable batch                      (1 hr)
  Fix 6: DB atomicity RPC                     (1 hr)

Sprint 4.2 — Comparison
  Enhancement 1: Translation diff + confidence in compare view  (1-2 days)

Sprint 4.3 — Summary Pyramid (bottom-up)
  Migration 027: ai_summaries table            (1 hr)
  /api/summaries/chapter endpoint             (1 day)
  Chapter summary card in read view           (0.5 day)
  /api/summaries/book endpoint                (1 day)
  /api/summaries/cross-manuscript endpoint    (1 day)
  /api/summaries/grand endpoint               (1 day)
  /insights page                              (1-2 days)

Sprint 4.4 — Doc updates + DEVELOPMENT_LOG
  docs/ROADMAP.md
  docs/DEVELOPMENT_LOG.md
  MEMORY.md
```

---

## Key Files

| File | Sprint | Change |
|------|--------|--------|
| `app/src/app/api/translate/route.ts` | 4.1 | Tool use, streaming, retry, model update |
| `app/src/lib/utils/translation-prompts.ts` | 4.1 | Remove JSON instruction from prompt |
| `app/src/app/(main)/admin/batch-translate-panel.tsx` | 4.1 | Resume button |
| `scripts/migrations/027_add_ai_summaries_table.sql` | 4.3 | New summaries table |
| `app/src/app/api/summaries/chapter/route.ts` | 4.3 | New |
| `app/src/app/api/summaries/book/route.ts` | 4.3 | New |
| `app/src/app/api/summaries/cross-manuscript/route.ts` | 4.3 | New |
| `app/src/app/api/summaries/grand/route.ts` | 4.3 | New |
| `app/src/app/(main)/insights/page.tsx` | 4.3 | New |
| `app/src/app/(main)/read/[book]/[chapter]/compare/compare-selector.tsx` | 4.2 | Translation diff + confidence |
| `docs/ROADMAP.md` | 4.4 | Phase 4 |
| `docs/DEVELOPMENT_LOG.md` | 4.4 | Entry |

---

## Verification

1. **Tool use (4.1):** Trigger a single translation → no parse errors in Vercel logs → response includes `translated_text`, `confidence_score`, `translation_notes`, `key_decisions`.
2. **Streaming (4.1):** Translate a 1500-char passage → completes without 502 timeout → Vercel function log shows streaming duration.
3. **Retry (4.1):** Temporarily set `ANTHROPIC_API_KEY` to an invalid key → observe retry with backoff in logs before final failure.
4. **Resume (4.1):** Start 20-passage batch, close tab at 10, reopen → scan shows 10 remaining → resume completes remaining 10.
5. **Compare diff (4.2):** Navigate to `/read/Genesis/1/compare` with 2 manuscripts → toggle to Translation → word diff renders with highlighted differences.
6. **Chapter summary (4.3):** Click "Generate chapter summary" on a chapter with passage summaries → Haiku-generated summary appears and is cached → second click returns cached result.
7. **Grand assessment (4.3):** Admin → `/insights` → click Regenerate → Opus generates assessment → displays with model badge and generation date.
8. **Build:** `cd app && npm run build` — no type errors.
