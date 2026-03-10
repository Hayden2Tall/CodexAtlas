# CodexAtlas — Development Roadmap

> **Last Updated:** 2026-03-10
> **Status:** Phase 2 (Research Tools + Agent Engine) complete · Phase 3 (Polish + Scale) when ready
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

### Exit Criteria — Met

AI agents can discover manuscripts, transcribe images, translate passages, and detect variants. Admin dashboard provides cost monitoring and task management. Research tools (search, evidence explorer, export) make content accessible.

---

## 5. Phase 3 — Polish + Scale (When Ready)

**Goal:** When the platform has substantial content and you're ready to share it more broadly, add the polish and infrastructure for wider use.

This phase is intentionally open-ended. Pull items in as needed.

### Potential Deliverables

- [ ] Public exploration surface (scripture browser, guided paths)
- [ ] AI-generated plain-language research summaries
- [ ] Interactive visualizations (manuscript timeline, geographic map, stemma tree)
- [ ] Vercel deployment optimization (ISR for popular pages)
- [ ] PWA offline reading and push notifications
- [ ] WCAG 2.1 AA accessibility audit
- [ ] Public REST API for third-party integrations
- [ ] Multi-language interface (i18n)
- [ ] Collaboration features (shared workspaces, annotation)
- [ ] Community contribution workflows
- [ ] Institutional partnership integrations (IIIF, Zotero, catalog linking)

### Exit Criteria

Platform is ready for broader public and institutional use if desired.

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

---

## Appendix: How to Read This Roadmap

- **Checkboxes** track individual deliverables.
- **Exit Criteria** define what "done" means for each phase.
- **This is a living document.** Update it as the project evolves.
- **Phases are sequential** but the boundary between 2 and 3 is flexible — pull Phase 3 items forward if they become blocking.
