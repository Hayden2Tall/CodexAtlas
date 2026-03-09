# CodexAtlas — Development Roadmap

> **Last Updated:** 2026-03-09
> **Status:** Phase 0 — Foundation (Active)
> **Companion Documents:** [PROJECT_CONSTITUTION.md](./PROJECT_CONSTITUTION.md) · [MASTER_PLAN.md](./MASTER_PLAN.md) · [DATA_MODEL.md](./DATA_MODEL.md) · [SECURITY_MODEL.md](./SECURITY_MODEL.md)

---

## 1. Roadmap Overview

This roadmap defines the phased development plan for CodexAtlas — an open-source, AI-assisted research platform for ancient religious manuscripts. Each phase builds on the previous one, progressively expanding from foundational documentation through a minimal viable prototype, professional research tools, public exploration, scalability, and ultimately a global research network.

**Core Principles:**

- **Quality over speed.** Architecture integrity and data trustworthiness are never sacrificed for velocity.
- **Transparency first.** Every AI output carries an evidence record. Every translation is versioned and reviewable.
- **Phase gates are real.** No phase begins until the exit criteria of the previous phase are met.
- **Ship incrementally.** Each phase delivers usable value on its own.

**Tech Stack:** Next.js (App Router) PWA deployed on Vercel · Supabase (Postgres + Auth + Storage) · Firebase (push notifications) · Claude AI (translation and analysis)

---

## 2. Phase 0 — Foundation (Current Phase)

**Timeline:** Weeks 1–2
**Goal:** Establish the architectural and documentation foundation that every future phase depends on.

### Deliverables

- [x] Repository structure created
- [x] PROJECT_CONSTITUTION.md
- [x] MASTER_PLAN.md
- [x] PRODUCT_STRATEGY.md
- [x] ROADMAP.md *(this document)*
- [x] DATA_MODEL.md
- [x] SECURITY_MODEL.md
- [x] UX_GUIDELINES.md
- [x] DEVELOPMENT_LOG.md
- [ ] Architecture summaries for agent context
- [ ] Git repository initialized
- [ ] README.md with project overview
- [ ] `.gitignore` configured
- [ ] Initial `package.json`

### Exit Criteria

All documentation complete and reviewed. Repository initialized with proper ignore rules and dependency manifest. Team (human and AI) has the context needed to begin Phase 1.

---

## 3. Phase 1 — Minimal Viable Prototype (MVP)

**Timeline:** Weeks 3–8
**Goal:** Build the core research pipeline end-to-end — from manuscript ingestion through AI translation to human review — with full transparency at every step.

### 1.1 Project Setup

- [ ] Next.js project initialization (App Router, TypeScript, Tailwind CSS)
- [ ] Supabase project setup (database, auth, storage buckets)
- [ ] Database schema migration (core tables from DATA_MODEL.md)
- [ ] Authentication setup (Supabase Auth — email, OAuth)
- [ ] Row-Level Security (RLS) policies for all tables
- [ ] PWA configuration (web manifest, service worker registration)
- [ ] CI/CD pipeline (GitHub Actions → Vercel preview + production deploys)

### 1.2 Manuscript Ingestion

- [ ] Manuscript creation form (manual entry with metadata fields)
- [ ] Manuscript metadata storage (language, date range, archive, condition)
- [ ] Manuscript image upload to Supabase Storage
- [ ] Passage creation and original-language text storage
- [ ] Basic manuscript browser (list, filter by language/date)

### 1.3 Translation Pipeline

- [ ] AI translation endpoint (Claude API integration via server action)
- [ ] Translation version creation and storage with full provenance
- [ ] Evidence record generation for each translation decision
- [ ] Confidence score calculation (per-passage, per-phrase)
- [ ] Translation viewer with version history navigation

### 1.4 Variant Comparison

- [ ] Variant reading entry (manual and AI-assisted)
- [ ] Side-by-side passage comparison view
- [ ] Basic diff visualization (word-level highlighting)
- [ ] Similarity scoring between variant readings

### 1.5 Review System

- [ ] Review submission form (structured rating, critique categories, free text)
- [ ] Review display on translation versions
- [ ] Basic review listing with filters

### 1.6 Transparency Layer

- [ ] Transparency indicators on all translations (confidence %, method, model version, source manuscripts)
- [ ] Version history viewer (who changed what, when, why)
- [ ] Evidence record viewer (reasoning chain for every AI decision)

### Exit Criteria

A user can ingest a manuscript, generate an AI translation with a full evidence record, compare variant readings across manuscripts, and submit a structured review — all with complete transparency into how every output was produced.

---

## 4. Phase 2 — Research Platform

**Timeline:** Weeks 9–16
**Goal:** Build professional research tools that make CodexAtlas indispensable for manuscript scholars.

### 2.1 Advanced Variant Analysis

- [ ] Multi-manuscript variant comparison (3+ witnesses)
- [ ] Variant apparatus generation (critical apparatus format)
- [ ] Variant frequency analysis across corpus
- [ ] Variant visualization (charts, heatmaps, distribution plots)

### 2.2 Manuscript Lineage

- [ ] Lineage relationship creation (parent/child, sibling, copy-of)
- [ ] Stemma visualization (interactive tree/graph using D3 or similar)
- [ ] Confidence-scored lineage hypotheses with evidence links
- [ ] Lineage comparison tools (overlay multiple stemma proposals)

### 2.3 Review Cluster Analysis

- [ ] AI-powered review clustering (group reviews by position)
- [ ] Consensus detection across reviewer clusters
- [ ] Cluster visualization (scatter, dendrogram)
- [ ] Consensus-driven translation revision proposals

### 2.4 Evidence Explorer

- [ ] Full evidence chain navigation (translation → evidence → source)
- [ ] Cross-reference browsing between related evidence records
- [ ] Evidence scoring dashboard (strength, coverage, agreement)

### 2.5 Scholarly Export

- [ ] Research package generation (bundled data + metadata)
- [ ] CSV export (tabular data)
- [ ] JSON export (structured data)
- [ ] TEI XML export (scholarly standard format)
- [ ] Stable citation identifiers (persistent URIs for every entity)
- [ ] Reproducibility metadata (model version, prompt hash, timestamp)

### 2.6 Advanced Search

- [ ] Full-text search across manuscripts and translations (Postgres full-text or pg_trgm)
- [ ] Filtered search by language, date range, archive, status, confidence
- [ ] Canonical reference search (book/chapter/verse lookup)

### Exit Criteria

Scholars can perform professional research workflows entirely within the platform — variant analysis, lineage exploration, review synthesis, and evidence navigation. Export and citation systems produce publication-ready outputs.

---

## 5. Phase 3 — Public Exploration Platform

**Timeline:** Weeks 17–24
**Goal:** Launch the public-facing exploration experience that makes manuscript research accessible to everyone.

### 3.1 Exploration Surface

- [ ] Scripture explorer (browse by book → chapter → verse)
- [ ] Translation viewer with transparency indicators visible by default
- [ ] "How do we know this?" evidence links on every translation
- [ ] Plain-language research summaries (AI-generated, human-reviewed)

### 3.2 Discovery Feed

- [ ] Curated discoveries feed (editorially selected highlights)
- [ ] New manuscript notifications
- [ ] Translation update notifications
- [ ] Personalized feed based on user interests

### 3.3 PWA Enhancement

- [ ] Offline reading capability (cached manuscripts and translations)
- [ ] Push notifications via Firebase Cloud Messaging
- [ ] Install prompts (smart banner timing)
- [ ] Performance optimization (target: < 3 s initial load, < 1 s navigation)

### 3.4 Interactive Visualizations

- [ ] Manuscript timeline (historical placement of all manuscripts)
- [ ] Geographic manuscript map (archive locations, discovery sites)
- [ ] Lineage tree explorer (simplified, interactive public version)

### 3.5 Accessibility

- [ ] WCAG 2.1 AA compliance audit and remediation
- [ ] Screen reader optimization (ARIA labels, semantic HTML)
- [ ] Full keyboard navigation
- [ ] High contrast mode and reduced motion support

### Exit Criteria

Public users can explore manuscripts, read translations with full transparency, and engage with research findings through an accessible, performant PWA. Lighthouse scores ≥ 90 across all categories.

---

## 6. Phase 4 — Scale and Optimization

**Timeline:** Weeks 25–36
**Goal:** Scale the platform to handle large manuscript collections and high traffic without degrading the user experience.

### 4.1 Performance

- [ ] Database query optimization (EXPLAIN ANALYZE audit, index tuning)
- [ ] Postgres partitioning for large tables (passages, evidence records)
- [ ] Connection pooling optimization (Supabase pgBouncer tuning)
- [ ] CDN optimization for manuscript images (responsive formats, lazy loading)
- [ ] Incremental Static Regeneration for public exploration pages

### 4.2 Processing Pipelines

- [ ] OCR pipeline (manuscript image → raw text via vision model)
- [ ] Batch translation pipeline (queue-based, rate-limited)
- [ ] Automated variant detection pipeline (cross-manuscript diffing)
- [ ] Background job queue system (Postgres-based or external queue)

### 4.3 Knowledge Graph

- [ ] Knowledge graph query optimization (materialized views, recursive CTEs)
- [ ] Graph traversal APIs (shortest path, neighborhood queries)
- [ ] Relationship recommendation engine (suggest likely connections)

### 4.4 AI Agent Framework

- [ ] Agent task packet system implementation (structured task → result)
- [ ] Agent autonomy mode controls (full-auto, supervised, manual)
- [ ] Cost tracking and per-task limits (token budgets, dollar caps)
- [ ] Agent monitoring dashboard (task status, cost, quality metrics)

### 4.5 Public API

- [ ] Public REST API for third-party access
- [ ] API documentation (OpenAPI 3.1 spec, interactive docs)
- [ ] Rate limiting and usage tracking (tiered access)
- [ ] API key management

### Exit Criteria

Platform handles 10,000+ manuscripts with sub-second response times. Processing pipelines operate reliably in the background. Public API is documented and available to third-party developers.

---

## 7. Phase 5 — Global Research Network

**Timeline:** Months 10–18
**Goal:** Become the global open research platform for ancient religious manuscripts.

### 5.1 Collaboration

- [ ] Multi-user research workspaces (shared projects with role-based access)
- [ ] Annotation sharing (highlights, notes, cross-references)
- [ ] Discussion threads on passages and translations

### 5.2 Institutional Partnerships

- [ ] Archive integration APIs (pull metadata and images from partner archives)
- [ ] Library catalog linking (WorldCat, OCLC, institutional catalogs)
- [ ] University program partnerships (curriculum integration, research grants)

### 5.3 Multilingual Interface

- [ ] Interface localization (i18n framework, initial languages: English, German, French)
- [ ] Multi-language translation support (expand beyond initial language pairs)
- [ ] RTL language support (Arabic, Hebrew interface and content rendering)

### 5.4 Community

- [ ] Contributor onboarding (documentation, first-issue labels, mentoring)
- [ ] Community review programs (structured volunteer reviewer training)
- [ ] Open governance processes (RFC process, public roadmap voting)

### Exit Criteria

International scholar and institutional adoption. Active open-source contributor community. Multiple interface languages supported. Governance processes enable community-driven development.

---

## 8. Success Milestones

| Milestone | Target | Phase |
|---|---|---|
| First manuscript ingested | Week 4 | 1 |
| First AI translation with evidence record | Week 5 | 1 |
| First variant comparison completed | Week 6 | 1 |
| First human review submitted | Week 7 | 1 |
| 100 manuscripts in the system | Week 12 | 2 |
| First scholarly export generated | Week 14 | 2 |
| Public beta launch | Week 20 | 3 |
| 1,000 manuscripts in the system | Week 30 | 4 |
| First academic citation of CodexAtlas | Month 12 | 5 |
| 10,000 manuscripts in the system | Month 18 | 5 |

---

## 9. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Scope creep | High | High | Strict adherence to PROJECT_CONSTITUTION; phased exit criteria enforce discipline |
| AI cost overrun | Medium | Medium | Per-task cost limits; token budgets; caching repeated queries; cost monitoring dashboard |
| Low scholar adoption | High | Medium | Co-design with scholars from Phase 1; alpha testing program; conference presentations |
| Technical debt accumulation | Medium | Medium | Architecture Guardian agent; Tech Debt Monitor; refactoring sprints between phases |
| Data quality issues | High | Low | Evidence records provide auditability; human review layer; confidence thresholds for publication |
| API/vendor lock-in | Medium | Low | Abstraction layers over Supabase and Claude; standard export formats; self-host path documented |
| Security breach (sensitive manuscripts) | High | Low | RLS on every table; SECURITY_MODEL.md policies enforced; regular penetration testing |

---

## Appendix: How to Read This Roadmap

- **Checkboxes** (`- [ ]` / `- [x]`) track individual deliverables. Update them as work completes.
- **Exit Criteria** define what "done" means for each phase. No phase transitions without meeting them.
- **Timelines** are estimates. Adjust based on actual velocity, but do not skip phases.
- **This is a living document.** Update it as the project evolves, but preserve the phase structure and exit-criteria discipline defined in the PROJECT_CONSTITUTION.
