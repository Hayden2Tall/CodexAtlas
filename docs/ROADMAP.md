# CodexAtlas — Development Roadmap

> **Last Updated:** 2026-03-10
> **Status:** Phase 2 complete · Phases 3.1–3.4 complete · Entering Phase 3.5
> **Companion Documents:** [PROJECT_CONSTITUTION.md](./PROJECT_CONSTITUTION.md) · [MASTER_PLAN.md](./MASTER_PLAN.md) · [DATA_MODEL.md](./DATA_MODEL.md) · [SECURITY_MODEL.md](./SECURITY_MODEL.md)

---

## 1. Roadmap Overview

This roadmap defines the development plan for CodexAtlas — an open-source, AI-assisted research platform for ancient religious manuscripts.

The plan is structured around a **builder-first philosophy**: build the content engine and research tools, fill the platform with manuscripts via AI agents, use it personally, share it with people around you, and grow from there. Institutional adoption, public-facing polish, and traffic scaling are real goals but they follow naturally from having a platform full of valuable content — not the other way around.

**Core Priorities:**

1. **Content depth over user breadth.** A platform with 10,000 manuscripts and one user is more valuable than a polished app with zero content.
2. **Agent-driven ingestion over manual entry.** Humans validate; AI does the heavy lifting of discovery, transcription, and translation.
3. **Research utility over public polish.** Build tools that make manuscript research genuinely useful before worrying about onboarding flows and marketing.
4. **Architecture for scale, build for one.** Keep the architecture sound so it can scale later, but don't over-engineer for traffic or contributors that don't exist yet.

---

## 2. Phase 0 — Foundation (Complete)

**Goal:** Establish the architectural and documentation foundation.

### Deliverables

- [x] Repository structure created
- [x] PROJECT_CONSTITUTION.md
- [x] MASTER_PLAN.md
- [x] PRODUCT_STRATEGY.md
- [x] ROADMAP.md
- [x] DATA_MODEL.md
- [x] SECURITY_MODEL.md
- [x] UX_GUIDELINES.md
- [x] DEVELOPMENT_LOG.md
- [x] Architecture summaries for agent context
- [x] Git repository initialized with README, .gitignore, LICENSE

---

## 3. Phase 1 — Minimal Viable Prototype (Complete)

**Goal:** Build the core research pipeline end-to-end with full transparency.

### Deliverables

- [x] Next.js application (App Router, TypeScript, Tailwind CSS)
- [x] Supabase integration (Postgres, Auth, Storage)
- [x] 18 database migration files implementing full schema
- [x] Row-Level Security with public read access
- [x] PWA configuration with icons and manifest
- [x] Manuscript ingestion (create, browse, detail view)
- [x] Passage creation with original-language text
- [x] AI translation via Claude with evidence records
- [x] Translation version history with provenance
- [x] Human review system (star rating, structured feedback, critique)
- [x] Variant comparison with word-level diff
- [x] Transparency indicators (confidence, method, model, source)
- [x] Evidence panel ("How do we know this?")
- [x] Public read access — anyone can browse without an account
- [x] Auth-gated write actions

---

## 4. Phase 2 — Research Tools + Agent Engine (Complete)

**Goal:** Build the AI agent framework that populates the platform with content, and the research tools to explore that content.

### 2.1 Agent Task System

- [x] Agent tasks table with cost tracking, progress, status, audit logging
- [x] Agent task CRUD API (create, list, update, get)
- [x] Cost tracking per task (tokens in/out, model, estimated USD)
- [x] Task status tracking (queued, running, completed, failed, cancelled)
- [x] Task result logging with RLS (admin/editor write, authenticated read)

### 2.2 Batch Translation Pipeline

- [x] Client-orchestrated batch processor (translate all untranslated passages)
- [x] Rate limiting (1.5s delay between API calls)
- [x] Progress tracking UI with live progress bar
- [x] Pause, resume, and cancel controls
- [x] Multi-language support (select target language)
- [x] Per-passage cost and token tracking

### 2.3 Manuscript Discovery Agent

- [x] Claude-powered discovery (research query → structured manuscript suggestions)
- [x] Discovery prompts tuned for scholarly accuracy and confidence notes
- [x] One-click "Add to Library" from discovery results (manuscript record only)
- [x] Duplicate detection against existing library
- [x] "Add All New" batch approval
- [x] Example query suggestions in UI

### 2.3b Full Manuscript Import

- [x] Two-stage import: TOC scan (Claude lists books) → programmatic chapter expansion
- [x] Section-by-section text retrieval via Claude Haiku 4.5 (fast recall model)
- [x] Already-imported section detection (re-scan shows "Imported" badge)
- [x] Select-all / select-none / individual section checkboxes
- [x] Progress bar with per-section cost tracking
- [x] "Retry Failed" button for re-attempting failed imports
- [x] Cancel mid-import support
- [x] Passage editing and deletion from manuscript detail page
- [x] Migration 020: `ai_reconstructed` and `ai_imported` transcription methods

### 2.4 OCR Pipeline

- [x] Image upload with base64 and Supabase Storage support
- [x] Claude Vision API integration (image → transcribed text)
- [x] Passage extraction with confidence scoring per passage
- [x] Review-then-save flow (OCR results shown for review before saving)
- [x] Quality assessment and language detection
- [x] Image preview in admin UI

### 2.5 Automated Variant Detection

- [x] Passage comparison across manuscripts by reference or manual selection
- [x] AI-powered variant classification (major, minor, orthographic)
- [x] Variant and reading record creation
- [x] Scholarly analysis per variant (origin, which reading may be original)
- [x] Two comparison modes: by reference and multi-select

### 2.6 Advanced Search

- [x] Full-text search across passages (GIN tsvector) and translations
- [x] ILIKE search on manuscript titles, descriptions, locations
- [x] Type filters (manuscript, passage, translation)
- [x] Public search page at /search
- [x] Results with type badges, confidence scores, and snippets

### 2.7 Evidence Explorer

- [x] Evidence chain visualization (sources → AI processing → translation → reviews)
- [x] Full provenance display (method, model, confidence, metadata)
- [x] Review display with star ratings and status
- [x] Evidence explorer page at /evidence/[id]

### 2.8 Scholarly Export

- [x] JSON export (full structured data with metadata)
- [x] CSV export (spreadsheet-compatible tabular data)
- [x] TEI XML export (TEI P5 standard with manuscript metadata)
- [x] Export dropdown menu on manuscript detail page

### 2.9 Admin Dashboard

- [x] Content stats (manuscripts, passages, translations, reviews)
- [x] Agent cost summary (total cost, tokens in/out, active tasks)
- [x] Cost breakdown by task type
- [x] Task history with status, progress, tokens, cost, date
- [x] Tabbed layout (Agent Operations / Task History)

### 2.10 Manuscript Text Source Integration

- [x] bolls.life Bible API as primary text source (LXX, TR, WLC — standard editions)
- [x] AI model escalation fallback (Haiku → Sonnet) when API unavailable
- [x] Content filter bypass: API-first architecture avoids AI refusal for biblical text
- [x] `standard_edition` transcription method and metadata (`edition_source`)
- [x] Variant detection pre-check: skip identical/same-source passages, warn users
- [x] Blue "Std. Edition" badge with tooltip for API-sourced text
- [x] Migration 021: `standard_edition` transcription method
- [x] INTF NTVMR API integration (manuscript-specific NT transcriptions, ~5,800 manuscripts)
- [x] Gregory-Aland docID mapping for major uncials and papyri
- [x] NTVMR HTML parser (strips correction apparatus, extracts original-hand text)
- [x] `scholarly_transcription` transcription method and metadata
- [x] Green "INTF Transcription (GA nn)" badge for manuscript-specific text
- [x] Migration 022: `scholarly_transcription` transcription method
- [x] SBLGNT integration (CC BY 4.0, replaces Textus Receptus as NT Greek standard edition)
- [x] Leningrad Codex recognition (WLC labeled `scholarly_transcription` when manuscript IS the Leningrad Codex)
- [x] Six-step fallback chain: Sinaiticus Project → NTVMR → DSS → SBLGNT → bolls.life → AI
- [x] `manuscript_source_texts` Supabase table for preprocessed data (Migration 023)
- [x] Codex Sinaiticus Project XML preprocessing script (CC BY-NC-SA 3.0, OT+NT)
- [x] ETCBC Dead Sea Scrolls preprocessing script (MIT, OT Hebrew fragments)
- [x] Run Sinaiticus preprocessing to populate data
- [x] Run DSS preprocessing to populate data
- [x] Expanded book order lists (deuterocanonical, Ethiopian canon, apocryphal texts)

### 2.11 Test Infrastructure and Process Compliance

- [x] Vitest test framework installed and configured
- [x] Pure text-source functions extracted into `app/src/lib/utils/text-sources.ts`
- [x] 37 unit tests for text source chain (parsing, script detection, SBL mappings, NTVMR, Leningrad)
- [x] `test`, `test:watch`, `test:ci` scripts in package.json
- [x] DSS preprocessing script rewritten from Python to Node.js (no Python dependency)
- [x] DATA_MODEL.md updated (agent_tasks, manuscript_source_texts, migrations 019-023)
- [x] SECURITY_MODEL.md updated (agent_tasks, manuscript_source_texts RLS policies)
- [x] DEVELOPMENT_LOG.md entry recorded

### 2.12 Pipeline Hardening + Transparency

- [x] TOC generation: `chapter_start` support for fragmentary manuscripts (P52 → "John 18" not bare "John")
- [x] TOC model switch: Sonnet → Haiku for cost savings (book list generation)
- [x] Section-text: `hasChapter` guards prevent silent failures on bare book references
- [x] Section-text: language-aware source chain (bolls.life skipped for non-Greek/Hebrew, DSS skipped for non-Hebrew)
- [x] Section-text: `MIN_TEXT_LENGTH` lowered to 100 for fragmentary manuscripts
- [x] Script detection expanded: Syriac, Coptic, Ethiopic, Armenian, Georgian, Arabic, Latin
- [x] AI prompt: manuscript title included for context, language-specific prefill characters
- [x] NTVMR mappings expanded: P52 and more papyri with alias variants
- [x] Variant detection: Sonnet → Haiku for speed, retry with 30s timeout, passage text capped at 6000 chars
- [x] Variant detection: `max_tokens` reduced 8192 → 4000, prompt tightened
- [x] Comprehensive structured logging with request IDs across TOC, section-text, and variant detection
- [x] Text Provenance component on translation page (collapsible source chain for readers)

### Exit Criteria — Met

AI agents can discover manuscripts, transcribe images, translate passages, and detect variants. Admin dashboard provides cost monitoring and task management. Research tools (search, evidence explorer, export) make content accessible. Text source chain prioritizes manuscript-specific scholarly transcriptions over standard editions over AI generation. All pipelines have structured logging with request IDs. Readers can see transparent source provenance for every passage.

---

## 5. Phase 3 — Polish + Scale

**Goal:** Transform the platform from a functional research engine into a polished, explorable product that readers and scholars want to use and share.

### 3.1 Public Exploration Surface (Priority: High) — Complete

Build the reader-facing experience that makes manuscript data browsable and discoverable.

- [x] Scripture browser: `/read` page with book/chapter grid navigation across all manuscripts
- [x] Chapter reading view: `/read/[book]/[chapter]` with serif reading layout, transparency indicators, and evidence links
- [x] Manuscript comparison view: `/read/[book]/[chapter]/compare` with side-by-side panels and translation/original toggle
- [x] Guided discovery paths on the landing page (Earliest NT, Dead Sea Scrolls, Septuagint)
- [x] Landing page with dynamic content stats, featured manuscripts, recent translations
- [x] Passage deep-link sharing with OG metadata and share button (native share on mobile, clipboard on desktop)
- [x] Public API endpoints: `/api/scripture/books`, `/api/scripture/[book]/[chapter]`, `/api/stats`
- [x] Shared `BOOK_ORDER` utility extracted to `lib/utils/book-order.ts`
- [x] PassageNavigator component (desktop dropdowns, mobile bottom sheet)
- [x] "Read" link added to header and mobile navigation

### 3.2 Variant System Enhancement (Priority: High) — Complete

Make the variant detection and exploration system robust and useful for scholars.

- [x] Variant versioning: `variant_detection_runs` table tracks each detection execution (migration 024)
- [x] Detect-variants API: cache check for previous runs, `force` parameter for re-detection, run tracking on save
- [x] Variant exploration UI: `/variants` page rewritten with book grouping, significance filter, search-by-reference
- [x] Variant attestation display: attestation section below diff view showing majority/minority readings with manuscript dates
- [x] Bidirectional linking: translate page shows related variants, variant detail page shows source passages, chapter view shows variant badges
- [x] Scholarly analysis panel on variant detail page with significance badge

### 3.3 AI Research Summaries (Priority: Medium) — Complete

- [x] Passage summary API (`/api/summaries/passage`) — Haiku-powered, cached in `passages.metadata.ai_summary`
- [x] Manuscript summary API (`/api/summaries/manuscript`) — Haiku-powered, cached in `manuscripts.metadata.ai_summary`
- [x] "About This Passage" expandable section in chapter reading view with generate button for authenticated users
- [x] "Scholarly Significance" section on manuscript detail page with significance factors and traditions
- [x] ConfidenceExplanation component in translation workspace — derives breakdown from version, evidence, and review data
- [x] Improvement tips panel suggesting how to raise confidence scores

### 3.4 Interactive Visualizations (Priority: Medium) — Complete

- [x] Leaflet + react-leaflet dependencies installed with @types/leaflet
- [x] `/visualize` hub page linking to all three visualizations
- [x] `/visualize/timeline` — horizontal scrollable timeline, manuscripts plotted by date, color-coded by language, click-to-detail
- [x] `/visualize/map` — Leaflet map with origin (blue) and archive (green) markers, layer toggles, static geocoding lookup for ~80 known locations
- [x] `/visualize/stemma` — SVG directed graph for manuscript lineage, informative empty state when no lineage data exists, edge styling by relationship type
- [x] "Visualize" link added to header and mobile navigation

### 3.5 Performance + Infrastructure (Priority: Medium)

- [ ] Vercel ISR for popular manuscript and passage pages
- [ ] Database query optimization for large passage sets
- [ ] Image optimization pipeline for manuscript images
- [ ] PWA offline reading cache for previously viewed content
- [ ] Push notifications via Firebase (translation complete, new review, variant detected)

### 3.6 Accessibility + i18n (Priority: Standard)

- [ ] WCAG 2.1 AA accessibility audit and remediation
- [ ] RTL text support for Hebrew, Arabic, Syriac passages
- [ ] Multi-language interface (i18n) — English first, then community translations
- [ ] Screen reader optimization for manuscript/passage navigation

### 3.7 API + Integrations (Priority: Standard)

- [ ] Public REST API with rate limiting and documentation
- [ ] IIIF manifest generation for manuscript images
- [ ] Zotero integration for citation export
- [ ] Institutional catalog linking (OCLC, WorldCat)

### 3.8 Collaboration + Community (Priority: Future)

- [ ] Shared workspaces for research teams
- [ ] Annotation system (user notes on passages)
- [ ] Community contribution workflows (suggest corrections, submit readings)
- [ ] Moderation and quality control for community contributions

### Exit Criteria

Platform is polished, accessible, and ready for broader public and institutional use. Readers can explore manuscripts intuitively. Scholars can use the variant and comparison tools for real research. Content is discoverable via search engines and shareable via direct links.

---

## 6. Success Milestones

| Milestone | Target | Phase |
|---|---|---|
| First manuscript ingested and translated | Complete | 1 |
| First human review submitted | Complete | 1 |
| Batch translation pipeline operational | Complete | 2 |
| Agent discovery system operational | Complete | 2 |
| OCR pipeline operational | Complete | 2 |
| Variant detection operational | Complete | 2 |
| Full-text search operational | Complete | 2 |
| Evidence explorer operational | Complete | 2 |
| Scholarly export (JSON, CSV, TEI XML) operational | Complete | 2 |
| Admin dashboard with cost monitoring | Complete | 2 |
| Manuscript-specific text sources (NTVMR, Sinaiticus, DSS) | Complete | 2 |
| Six-step text source fallback chain operational | Complete | 2 |
| Test infrastructure with text source chain coverage | Complete | 2 |
| Pipeline hardening with comprehensive logging | Complete | 2 |
| Text provenance transparency for readers | Complete | 2 |
| Public scripture browser with chapter reading view | Complete | 3.1 |
| Manuscript comparison view (side-by-side) | Complete | 3.1 |
| Dynamic landing page with stats and discovery paths | Complete | 3.1 |
| Deep-link sharing with OG metadata | Complete | 3.1 |
| Variant versioning with detection run tracking | Complete | 3.2 |
| Variant exploration UI with book grouping and filters | Complete | 3.2 |
| Variant attestation and bidirectional passage linking | Complete | 3.2 |
| AI passage and manuscript summaries with caching | Complete | 3.3 |
| Confidence score explanations with improvement tips | Complete | 3.3 |
| Manuscript timeline visualization | Complete | 3.4 |
| Geographic provenance map (Leaflet) | Complete | 3.4 |
| Textual family tree / stemma infrastructure | Complete | 3.4 |
| 100 manuscripts in the system | Phase 3 | 3 |
| 1,000 passages translated with evidence records | Phase 3 | 3 |

---

## 7. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| AI API cost overrun from agent activity | High | Per-task token limits, session budgets, cost dashboard, rate limiting |
| Low-quality agent output (bad OCR, wrong metadata) | Medium | Confidence scoring on all agent output, human review queue for low-confidence items |
| Scope creep into public-facing features before content depth | Medium | Phase 2 focuses exclusively on content and research tools; polish deferred to Phase 3 |
| Technical debt from rapid Phase 2 development | Medium | Architecture already sound from Phase 0/1; maintain test coverage and code review |
| Anthropic API changes or pricing shifts | Medium | Abstraction layer over AI calls; prompt templates separate from application logic |
| AI model retirement (experienced: Haiku 3.5 retired Feb 2026) | Medium | Use dated model IDs, monitor Anthropic deprecation notices, quick swap to successor |
| AI content filtering blocks biblical text | Medium | Addressed: API-first architecture (bolls.life, NTVMR, SBLGNT) bypasses AI entirely; AI is last resort |
| Third-party data license restrictions | Medium | NTVMR CC BY 4.0, SBLGNT CC BY 4.0, ETCBC/dss MIT; Sinaiticus Project CC BY-NC-SA 3.0 (non-commercial only) |

---

## Appendix: How to Read This Roadmap

- **Checkboxes** track individual deliverables.
- **Exit Criteria** define what "done" means for each phase.
- **This is a living document.** Update it as the project evolves.
- **Phases are sequential** but the boundary between 2 and 3 is flexible — pull Phase 3 items forward if they become blocking.
