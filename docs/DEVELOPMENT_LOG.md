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

### 2026-03-10 — Phase 3.3: AI Research Summaries

**Type:** milestone
**Author:** Development Agent
**Status:** accepted

**Context:**
With Phase 3.2 complete, the platform had robust variant detection and exploration. However, readers and researchers lacked contextual summaries — what does a passage mean, why does a manuscript matter, and why is a confidence score what it is. Phase 3.3 adds AI-generated summaries and data-driven explanations.

**Key Deliverables:**

1. **Passage Summary API (`/api/summaries/passage`):**
   - POST endpoint generating plain-language passage summaries via Claude Haiku
   - Returns summary, historical context, significance, and key themes
   - Caches results in `passages.metadata.ai_summary` JSONB field
   - Authenticated-only for generation (costs money); cached summaries served publicly
   - Includes model, cost, and generation timestamp in cached data

2. **Manuscript Summary API (`/api/summaries/manuscript`):**
   - POST endpoint generating scholarly significance summaries
   - Aggregates passage count, translation count, and variant reading count
   - Returns summary, significance factors, historical period, and related traditions
   - Caches in `manuscripts.metadata.ai_summary`

3. **ConfidenceExplanation Component:**
   - Expandable "Why this confidence score?" panel on translation workspace
   - Derives factors from existing data: translation method, AI model, source count, version number, review count
   - Color-coded impact indicators (positive/neutral/negative)
   - Improvement tips suggest concrete actions to raise confidence

4. **Passage Summary UI (Chapter Reading View):**
   - "About This Passage" expandable section per manuscript article
   - Shows cached AI summary with context, significance, and theme tags
   - Authenticated users see "Generate AI summary" button if none exists
   - AI Summary badge per UX guidelines

5. **Manuscript Significance UI (Manuscript Detail):**
   - "Scholarly Significance" section in overview tab
   - Displays cached summary, significance factors as bullet list, period and traditions
   - "Generate Significance Summary" button for authenticated users

**Files Changed:**
- `app/src/app/api/summaries/passage/route.ts` (created)
- `app/src/app/api/summaries/manuscript/route.ts` (created)
- `app/src/components/ui/confidence-explanation.tsx` (created)
- `app/src/components/ui/manuscript-summary.tsx` (created)
- `app/src/components/scripture/passage-summary.tsx` (created)
- `app/src/app/(main)/manuscripts/[id]/manuscript-detail.tsx` (ManuscriptSummary integration)
- `app/src/app/(main)/manuscripts/[id]/passages/[passageId]/translate/translation-workspace.tsx` (ConfidenceExplanation integration)
- `app/src/app/(main)/read/[book]/[chapter]/page.tsx` (PassageSummary integration)

**Rationale:**
Summaries make the platform accessible to non-specialists. Confidence explanations build trust in AI translations. Caching prevents repeated AI costs. Using existing metadata fields (JSONB) avoids new migrations.

**Consequences:**
- No new database migration needed — uses existing JSONB metadata fields
- AI costs are incurred only when an authenticated user explicitly clicks "Generate"
- Cached summaries are served to all users including unauthenticated readers
- Haiku model keeps per-summary cost under $0.01

**Related Documents:**
- [ROADMAP.md](./ROADMAP.md) — Phase 3.3 items marked complete

---

### 2026-03-10 — Phase 3.2: Variant System Enhancement

**Type:** milestone
**Author:** Development Agent
**Status:** accepted

**Context:**
Phase 3.1 delivered the public exploration surface. The variant detection system from Phase 2 was functional but lacked run tracking, re-detection guards, and browsable exploration. Variants were listed in a flat, unsorted table with no way to filter, search, or group by book. The passage and variant systems were disconnected — readers couldn't navigate between them.

**Key Deliverables:**

1. **Variant Detection Runs (Migration 024):**
   - New `variant_detection_runs` table tracks each detection execution with passage IDs, model, and variant count
   - `detection_run_id` column added to `variants` table for linking
   - Indexes on `passage_reference` and `detection_run_id` for efficient lookups
   - RLS policies: public read, admin insert

2. **Detect-Variants API Versioning:**
   - POST cache check: queries previous runs with matching passage IDs, returns cached results with `cached: true` flag
   - `force` parameter bypasses cache for explicit re-detection
   - PUT handler creates a `variant_detection_runs` row and links new variants via `detection_run_id`
   - Response includes `detection_run_id` for client tracking

3. **Variant Exploration UI:**
   - Variants listing page rewritten with book-grouped layout using shared `BOOK_ORDER`
   - Client-side filtering: significance filter (all/major/minor/orthographic), search by reference or description
   - Variant cards show passage reference, description, reading count, significance badge, creation date
   - Counts displayed per filter category

4. **Attestation Display:**
   - New `AttestationSection` component below diff view on variant detail page
   - Groups readings by normalized text, identifies majority vs minority
   - Shows manuscript dates alongside each attestation for chronological context
   - Majority reading highlighted with primary color

5. **Bidirectional Linking:**
   - **Translate page → Variants:** Server-side query for variants matching passage reference, displayed as linked list with significance badges
   - **Variant detail → Passages:** Source passages section with links to translation workspace per manuscript
   - **Chapter reading view → Variants:** Variant indicator badges showing count and major variant count per passage
   - Scholarly analysis panel on variant detail showing `metadata.analysis` field

**Files Changed:**
- `scripts/migrations/024_create_variant_detection_runs.sql` (created)
- `app/src/app/api/agent/detect-variants/route.ts` (cache check, run tracking, force param)
- `app/src/app/(main)/variants/page.tsx` (rewritten with book grouping)
- `app/src/app/(main)/variants/variant-filters.tsx` (created — client-side filter component)
- `app/src/app/(main)/variants/[id]/page.tsx` (source passages, significance badge, analysis panel)
- `app/src/app/(main)/variants/[id]/variant-comparison-view.tsx` (attestation section)
- `app/src/app/(main)/manuscripts/[id]/passages/[passageId]/translate/page.tsx` (related variants section)
- `app/src/app/(main)/read/[book]/[chapter]/page.tsx` (variant indicator badges)

**Rationale:**
Scholars need to see which manuscripts agree on readings, navigate between variant evidence and source passages, and browse variants systematically by book and significance. Run tracking prevents duplicate detections and enables re-detection workflows.

**Consequences:**
- Variant detection results are now cacheable and browsable by run
- The variant system is bidirectionally linked to passages and the reading view
- Migration 024 must be run in Supabase before variant versioning features work in production
- Attestation display groups readings by text, making majority/minority analysis visible at a glance

**Related Documents:**
- [ROADMAP.md](./ROADMAP.md) — Phase 3.2 items marked complete
- [DATA_MODEL.md](./DATA_MODEL.md) — `variant_detection_runs` table documented

---

### 2026-03-10 — Phase 3.1: Public Exploration Surface

**Type:** milestone
**Author:** Development Agent
**Status:** accepted

**Context:**
Phase 2 completed all content pipelines. The platform had manuscript-centric navigation only — readers had to find a manuscript first, then browse its passages. There was no way to navigate by scripture reference across manuscripts, no dynamic landing page, and no comparison view. Phase 3.1 addresses this as the highest-priority Phase 3 deliverable.

**Key Deliverables:**

1. **Scripture Browser (`/read`):**
   - New index page showing all available books grouped by testament (OT, NT, Deuterocanonical, Other)
   - Each book displays a chapter grid with clickable links and manuscript count badges
   - Data sourced from all passages with non-empty `original_text`, aggregated by reference

2. **Chapter Reading View (`/read/[book]/[chapter]`):**
   - Clean serif reading layout per UX_GUIDELINES Section 6.1
   - Shows each manuscript's highest-confidence published translation as primary content
   - Transparency indicators: ConfidenceBadge, MethodBadge, version number
   - Collapsible original text with RTL support for Hebrew/Arabic/Syriac
   - "View full evidence chain" links to existing translation workspace
   - Prev/Next chapter navigation, chapter dropdown selector
   - Share button (native share API on mobile, clipboard copy on desktop)

3. **Manuscript Comparison View (`/read/[book]/[chapter]/compare`):**
   - Side-by-side panels on desktop, tabbed view on mobile
   - Manuscript selectors on each panel (dropdown with date labels)
   - Toggle between translation view and original text view
   - Links to full evidence chain per manuscript

4. **Dynamic Landing Page:**
   - Live platform statistics bar (manuscripts, passages, translations, languages)
   - Featured Manuscripts section (3 most recent, with descriptions)
   - Recent Translations section (5 latest published translations with snippets)
   - Curated Discovery Paths (Earliest NT Manuscripts, Dead Sea Scrolls, Septuagint)
   - Updated CTAs: "Browse Scripture" → `/read`, "Explore Manuscripts" → `/manuscripts`

5. **Public API Endpoints:**
   - `/api/scripture/books` — Aggregates passages by book/chapter with manuscript counts (5-min ISR cache)
   - `/api/scripture/[book]/[chapter]` — Passages + best published translations for a chapter
   - `/api/stats` — Platform statistics (1-hour ISR cache)

6. **Deep-Link Sharing:**
   - OG metadata (title, description, siteName) on chapter reading view and translate page
   - Twitter card metadata
   - ShareButton component with native Web Share API fallback to clipboard

7. **Shared Utilities:**
   - Extracted `BOOK_ORDER`, `BOOK_DISPLAY_NAMES`, `parseReference`, `getBookDisplayName`, `getTestamentSection` into `lib/utils/book-order.ts`
   - Manuscript detail page refactored to import from shared utility

8. **Navigation Updates:**
   - "Read" link added to desktop header and mobile slide-over navigation
   - PassageNavigator component: desktop dual-dropdown, mobile bottom sheet with chapter grid

**Rationale:**
The platform had rich content pipelines but no reader-friendly way to explore the data. This milestone transforms CodexAtlas from a research tool into a browsable product. Scripture-based navigation is the most natural entry point for readers interested in biblical manuscripts.

**Consequences:**
- Readers can now browse by book/chapter without knowing which manuscripts exist
- Every chapter view is a shareable deep link with OG metadata for social previews
- Comparison view enables visual manuscript comparison without using the variant detection system
- Landing page now shows live content, making the platform feel active and populated
- ISR caching on scripture and stats APIs ensures fast loads without stale data
- All new pages are public — no authentication required for reading

**Related Documents:**
- app/src/app/(main)/read/page.tsx (scripture browser index)
- app/src/app/(main)/read/[book]/[chapter]/page.tsx (chapter reading view)
- app/src/app/(main)/read/[book]/[chapter]/compare/ (comparison view)
- app/src/app/api/scripture/ (books and chapter endpoints)
- app/src/app/api/stats/route.ts (platform statistics)
- app/src/lib/utils/book-order.ts (shared book ordering utility)
- app/src/components/scripture/passage-navigator.tsx
- app/src/components/ui/share-button.tsx
- app/src/app/page.tsx (dynamic landing page)

---

### 2026-03-10 — Pipeline Hardening for Diverse Manuscripts + Variant Detection Optimization

**Type:** milestone
**Author:** Development Agent
**Status:** accepted

**Context:**
Testing revealed two issues: (1) Fragmentary manuscripts like Papyrus 52 (P52) failed to import because the TOC generated bare book references ("John") without chapter numbers, causing every source lookup to silently fail. (2) Variant detection timed out consistently because it used Sonnet (slow) with a 50s timeout for large passage comparisons.

**Key Deliverables:**

1. **TOC hardening for fragmentary manuscripts:**
   - Added `chapter_start` to the TOC prompt so Claude reports which chapter a fragment starts at (P52 → `chapter_start: 18`)
   - Rewrote `expandBooksToSections` to distinguish single-chapter books (Philemon, Jude) from fragments of multi-chapter books
   - Fragments now always include a chapter number in the reference
   - Switched TOC from Sonnet to Haiku for cost savings

2. **Section-text route hardening:**
   - Added `hasChapter` guards so bare references skip gracefully with clear reasons
   - Added language-aware short-circuiting: bolls.life only for Greek/Hebrew, DSS only for Hebrew, SBLGNT only for Greek NT
   - Lowered `MIN_TEXT_LENGTH` from 500 to 100 for fragmentary manuscripts
   - Expanded script detection to 9 scripts (Greek, Hebrew, Latin, Syriac, Coptic, Ethiopic, Armenian, Georgian, Arabic)
   - Added `BOLLS_LIFE_LANGUAGES` and `LANGUAGE_NAMES` constants
   - Updated AI prompt to include manuscript title and public domain context
   - Added P52 and more papyri to NTVMR mappings with alias variants

3. **Variant detection optimization:**
   - Switched from Sonnet to Haiku (3-5x faster for text comparison)
   - Added retry mechanism (2 attempts, 30s timeout)
   - Reduced `max_tokens` from 8192 to 4000
   - Capped passage text at 6000 chars per passage to bound input tokens
   - Tightened prompt for fewer output tokens
   - Removed unused `_passages` parameter (cleaned ESLint warning)

4. **Comprehensive structured logging:**
   - Request ID correlation across all log lines in section-text route
   - Logging at every decision point: TOC parsing, book expansion, source chain steps, DB operations
   - Logging in all helper functions (fetchFromBibleApi, fetchFromSblgnt, fetchFromSinaiticusProject, fetchFromDss)
   - Variant detection: passage sizes, AI response stats, parse results, final counts

**Rationale:**
The platform needs to handle diverse manuscripts — not just complete Greek codices but fragmentary papyri, non-Greek manuscripts (Ethiopic, Syriac, Latin, Coptic), and manuscripts with unusual structures. Each of these edge cases was causing silent failures. Adding structured logging means future issues can be diagnosed from Vercel logs without back-and-forth debugging sessions.

**Consequences:**
- P52 now correctly generates "John 18" and can be imported
- Non-Greek/Hebrew manuscripts skip inapplicable sources cleanly instead of failing
- Variant detection completes in <15 seconds instead of timing out
- Every import and detection operation is traceable via structured logs
- Future manuscript types (Ethiopian, Syriac, etc.) have a clear path through the pipeline

**Related Documents:**
- app/src/app/api/agent/discover/toc/route.ts (chapter_start, Haiku switch)
- app/src/app/api/agent/discover/section-text/route.ts (hasChapter, language guards, logging)
- app/src/lib/utils/text-sources.ts (expanded scripts, NTVMR mappings, BOLLS_LIFE_LANGUAGES)
- app/src/app/api/agent/detect-variants/route.ts (Haiku, retry, cap, logging)

---

### 2026-03-10 — Text Provenance UI for Reader Transparency

**Type:** decision
**Author:** Development Agent
**Status:** accepted

**Context:**
The source chain data was being stored in passage metadata and shown in the admin import panel, but readers viewing translations had no way to see where the original text came from or why a particular source was used. This violated the platform's transparency principle.

**Decision:**
Created a `TextProvenance` client component displayed on the translation page below the original text. It shows:
- Collapsed state: "Text Source" label with a color-coded tier badge (Manuscript-Specific, Standard Edition, AI Reconstructed)
- Expanded state: primary source label and description, full source chain with each step's result, reason, and duration

**Rationale:**
Constitution Principle 1 (Transparency Over Convenience) requires that readers understand not just what the text says, but where it came from and how it was obtained. This information was already in the database — the UI just needed to surface it.

**Related Documents:**
- app/src/app/(main)/manuscripts/[id]/passages/[passageId]/translate/text-provenance.tsx
- app/src/app/(main)/manuscripts/[id]/passages/[passageId]/translate/translation-workspace.tsx

---

### 2026-03-10 — Transparent Source Chain Reasoning in Import Pipeline

**Type:** decision
**Author:** Development Agent
**Status:** accepted

**Context:**
During testing, importing Psalms 77 for Codex Sinaiticus completed quickly but used the bolls.life LXX standard edition (Step 5) instead of the Codex Sinaiticus Project source (Step 1). The chain was working correctly — the Sinaiticus preprocessing data hasn't been populated yet, and Psalms is an OT book so NTVMR/SBLGNT (NT-only) were correctly skipped — but the user had no visibility into what was tried, why each step passed or failed, or how the final source was selected. This violated the platform's transparency principle.

**Decision:**
Added full source chain reasoning to the import pipeline:

1. **`SourceChainStep` type** in `text-sources.ts`: Tracks step number, source name, whether it was attempted, result (`success`, `skipped`, `no_data`, `wrong_script`, `not_applicable`), human-readable reason, and duration in ms.

2. **Chain tracking in `section-text/route.ts`**: Each of the 6 steps now records a reasoning entry explaining exactly what happened — e.g., "Manuscript 'Codex Sinaiticus' is not an NT book — NTVMR is NT-only" or "No data in manuscript_source_texts table — run scripts/preprocess-sinaiticus.mjs to populate."

3. **API response**: `source_chain` array, `source_used` type, and `source_label` human-readable description returned with every successful import.

4. **Passage metadata**: Chain summary stored in `metadata.source_chain` on each passage for permanent traceability.

5. **Full-import panel UI**: Each imported section shows a color-coded badge (green = manuscript-specific, blue = standard edition, amber = AI). Clicking the badge expands a detailed chain view showing every step, its result, reasoning, and timing.

6. **Server-side logging**: Console output includes compact chain summary for each import: `1:sinaiticus-project=no_data, 2:ntvmr=not_applicable, 3:dss=no_data, 4:sblgnt=not_applicable, 5:bible-api=success`.

**Rationale:**
Transparency is a core principle (Constitution Principle 1). Users need to understand not just *what* source was used, but *why* higher-priority sources were skipped. This also serves as a diagnostic tool: if the Sinaiticus Project source shows "no_data," the user knows they need to run the preprocessing script. The chain data in passage metadata creates a permanent audit trail.

**Consequences:**
- Every import now carries full source provenance
- Users can immediately diagnose why a lower-priority source was used
- Chain data persists in passage metadata for long-term traceability
- Added ~500 bytes per passage in metadata (acceptable trade-off)
- 39 unit tests pass (2 new for SOURCE_LABELS)

**Related Documents:**
- app/src/lib/utils/text-sources.ts (SourceChainStep, SOURCE_LABELS)
- app/src/app/api/agent/discover/section-text/route.ts (chain tracking)
- app/src/app/(main)/admin/full-import-panel.tsx (chain UI)
- app/src/__tests__/text-source-chain.test.ts (SOURCE_LABELS tests)

---

### 2026-03-10 — Test Infrastructure and Development Process Compliance

**Type:** milestone
**Author:** Development Agent
**Status:** accepted

**Context:**
After completing the six-step text source chain and manuscript source integrations, the project had zero test infrastructure and several documentation gaps. The development process (OBSERVE → ANALYZE → PROPOSE → IMPLEMENT → TEST → REVIEW → DEPLOY → MONITOR) required test coverage for the core text pipeline, updated data model documentation reflecting migrations 019-023, security documentation for the new `manuscript_source_texts` table, and elimination of the Python dependency in preprocessing scripts.

**Key Deliverables:**

1. **Test infrastructure established:** Installed Vitest 4.x with `@testing-library/react` and `@testing-library/jest-dom`. Created `vitest.config.ts` with path aliases matching `tsconfig.json`. Added `test`, `test:watch`, and `test:ci` scripts to `package.json`.

2. **37 unit tests for the text source chain:** Extracted pure functions and constants from `section-text/route.ts` into `app/src/lib/utils/text-sources.ts` for testability. Tests cover: `parseBookAndChapter` (simple books, numbered books, case insensitivity, deuterocanonical, alternate names, invalid input), `textHasCorrectScript` (Greek, Hebrew, English, unknown languages), `parseNtvmrHtml` (HTML stripping, table removal, entity decoding, structural markers, line numbers, inscriptio, Korrektor, copyright, whitespace), `parseSblgntChapter` (chapter extraction, wrong chapter/book), `BOOK_NUMBERS` (66-book coverage, LXX entries, alternate names), `NTVMR_MANUSCRIPTS` (uncials, aliases, papyri), `NT_SBL_BOOKS` (27 books, SBL abbreviations), `LENINGRAD_TITLES` (matching, non-matching).

3. **DSS preprocessing rewritten from Python to Node.js:** Eliminated the Python/pip dependency. New `scripts/preprocess-dss.mjs` fetches ETCBC/dss Text-Fabric feature files (`book.tf`, `chapter.tf`, `g_cons.tf`) directly from GitHub, parses the TF format, converts ETCBC transliteration to Hebrew Unicode, and upserts into Supabase. Both preprocessing scripts are now pure Node.js.

4. **Env var fix in preprocessing scripts:** Both scripts now check `SUPABASE_URL` with `NEXT_PUBLIC_SUPABASE_URL` fallback, matching `.env.local` conventions.

5. **DATA_MODEL.md updated:** Added `agent_tasks` (§2.16) and `manuscript_source_texts` (§2.17) table definitions. Updated `passages.transcription_method` to include all seven values. Added migrations 019-023 to the migration list.

6. **SECURITY_MODEL.md updated:** Documented RLS policies for `agent_tasks` (admin/editor full access, authenticated read) and `manuscript_source_texts` (public read, service-role-only write with design rationale).

**Rationale:**
The development process defined in the Project Constitution requires testing and documentation as integral steps, not afterthoughts. Extracting pure functions into a testable utility module improves code quality and catches regressions early. Eliminating the Python dependency simplifies the user experience for running preprocessing scripts.

**Consequences:**
- All 37 tests pass on first run
- Pure text-source functions are now importable by both the API route and tests
- User needs only Node.js (no Python) to run both preprocessing scripts
- DATA_MODEL.md and SECURITY_MODEL.md are current through migration 023
- ROADMAP.md updated with test infrastructure deliverable

**Related Documents:**
- app/src/lib/utils/text-sources.ts (extracted pure functions)
- app/src/__tests__/text-source-chain.test.ts (37 unit tests)
- app/vitest.config.ts (test configuration)
- scripts/preprocess-dss.mjs (rewritten from Python)
- scripts/preprocess-sinaiticus.mjs (env var fix)
- docs/DATA_MODEL.md (§2.16, §2.17, §7 updated)
- docs/SECURITY_MODEL.md (agent_tasks, manuscript_source_texts policies)

---

### 2026-03-10 — Expand Manuscript Text Sources Across All Seven Evaluated Sources

**Type:** decision
**Author:** Development Agent
**Status:** accepted

**Context:**
After integrating NTVMR for NT manuscripts, a comprehensive evaluation revealed that the platform still had no manuscript-specific text for OT books, was using the outdated Textus Receptus as its NT standard edition, and was mislabeling the Westminster Leningrad Codex text as a generic "standard edition" even when importing the Leningrad Codex itself. Seven external text sources were evaluated for integration.

**Decision:**
Implemented a six-step text source chain and evaluated all seven candidate sources:

### Sources integrated (Phases 1-3):

1. **Codex Sinaiticus Project** (Phase 2) — Full OT+NT transcription of Codex Sinaiticus from the itsee-birmingham GitHub repo. TEI XML (51.9 MB), CC BY-NC-SA 3.0. Requires offline preprocessing script to extract chapter-level text into a `manuscript_source_texts` Supabase table. Fetch function queries this table when manuscript is Sinaiticus.

2. **INTF NTVMR** (already integrated) — Manuscript-specific NT transcriptions. CC BY 4.0.

3. **ETCBC Dead Sea Scrolls** (Phase 3) — OT manuscript-specific readings from DSS corpus (MIT license). Requires Python preprocessing via Text-Fabric. Includes Great Isaiah Scroll, various Qumran fragments.

4. **WLC / Leningrad Codex Recognition** (Phase 1) — bolls.life WLC text is now labeled `scholarly_transcription` (not `standard_edition`) when the manuscript title matches "Leningrad Codex" or "Codex Leningradensis". Zero-cost change, correct labeling.

5. **SBLGNT** (Phase 1) — Replaced Textus Receptus with the SBL Greek New Testament (CC BY 4.0) as the NT Greek standard edition. Fetches per-book text files from GitHub at runtime.

### Sources evaluated and deferred:

6. **morphgnt** — Morphological parsing of SBLGNT + Tischendorf 8th. MIT license. Low value for primary text (we already have SBLGNT). Morphological data is a future feature.

7. **Perseus Digital Library / Scaife** — 1,200+ Greek/Latin texts. Not biblical manuscripts. Useful later for patristic citations.

### New fallback chain:

```
Step 1: Codex Sinaiticus Project (if manuscript = Sinaiticus, OT+NT)
Step 2: NTVMR API (if GA number + NT book)
Step 3: Dead Sea Scrolls (if DSS scroll + matched book)
Step 4: SBLGNT (NT Greek standard edition)
Step 5: bolls.life (LXX/TR/WLC, with Leningrad Codex recognition)
Step 6: AI Models (Haiku → Sonnet)
```

**Rationale:**
The platform's mission requires manuscript-specific text for meaningful variant detection. Each source fills a distinct gap: Sinaiticus Project covers OT Greek, NTVMR covers NT manuscripts, DSS covers OT Hebrew alternatives, SBLGNT improves edition quality, and Leningrad recognition correctly labels existing data. Sources were prioritized by impact (manuscript-specific > improved edition > future features) and complexity.

**Consequences:**
- Variant detection between OT manuscripts becomes possible once Sinaiticus and DSS data are preprocessed
- NT standard edition text is now SBLGNT (CC BY 4.0) instead of Textus Receptus
- Leningrad Codex imports are correctly labeled as manuscript-specific
- Phase 2 (Sinaiticus) requires license decision: CC BY-NC-SA 3.0 restricts commercial use
- Phase 2 and 3 require user to run preprocessing scripts and migration 023
- The `manuscript_source_texts` Supabase table serves as a shared data store for all preprocessed sources

**Related Documents:**
- app/src/app/api/agent/discover/section-text/route.ts (full fallback chain, all fetch functions)
- scripts/preprocess-sinaiticus.mjs (Sinaiticus XML preprocessing)
- scripts/preprocess-dss.mjs (Dead Sea Scrolls preprocessing, rewritten from Python to Node.js)
- scripts/migrations/023_create_manuscript_source_texts.sql (shared data table)

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
