# CodexAtlas — Development Roadmap

> **Last Updated:** 2026-03-09
> **Status:** Phase 1 (MVP) complete · Phase 2 (Research Tools + Agent Engine) next
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

## 4. Phase 2 — Research Tools + Agent Engine (Next)

**Goal:** Build the AI agent framework that populates the platform with content, and the research tools to explore that content. This is where CodexAtlas goes from a demo to something genuinely useful.

### 2.1 Agent Task System

The foundation for all autonomous agent work.

- [ ] Task packet runner (structured JSON in → structured result out)
- [ ] Agent execution via API routes using service role key
- [ ] Cost tracking per task (tokens used, model, estimated cost)
- [ ] Token budget enforcement (per-task limits, session caps)
- [ ] Task status tracking (queued, running, completed, failed)
- [ ] Task result logging to audit_log with full provenance

### 2.2 Batch Translation Pipeline

Scale the existing translation endpoint to handle volume.

- [ ] Queue-based batch processor (translate all untranslated passages)
- [ ] Rate limiting to stay within API cost budgets
- [ ] Progress tracking UI (X of Y passages translated)
- [ ] Error handling and retry logic
- [ ] Multi-language batch support (translate to English, then other languages)

### 2.3 Manuscript Discovery Agent

AI agent that finds and catalogs manuscripts from public digital archives.

- [ ] Source registry (list of digital archives to crawl — e.g., CSNTM, INTF, British Library, Vatican Library)
- [ ] Discovery prompts (Claude analyzes archive metadata to extract structured manuscript data)
- [ ] Manuscript creation from discovered metadata
- [ ] Duplicate detection (avoid re-ingesting known manuscripts)
- [ ] Source attribution and provenance tracking

### 2.4 OCR Pipeline

Extract text from manuscript images using Claude's vision capabilities.

- [ ] Image upload and processing queue
- [ ] Claude vision API integration (image → transcribed text)
- [ ] Passage creation from OCR output
- [ ] Confidence scoring for OCR quality
- [ ] Human review queue for low-confidence transcriptions

### 2.5 Automated Variant Detection

Cross-manuscript comparison when multiple witnesses exist for the same passage.

- [ ] Passage alignment (match passages across manuscripts by reference)
- [ ] Word-level and character-level diffing
- [ ] Variant record creation with classification (spelling, word order, omission, addition)
- [ ] Significance scoring (trivial vs. meaningful variants)

### 2.6 Advanced Search

Essential once the corpus grows beyond what you can browse manually.

- [ ] Full-text search across manuscripts, passages, and translations
- [ ] Filtered search (language, date range, archive, confidence score)
- [ ] Canonical reference search (book/chapter/verse lookup)
- [ ] Search results with transparency indicators

### 2.7 Evidence Explorer

Full navigation of the evidence chain.

- [ ] Evidence chain visualization (translation → evidence → source manuscript → passage)
- [ ] Cross-reference browsing between related evidence records
- [ ] Evidence strength indicators

### 2.8 Scholarly Export

Get data out in useful formats.

- [ ] CSV export (tabular manuscript and translation data)
- [ ] JSON export (structured data with full metadata)
- [ ] TEI XML export (scholarly standard format)
- [ ] Stable citation identifiers for every entity

### 2.9 Admin Dashboard

Monitor what the agents are doing and what the platform contains.

- [ ] Content stats (manuscripts, passages, translations, reviews, variants)
- [ ] Agent activity log (recent tasks, success/failure rates)
- [ ] Cost dashboard (API spend by agent, by task type, over time)
- [ ] Queue status (pending tasks, processing, completed)

### Exit Criteria

AI agents can discover manuscripts, transcribe images, translate passages, and detect variants — all autonomously with human oversight. The platform contains a meaningful corpus of content. Research tools (search, evidence explorer, export) make that content useful.

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
| Batch translation pipeline operational | Phase 2 | 2 |
| First agent-discovered manuscript ingested | Phase 2 | 2 |
| 100 manuscripts in the system | Phase 2 | 2 |
| First OCR transcription from manuscript image | Phase 2 | 2 |
| 1,000 passages translated with evidence records | Phase 2 | 2 |
| First scholarly export generated | Phase 2 | 2 |
| Full-text search operational | Phase 2 | 2 |

---

## 7. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| AI API cost overrun from agent activity | High | Per-task token limits, session budgets, cost dashboard, rate limiting |
| Low-quality agent output (bad OCR, wrong metadata) | Medium | Confidence scoring on all agent output, human review queue for low-confidence items |
| Scope creep into public-facing features before content depth | Medium | Phase 2 focuses exclusively on content and research tools; polish deferred to Phase 3 |
| Technical debt from rapid Phase 2 development | Medium | Architecture already sound from Phase 0/1; maintain test coverage and code review |
| Anthropic API changes or pricing shifts | Medium | Abstraction layer over AI calls; prompt templates separate from application logic |

---

## Appendix: How to Read This Roadmap

- **Checkboxes** track individual deliverables.
- **Exit Criteria** define what "done" means for each phase.
- **This is a living document.** Update it as the project evolves.
- **Phases are sequential** but the boundary between 2 and 3 is flexible — pull Phase 3 items forward if they become blocking.
