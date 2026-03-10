# CodexAtlas Development Log

This log records all significant architectural decisions, technical choices, and project milestones.

Every entry is permanent. Entries are never deleted or modified after recording.

Newest entries appear first.

## Log Entry Format

```
---

### YYYY-MM-DD — [Title]

**Type:** [decision | milestone | incident | amendment | observation]
**Author:** [name or agent identifier]
**Status:** [proposed | accepted | superseded | deprecated]

**Context:**
[What situation prompted this entry]

**Decision:**
[What was decided]

**Rationale:**
[Why this decision was made]

**Consequences:**
[Expected impacts, trade-offs, risks]

**Related Documents:**
[Links to relevant docs, PRs, issues]

---
```

## Entries

---

### 2026-03-10 — Integrate NTVMR API for Manuscript-Specific Transcriptions

**Type:** decision
**Author:** Development Agent
**Status:** accepted

**Context:**
All manuscript imports were using the bolls.life API, which provides standardized critical edition text (LXX, TR, WLC) — the same text regardless of which manuscript is selected. This made variant detection between manuscripts of the same book meaningless, violating Constitution Principle 2 (Evidence Over Authority). The user requested integrating actual manuscript-specific text sources rather than adding more AI models.

**Decision:**
Integrated the INTF New Testament Virtual Manuscript Room (NTVMR) free API as the primary text source for NT manuscripts with known Gregory-Aland (GA) numbers. The text source fallback chain is now:

1. **NTVMR** (manuscript-specific scholarly transcription, NT only) — for known GA manuscripts
2. **bolls.life** (standard edition: LXX/TR/WLC) — for books without NTVMR coverage
3. **AI models** (Haiku → Sonnet) — last resort fallback

Implementation details:
- Added `fetchFromNtvmr()` function with GA docID mapping (Sinaiticus=20001, Vaticanus=20003, Alexandrinus=20002, Bezae=20005, plus papyri and other uncials)
- Added NTVMR SBL book abbreviation mapping for all 27 NT books
- HTML parser strips correction apparatus tables, page/folio/column headers, line numbers, and normalizes whitespace to extract clean original-hand Greek text
- New `scholarly_transcription` transcription method distinguishes NTVMR-sourced text from standard editions and AI
- Green "INTF Transcription (GA 01)" badge in the UI for scholarly transcriptions
- Database migration 022 adds `scholarly_transcription` to the CHECK constraint

**Rationale:**
The NTVMR API is free, CC-BY 4.0 licensed, covers ~5,800 NT manuscripts, and returns genuinely different text readings per manuscript (e.g., Sinaiticus has "δαδ" where Vaticanus has "δαυειδ" for David in Matt 1:1). This makes variant detection meaningful and aligns with the platform's mission of evidence-based manuscript research. The three-tier fallback ensures coverage: NTVMR for NT manuscripts with known GA numbers, bolls.life for OT and uncovered books, and AI as a last resort.

**Consequences:**
- Variant detection between NT manuscripts now compares genuinely different text readings
- Users can distinguish manuscript-specific transcriptions (green badge) from standard editions (blue badge)
- OT portions of manuscripts still use bolls.life standard editions (NTVMR is NT-only)
- Corrector readings are not extracted (original hand only); correctors could be a future feature
- User must run migration 022 against Supabase before deploying

**Related Documents:**
- app/src/app/api/agent/discover/section-text/route.ts (NTVMR fetch, fallback chain)
- app/src/app/(main)/manuscripts/[id]/manuscript-detail.tsx (green badge)
- scripts/migrations/022_add_scholarly_transcription_method.sql

---

### 2026-03-10 — Fix Variant Detection for Identical Texts and Mark Standard Edition Sources

**Type:** decision
**Author:** Development Agent
**Status:** accepted

**Context:**
During testing, comparing Psalms 23 passages from Codex Vaticanus and Codex Sinaiticus produced a misleading result: the variant detection labeled it as a "major" variant, yet the analysis text stated "No textual variants detected." Investigation revealed two problems:

1. Claude sometimes returns a variant entry with `significance: "major"` even when the texts are identical, instead of returning an empty array as instructed.
2. Both manuscripts' Psalms 23 passages were sourced from the same bolls.life LXX API endpoint, making them character-identical. Comparing them is meaningless because the source is the same standardized critical edition text, not manuscript-specific transcriptions. This violates Constitution Principle 2 (Evidence Over Authority) if presented as manuscript evidence.

**Decision:**
Three changes implemented:

1. **Variant detection pre-check**: Before calling Claude, compare all selected passages' text. If character-identical (after whitespace normalization), return immediately with zero cost, a clear explanation message, and a `same_source` flag if all passages came from the Bible API. Post-validation also filters out any AI-returned "variant" where all readings have identical text.

2. **New `standard_edition` transcription method**: Text imported from bolls.life is now tagged as `transcription_method: "standard_edition"` (not `"ai_imported"`), with `edition_source` in metadata (e.g., "LXX", "TR", "WLC"). This makes clear the text is from a standardized critical edition, not a manuscript-specific transcription. Database migration 021 adds this to the CHECK constraint.

3. **UI transparency**: Manuscript detail page shows a distinct blue "Std. Edition (LXX)" badge for standard edition passages instead of the generic gray method badge. Variant detection panel displays a warning when comparing identical/same-source passages, explaining why comparison is not meaningful.

**Rationale:**
The platform's mission is evidence-based manuscript research. Presenting standardized edition text as if it were manuscript-specific reading is misleading. Users need to understand what their data actually represents, and the system should prevent wasteful AI calls when comparison is impossible.

**Consequences:**
- Variant detection no longer wastes AI tokens comparing identical texts
- Users see clear "Std. Edition" labels on API-sourced passages
- Future imports from manuscript-specific sources (OCR, scholarly transcriptions) will be distinguishable from edition text
- Existing passages with `ai_imported` from the Bible API are not retroactively updated; they remain valid under the prior rules

**Related Documents:**
- app/src/app/api/agent/detect-variants/route.ts (pre-check, post-filter)
- app/src/app/(main)/admin/variant-panel.tsx (warning display)
- app/src/app/api/agent/discover/section-text/route.ts (standard_edition method, edition_source metadata)
- app/src/app/(main)/manuscripts/[id]/manuscript-detail.tsx (badge display)
- scripts/migrations/021_add_standard_edition_transcription_method.sql

---

### 2026-03-10 — Expand Book Mappings for Deuterocanonical, Ethiopian, and Apocryphal Texts

**Type:** decision
**Author:** Development Agent
**Status:** accepted

**Context:**
The `BOOK_ORDER` map (used for display sorting on the manuscript detail page) and the `BOOK_NUMBERS` map (used for fetching text from the bolls.life Bible API) only covered the standard 66-book Protestant canon. Manuscripts containing deuterocanonical, Ethiopian canon, or other ancient texts (e.g., 1 Enoch, Tobit, Wisdom of Solomon, Jubilees) would sort incorrectly (falling to position 999) and fail to resolve against the free Bible API.

**Decision:**
Expanded both maps:

1. **`BOOK_ORDER`** in `app/src/app/(main)/manuscripts/[id]/page.tsx` — Added ~40 entries covering:
   - Alternate names for existing books (e.g., "song of songs" → Song of Solomon)
   - Deuterocanonical/apocrypha (67–86): 1 Esdras, Tobit, Judith, Wisdom, Sirach, Baruch, 1–4 Maccabees, Susanna, Bel and the Dragon, Prayer of Azariah, Psalms of Solomon, Odes
   - Ethiopian canon (100+): 1 Enoch, Jubilees, 1–3 Meqabyan, Rest of Words of Baruch, 4 Ezra
   - Other ancient texts (150+): Prayer of Manasseh
   - Common alternate spellings map to the same number

2. **`BOOK_NUMBERS`** in `app/src/app/api/agent/discover/section-text/route.ts` — Added LXX-available books only (67–86). Ethiopian and non-LXX texts excluded since they don't exist in the bolls.life API and would produce failed lookups. Updated translation selection logic: books 40–66 route to Textus Receptus (NT), all others (including apocrypha 67+) route to LXX.

**Rationale:**
The platform serves manuscripts beyond the Protestant canon — Septuagint manuscripts include deuterocanonical books, and Ethiopian manuscripts (e.g., from the Ethiopian Orthodox canon) include 1 Enoch, Jubilees, and Meqabyan. Without these mappings, importing and sorting these texts would fail silently or produce incorrect ordering. The numbering scheme (67+ deuterocanonical, 100+ Ethiopian, 150+ other) keeps the standard canon untouched while providing logical sort order for extended texts.

**Consequences:**
- Passage sorting now handles deuterocanonical and Ethiopian texts correctly
- Bible API lookups work for LXX apocryphal books (routed to LXX translation instead of TR)
- Ethiopian and other non-LXX texts will still fall through to the AI model escalation path (by design)
- New alternate name entries reduce the chance of unrecognized book names defaulting to sort position 999

**Related Documents:**
- app/src/app/(main)/manuscripts/[id]/page.tsx (BOOK_ORDER)
- app/src/app/api/agent/discover/section-text/route.ts (BOOK_NUMBERS, fetchFromBibleApi translation logic)

---

### 2026-03-10 — Full Manuscript Import Pipeline and Timeout Hardening

**Type:** milestone
**Author:** Founding Architect
**Status:** accepted

**Context:**
After Phase 2 completion, testing the manuscript discovery and import workflow revealed several issues: the initial discovery flow tried to import sample passages inline (too granular, single verses), there was no way to import a manuscript's full content, and AI API calls were timing out on Vercel's 60s serverless limit.

**Key Deliverables:**

Full Manuscript Import:
- Two-stage import: Claude provides the book list, chapters are expanded programmatically from a lookup table
- Section-by-section text retrieval using Claude Haiku 4.5 (fast recall model)
- Already-imported detection on re-scan (sections show "Imported" badge)
- Select-all/none, progress tracking, cancel, and "Retry Failed" for failed sections
- Passage inline editing and deletion from the manuscript detail page

Timeout Hardening:
- 50s AbortController added to all 6 AI-calling endpoints
- Graceful JSON error responses instead of raw HTML 504 pages
- Client-side error handling for timeouts and non-JSON responses
- Retry buttons on both full import and batch translation panels

Model Strategy:
- Claude Haiku 4.5 for text import (fast recall task, ~3-8s per chapter)
- Claude Sonnet 4 for translation, analysis, and reasoning tasks
- Discovered Claude 3.5 Haiku was retired Feb 19, 2026; swapped to Haiku 4.5

Database:
- Migration 020: Added `ai_reconstructed` and `ai_imported` to passages `transcription_method` CHECK constraint
- Fixed cascade deletion for passages with translations (foreign key chain)

**Architecture Decisions:**

1. **Separate discovery from import:** Discovery adds the manuscript record to the library. Full Import is a second step that scans the TOC and imports section text. This separates "what exists" from "get the content."

2. **Programmatic chapter expansion:** Instead of asking Claude to enumerate every chapter (slow, token-heavy), Claude provides just the book list. Chapters are expanded from a hardcoded biblical chapter count table. Faster, cheaper, and deterministic.

3. **Right model for the job:** Text reproduction is a recall task — Haiku 4.5 is 4-5x faster than Sonnet 4 at 1/3 the cost. Reasoning tasks (translation, variant detection) stay on Sonnet.

4. **Detailed error surfacing:** All AI endpoints now return the actual error message to the client, not generic "Internal server error." Enables debugging without server log access.

**Consequences:**
- Full manuscript import pipeline operational
- Codex Vaticanus successfully importing sections
- All AI endpoints hardened against timeouts
- Model pricing table updated for current Anthropic models
- Platform ready for systematic content population

**Related Documents:**
- docs/ROADMAP.md (Phase 2.3b added)
- scripts/migrations/020_add_ai_transcription_methods.sql
- app/src/app/api/agent/discover/section-text/route.ts
- app/src/app/api/agent/discover/toc/route.ts
- app/src/app/(main)/admin/full-import-panel.tsx

---

### 2026-03-10 — Phase 2 Complete: Research Tools + Agent Engine

**Type:** milestone
**Author:** Founding Architect
**Status:** accepted

**Context:**
Phase 2 implemented the complete AI agent framework and research tools across 4 development blocks, adding approximately 5,000 lines of new code in a single development session.

**Key Deliverables:**

Block 1 — Agent Task System + Batch Translation:
- `agent_tasks` table (migration 019) with cost tracking, progress, RLS
- Agent task CRUD API with admin-gated access
- AI cost estimation utility with per-model pricing
- Updated translate API to capture and return token usage from Anthropic
- Client-orchestrated batch translation with pause/resume/cancel and live progress

Block 2 — Manuscript Discovery Agent:
- Claude-powered discovery API (research query → structured manuscript suggestions)
- Manuscript ingest API with duplicate detection
- Discovery panel UI with example queries, result cards, one-click approval
- "Add All New" batch approval for discovered manuscripts

Block 3 — OCR Pipeline + Variant Detection:
- OCR API using Claude Vision (base64 upload or Supabase Storage)
- Passage extraction with confidence scoring and language detection
- Review-then-save workflow for OCR results
- Variant detection API comparing passages across manuscripts
- AI classification of variants (major, minor, orthographic)
- Save variants and readings to database

Block 4 — Search, Evidence Explorer, Scholarly Export:
- Advanced search API with full-text search (GIN tsvector) and type filters
- Public search page at `/search`
- Evidence explorer API and page with visual provenance chain
- Scholarly export API supporting JSON, CSV, and TEI XML (TEI P5 standard)
- Export dropdown on manuscript detail page

**Architecture Decisions:**

1. **Client-orchestrated batch processing:** Rather than long-running server jobs (which hit Vercel timeout limits), batch operations are orchestrated client-side. The browser calls individual API endpoints in sequence with configurable delays. This works within serverless constraints and provides natural pause/resume/cancel capability.

2. **Discovery via Claude research prompts:** Instead of web scraping digital archives (which requires bespoke scrapers per source), the discovery agent uses Claude's knowledge to suggest historically documented manuscripts. This is faster to build, produces scholarly-quality metadata, and naturally includes confidence notes.

3. **OCR review-then-save flow:** OCR results are returned to the admin for review before being saved as passages. This prevents bad transcriptions from entering the database and maintains the human-in-the-loop principle from the Project Constitution.

4. **Public search and export:** Search and export APIs require no authentication, consistent with the Open Research Model. All research data is freely accessible.

**Consequences:**
- All Phase 2 roadmap items complete
- Platform now has full content pipeline: discover → ingest → OCR → translate → detect variants
- Research tools operational: search, evidence explorer, scholarly export
- Admin dashboard provides cost monitoring and task management
- Ready for content population — use discovery + batch translate to build the corpus
- Phase 3 (Polish + Scale) is available when needed

**Related Documents:**
- docs/ROADMAP.md (Phase 2 checkboxes complete)
- scripts/migrations/019_create_agent_tasks.sql
- 4 API route groups: /api/agent/*, /api/search, /api/evidence/*, /api/export/*

---

### 2026-03-09 — Strategic Pivot: Builder-First, Agent-Driven

**Type:** decision
**Author:** Founding Architect
**Status:** accepted

**Context:**
After completing the Phase 1 MVP and testing the full pipeline (manuscript creation, AI translation, reviews, variant comparison), a strategic reassessment was made. The original 5-phase roadmap was designed for institutional adoption and public scale. The actual goal is different: build a powerful research engine, fill it with content via AI agents, use it personally, share it with people nearby, and grow organically if the platform proves genuinely useful.

**Decision:**
Collapsed the original 5-phase roadmap into 3 phases:

1. **Phase 1 (Complete):** MVP — core pipeline works end-to-end
2. **Phase 2 (Next):** Research Tools + Agent Engine — AI agents populate the platform, research tools make the content useful
3. **Phase 3 (When Ready):** Polish + Scale — public exploration, accessibility, API, institutional features

Key changes:
- AI agent framework pulled forward from Phase 4 to Phase 2 (next priority)
- Batch translation, OCR, manuscript discovery, and automated variant detection are now immediate priorities
- Public exploration polish, institutional partnerships, i18n, and community governance deferred to Phase 3
- Traffic optimization and CI/CD sophistication deprioritized
- Cost tracking elevated to Phase 2 essential (agents burn tokens autonomously)

**Rationale:**
A platform full of well-translated, well-evidenced manuscripts is inherently valuable regardless of user count. Content depth drives value more than user breadth. The architecture already supports scale — it doesn't need to be built for thousands of concurrent users to be useful to one serious user. Manual manuscript entry is a bottleneck that agents can eliminate. Building what you use and sharing what works is a more honest growth strategy than building for imagined institutional adoption.

**Consequences:**
- Phase 2 is substantially larger and more ambitious than originally planned
- API cost management becomes critical immediately (agents running autonomously)
- Some research tools (lineage visualization, review clustering) may be deferred within Phase 2 to prioritize the content engine
- The PRODUCT_STRATEGY.md and ROADMAP.md were rewritten to reflect this direction

**Related Documents:**
- docs/ROADMAP.md (rewritten)
- docs/PRODUCT_STRATEGY.md (rewritten)
- summaries/ARCHITECTURE_SUMMARY.md (updated)

---

### 2026-03-09 — Phase 1 MVP Complete

**Type:** milestone
**Author:** Founding Architect
**Status:** accepted

**Context:**
Phase 1 implementation completed all core features: manuscript ingestion, AI translation with evidence records, variant comparison, human review, and the transparency layer. Several architectural decisions were made during implementation to align the code with the project's Open Research Model philosophy.

**Key Deliverables:**
- 18 database migration files implementing the full DATA_MODEL.md schema
- Next.js application with App Router, TypeScript, Tailwind CSS
- Supabase integration (Auth, Postgres with RLS, Storage)
- Claude AI translation pipeline with structured evidence output
- PWA icons and manifest
- Public read access for all research data

**Key Decisions Made During Implementation:**

1. **Supabase type workaround:** The full 15-table `Database` generic type exceeded TypeScript's inference depth limits with `@supabase/ssr`. Workaround: cast clients as `SupabaseClient<Database>` and annotate query return types explicitly at the call site. Type safety is maintained where it matters (data consumption) without relying on deep generic inference.

2. **Translations default to "published":** The original schema had translations starting as "draft" requiring editorial promotion. This was changed to default to "published" because it conflicted with the Open Research Model — transparency indicators (confidence score, method badge, evidence chain, reviews) are the legitimacy signals, not an editorial status gate. Remaining statuses: "superseded" (replaced by newer version), "disputed" (flagged by reviewers).

3. **Public read access via RLS:** Original RLS policies required authentication for all SELECT operations. Added `*_public_select` policies to all research-facing tables so anonymous visitors can browse manuscripts, translations, evidence, and reviews. Write operations remain auth-gated.

4. **Audit log trigger fix:** The `write_audit_log()` trigger function referenced `NEW.archived_at` which doesn't exist on all tables. Fixed by checking `to_jsonb(NEW) ? 'archived_at'` before accessing the field.

**Consequences:**
- MVP is functional and testable end-to-end
- Ready for Vercel deployment
- Phase 2 (Research Platform) can begin
- Manual manuscript entry is the current workflow; agent-driven ingestion comes in Phase 4

**Related Documents:**
- docs/ROADMAP.md (Phase 1 checkboxes updated)
- scripts/migrations/ (018 files)

---

### 2026-03-09 — Technology Stack Selection

**Type:** decision
**Author:** Founding Architect
**Status:** accepted

**Context:**
The platform requires a technology stack that supports: PWA capabilities, server-side rendering for SEO, a scalable relational database with row-level security, file storage, push notifications, and AI model integration. The stack must be cost-efficient, open-source-friendly, and maintainable by a small team augmented by AI agents.

**Decision:**

| Component | Technology | Justification |
|-----------|-----------|---------------|
| Frontend | Next.js (App Router) | SSR/SSG for SEO, React ecosystem, PWA support, API routes |
| Hosting | Vercel | Optimized for Next.js, edge network, automatic deployments |
| Database | Supabase (Postgres) | Open-source, RLS, real-time subscriptions, auth, generous free tier |
| Storage | Supabase Storage | Integrated with auth/RLS, CDN-backed |
| Notifications | Firebase Cloud Messaging | Mature push notification infrastructure, cross-platform |
| AI Models | Claude (Anthropic) | Strong reasoning for textual analysis, structured output |
| Repository | GitHub | Industry standard, open source support, CI/CD integration |
| Development | Cursor + Claude Code | AI-assisted development aligned with agent architecture |

**Rationale:**
Each choice was evaluated against the project's core principles:
- Supabase over custom backend: reduces operational complexity while providing Postgres power
- Next.js over SPA frameworks: SEO critical for public discovery, API routes eliminate separate backend
- Firebase only for notifications: avoid vendor lock-in for core features, use Firebase only where its strength is clear
- Claude over alternatives: best-in-class reasoning for scholarly text analysis

**Consequences:**
- Tied to Vercel for optimal Next.js hosting (but deployable elsewhere)
- Supabase free tier sufficient for MVP; paid tier needed at scale
- Firebase dependency limited to notifications (replaceable)
- Claude API costs must be monitored and controlled

**Related Documents:**
- docs/MASTER_PLAN.md (Section 4: Tech Stack Justification)
- docs/SECURITY_MODEL.md (Section 8: Secrets Management)

---

### 2026-03-09 — Project Foundation and Architecture Established

**Type:** milestone
**Author:** Founding Architect
**Status:** accepted

**Context:**
CodexAtlas was initiated as an open-source AI-assisted research platform for ancient religious manuscripts. The project needed a strong architectural foundation before any application code was written. The founding principle was that architecture quality and documentation must precede implementation.

**Decision:**
Established the complete documentation framework including:
- PROJECT_CONSTITUTION.md — governing rules and principles
- MASTER_PLAN.md — system architecture and technical design
- PRODUCT_STRATEGY.md — product vision and user strategy
- ROADMAP.md — phased development plan
- DATA_MODEL.md — database schema and entity design
- SECURITY_MODEL.md — security architecture
- UX_GUIDELINES.md — design system and UX patterns
- DEVELOPMENT_LOG.md — this decision log

Selected technology stack: Next.js PWA on Vercel, Supabase (Postgres), Firebase (notifications), Claude AI models.

Adopted core principles: transparency over convenience, evidence over authority, version history over overwriting, human review over hidden automation, modularity over speed.

**Rationale:**
Building a platform intended to serve scholars and the public for years requires a foundation that prioritizes long-term maintainability, transparency, and evidence traceability. Writing documentation first forces architectural clarity before code commits create inertia. The selected tech stack balances open-source values, cost efficiency, developer experience, and scalability.

**Consequences:**
- All future development must comply with the Project Constitution
- AI agents must operate within defined behavioral boundaries
- The append-only data model means storage grows monotonically (planned for via partitioning strategy)
- Open source governance means slower but more transparent decision-making
- Documentation-first approach delays initial code but reduces long-term technical debt

**Related Documents:**
- docs/PROJECT_CONSTITUTION.md
- docs/MASTER_PLAN.md
- docs/PRODUCT_STRATEGY.md
- docs/ROADMAP.md
- docs/DATA_MODEL.md
- docs/SECURITY_MODEL.md
- docs/UX_GUIDELINES.md

---

## Entry Guidelines

1. Every significant decision must be logged
2. Entries are permanent — never edit or delete past entries
3. If a decision is reversed, create a new entry explaining the reversal and reference the original
4. Use the "superseded" status to mark outdated decisions (in a new entry, not by editing the old one)
5. Include enough context that someone reading the log in 2 years understands the reasoning
6. Reference related documents, PRs, and issues
7. Both humans and AI agents should log decisions

## Entry Types

| Type | When to Use |
|------|------------|
| decision | A technical or architectural choice was made |
| milestone | A significant project milestone was reached |
| incident | A security incident, outage, or significant bug occurred |
| amendment | A change to the Project Constitution or governance |
| observation | A notable pattern, risk, or opportunity identified |
