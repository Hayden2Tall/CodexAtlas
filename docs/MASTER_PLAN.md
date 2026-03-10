# CodexAtlas — Master Plan

> **Primary Technical Reference Document**
> Version 1.0 · March 2026

---

## 1. Vision

CodexAtlas is a global, open research platform for ancient religious manuscripts. It combines AI-powered analysis with human scholarly review to create a living, transparent, evidence-based research environment.

The platform serves two audiences through a single unified codebase:

- **Scholars** receive professional-grade research tools — variant analysis, lineage reconstruction, structured peer review, reproducible evidence scoring, and exportable research packages.
- **The public** receives accessible exploration tools — readable translations, manuscript timelines, lineage visualizations, and guided discovery of textual traditions.

Every translation, analysis, and conclusion produced on CodexAtlas carries a full evidence chain: source manuscripts, methods used, AI models invoked, confidence scores, human reviews, and version history. Nothing is hidden, nothing is deleted. The platform operates as a transparent scientific research ledger where the process of understanding ancient texts is as visible as the results.

CodexAtlas is open-source. The data, the tools, and the reasoning are available for inspection, critique, and contribution by anyone.

---

## 2. System Architecture Overview

The system is organized into eight distinct layers. Each layer has a clear boundary of responsibility and communicates with adjacent layers through well-defined interfaces.

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                             │
│              Next.js PWA · Vercel Edge Network                  │
│         ┌─────────────────┐  ┌──────────────────┐              │
│         │ Research Surface │  │ Exploration Surface│             │
│         │   (Scholars)     │  │   (Public)        │             │
│         └────────┬─────────┘  └────────┬──────────┘             │
└──────────────────┼─────────────────────┼────────────────────────┘
                   │                     │
┌──────────────────┼─────────────────────┼────────────────────────┐
│                  ▼     API LAYER       ▼                        │
│          Next.js API Routes · REST · Auth Middleware             │
└──────────────────┬──────────────────────────────────────────────┘
                   │
        ┌──────────┼──────────────────────────┐
        ▼          ▼                          ▼
┌──────────┐ ┌───────────┐ ┌────────────────────────────────────┐
│ DATABASE │ │  STORAGE  │ │       KNOWLEDGE GRAPH LAYER        │
│  LAYER   │ │   LAYER   │ │  Relationship tables in Postgres   │
│ Supabase │ │ Supabase  │ │  Lineage · Variants · Families     │
│ Postgres │ │ Storage   │ └────────────────────────────────────┘
└────┬─────┘ └─────┬─────┘
     │              │
┌────┴──────────────┴─────────────────────────────────────────────┐
│                  PROCESSING PIPELINE LAYER                       │
│     OCR · Translation · Variant Detection · Review Analysis      │
│            Queue-based · Independently deployable                 │
└──────────────────┬──────────────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────────────────┐
│                      AI AGENT LAYER                              │
│        Development Organization · Research Engine                │
│          Task Packets · Autonomy Modes · Cost Limits             │
└─────────────────────────────────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────────────────┐
│                    NOTIFICATION LAYER                             │
│          Firebase Cloud Messaging · Push Notifications            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Frontend Layer

The frontend is a **Next.js Progressive Web App** hosted on **Vercel**.

It exposes two surfaces through a shared component library and routing structure:

| Surface | Audience | Capabilities |
|---|---|---|
| **Research Surface** | Scholars, translators, reviewers | Variant analysis dashboards, lineage tree editors, structured review submission, evidence scoring views, research package export |
| **Exploration Surface** | General public, students, journalists | Readable translations, manuscript timelines, guided discovery, lineage visualizations, bookmarking |

**PWA requirements:**

- **Installable** — manifests a home-screen icon on mobile and desktop.
- **Offline reading** — previously viewed manuscripts and translations are cached for offline access via a service worker.
- **Push notifications** — opt-in alerts for new reviews, translation updates, and discovery publications.
- **Service worker caching** — static assets, API responses for viewed content, and manuscript images are cached aggressively.
- **Mobile-first** — all layouts are designed for mobile viewports first and scale up.
- **Fast loading** — target Largest Contentful Paint under 2.5 seconds on 3G connections. Achieved through code splitting, ISR, image optimization, and edge delivery.

### 2.2 API Layer

The API layer is implemented as **Next.js API routes**, colocated with the frontend in a single deployment unit.

- **RESTful endpoints** handle all CRUD operations: manuscripts, translations, reviews, users, research packages.
- **Authentication middleware** validates Supabase JWTs on every protected route.
- **Input validation** uses schema-based validation (Zod) to reject malformed requests at the boundary.
- **Rate limiting** protects against abuse — per-user and per-IP limits on write operations, generous limits on reads.
- **Future GraphQL** — the knowledge graph layer may eventually benefit from a GraphQL interface for complex relationship queries (e.g., "find all manuscripts that share variants with document X and have been reviewed by reviewer Y"). This will be introduced only when REST becomes a bottleneck for relationship traversal.

### 2.3 Database Layer

The primary datastore is **Supabase (Postgres)**.

- **Row-Level Security (RLS)** — every table has RLS policies. Users can only read public data and their own private data. Write access is scoped to roles (scholar, reviewer, admin).
- **Append-only data model** — records are never hard-deleted. Deletions are soft (a `deleted_at` timestamp). Edits create new version rows linked to the original. This preserves the complete history of every record for auditability and scholarly integrity.
- **Full-text search** — Postgres `tsvector` and `tsquery` power manuscript and translation search. GIN indexes accelerate lookup. Language-specific dictionaries improve relevance for Greek, Hebrew, Aramaic, Latin, and English.
- **JSONB columns** — manuscript metadata varies widely across traditions and archives. JSONB columns store flexible metadata that doesn't fit the relational schema, while still supporting indexing and querying.

### 2.4 Storage Layer

Binary assets are stored in **Supabase Storage**.

- **Manuscript images** — high-resolution scans, organized by manuscript ID (`/manuscripts/{id}/images/`).
- **PDFs** — generated research packages, exported analyses.
- **CDN-backed** — Supabase Storage serves assets through a CDN for low-latency global delivery.
- **Access control** — storage buckets respect the same RLS policies as the database. Public manuscripts have public images; restricted manuscripts require authentication.

### 2.5 Knowledge Graph Layer

The knowledge graph represents the web of relationships between manuscripts, variants, translations, reviews, and textual families.

**Initial implementation:** relationship tables in Postgres.

```
manuscripts ──has_variant──▶ variants
manuscripts ──belongs_to───▶ textual_families
manuscripts ──witnessed_by─▶ witnesses
translations ──translates──▶ passages
translations ──reviewed_by─▶ reviews
manuscripts ──descended_from──▶ manuscripts  (lineage)
variants ──clustered_with──▶ variants
```

Each relationship row carries metadata: confidence score, method of determination (manual, AI-inferred), supporting evidence references, and timestamps.

**What the knowledge graph powers:**

- **Lineage trees** — visual stemma showing hypothesized manuscript descent.
- **Variant clustering** — grouping manuscripts by shared textual features.
- **Relationship exploration** — traversing connections between any two entities in the graph.
- **Impact analysis** — when a new variant is discovered, tracing which translations and conclusions it affects.

**Future option:** if the relationship graph exceeds the performance characteristics of Postgres (millions of nodes, deep traversals), a dedicated graph database (e.g., Neo4j) can be introduced behind the same API interface. The relationship table schema is designed to make this migration straightforward.

### 2.6 Processing Pipeline Layer

Heavy computational work is **decoupled** from the application layer and executed asynchronously.

**Pipelines:**

| Pipeline | Input | Output |
|---|---|---|
| **OCR** | Manuscript image | Extracted text, character confidence map |
| **Translation** | Source text, language pair | Translation with confidence scores |
| **Variant Detection** | Multiple manuscript texts for same passage | Variant map, difference annotations |
| **Review Analysis** | Set of reviews for a translation | Consensus analysis, dispute identification |
| **Evidence Scoring** | Translation + reviews + variants | Composite evidence score |

**Architecture:**

- **Queue-based** — work items are enqueued and processed asynchronously. Implemented initially with Supabase Edge Functions triggered by database inserts, with the option to move to a dedicated queue (e.g., BullMQ, AWS SQS) if throughput demands it.
- **Independently deployable** — each pipeline is a self-contained module with its own dependencies, tests, and deployment configuration.
- **Idempotent** — re-running a pipeline with the same input produces the same output. This supports retry logic and reproducibility.
- **Observable** — each pipeline run logs its inputs, outputs, duration, cost, and any errors to a pipeline execution table.

### 2.7 AI Agent Layer

AI agents are organized into two groups: the **Development Organization** (which builds and maintains the platform) and the **Research Engine** (which performs scholarly analysis).

- Agents operate via **task packets** — structured documents containing the task description, relevant files, architecture summaries, and constraints. Agents never load the entire repository.
- **Autonomy modes** control how much latitude agents have (see Section 10.4).
- **Cost controls** are enforced at every level — per-task token limits, per-agent daily budgets, and system-wide monthly caps.

### 2.8 Notification Layer

**Firebase Cloud Messaging (FCM)** handles push notifications.

**Notification triggers:**

- A new review is submitted on a translation the user follows.
- A translation the user contributed to is updated.
- A new discovery (manuscript or significant variant) is published.
- A review consensus changes the status of a translation.

Notifications are opt-in per category. Users control granularity in their notification preferences. The frontend service worker receives and displays notifications even when the app is not in the foreground.

---

## 3. Repository Structure

> **Note:** The original plan envisioned separate `pipelines/` and `services/` directories. In practice, all application logic lives inside `app/` using Next.js API routes and shared utilities. The structure below reflects the actual implementation.

```
CodexAtlas/
├── app/                          — Next.js application (frontend + API)
│   ├── public/                   —   Static assets (PWA icons, manifest)
│   └── src/
│       ├── app/
│       │   ├── (main)/           —   Authenticated and public pages
│       │   │   ├── admin/        —     Admin dashboard (import, batch, variants, OCR)
│       │   │   ├── manuscripts/  —     Manuscript browsing, detail, passages, translation
│       │   │   ├── read/         —     Scripture browser, chapter reading, comparison (Phase 3.1)
│       │   │   ├── visualize/   —     Timeline, geographic map, stemma visualizations (Phase 3.4)
│       │   │   ├── search/       —     Public full-text search
│       │   │   ├── variants/     —     Variant exploration, attestation, book-grouped filters (Phase 3.2)
│       │   │   └── evidence/     —     Evidence explorer
│       │   ├── api/
│       │   │   ├── agent/        —     AI agent endpoints (discover, import, translate, detect, OCR)
│       │   │   ├── scripture/    —     Scripture browsing API (books index, chapter data)
│       │   │   ├── summaries/    —     AI summary generation (passage, manuscript) (Phase 3.3)
│       │   │   ├── stats/        —     Platform statistics API
│       │   │   ├── search/       —     Search API
│       │   │   ├── evidence/     —     Evidence API
│       │   │   ├── export/       —     Scholarly export (JSON, CSV, TEI XML)
│       │   │   ├── translate/    —     Translation API
│       │   │   └── passages/     —     Passage CRUD
│       │   └── auth/             —   Auth pages (login, signup, callback)
│       ├── components/
│       │   ├── brand/            —   Logo components
│       │   ├── layout/           —   Header, mobile nav
│       │   ├── scripture/        —   PassageNavigator (Phase 3.1)
│       │   └── ui/               —   Shared UI (badges, share button, confidence explanation, summaries)
│       └── lib/                  —   Supabase clients, types, utilities
│           └── utils/            —     Text sources, book ordering, AI cost, helpers
├── agents/                       — Agent registry and definitions
├── docs/                         — Project documentation (8 documents)
├── prompts/                      — Agent task packet templates
├── summaries/                    — Compressed architecture summaries for agent context
├── scripts/
│   ├── migrations/               — SQL migration files (001-024)
│   ├── preprocess-sinaiticus.mjs — One-time Codex Sinaiticus XML preprocessing
│   └── preprocess-dss.mjs       — One-time Dead Sea Scrolls preprocessing
└── README.md
```

---

## 4. Tech Stack Justification

Each technology choice was made deliberately. This section explains the reasoning.

### Next.js

| Criterion | Rationale |
|---|---|
| **SSR + SSG** | Manuscripts and public translations benefit from static generation for SEO and fast loads. Scholar dashboards use server-side rendering for fresh data. ISR bridges both. |
| **API routes** | Colocating the backend eliminates a separate server deployment. API routes run as serverless functions on Vercel, scaling automatically. |
| **React ecosystem** | The largest UI component ecosystem. Libraries for virtualized lists (manuscript catalogs), rich text (translation editing), graph visualization (lineage trees), and accessibility are mature and maintained. |
| **Vercel deployment** | Next.js on Vercel is a zero-configuration deployment with preview deployments on every PR, automatic HTTPS, and edge network distribution. |

### Supabase

| Criterion | Rationale |
|---|---|
| **Open-source Postgres** | No vendor lock-in on the data layer. Standard SQL. Mature tooling. The data can be exported and run on any Postgres instance. |
| **Built-in auth** | Email/password, OAuth, and magic link authentication with JWT issuance — no need to build or integrate a separate auth service. |
| **Row-Level Security** | Security policies live in the database, not the application. Even if the API layer has a bug, the database enforces access control. |
| **Real-time subscriptions** | Supabase Realtime enables live updates — when a new review is submitted, all users viewing that translation see it appear without polling. |
| **Storage** | Integrated object storage with the same auth model. No separate S3 configuration. |
| **Generous free tier** | Supports development and early deployment without cost. Scales to production tiers when needed. |

### Firebase (Notifications Only)

Firebase is used **exclusively** for push notifications via Firebase Cloud Messaging. The rest of the Firebase suite is not used.

| Criterion | Rationale |
|---|---|
| **Mature push infrastructure** | FCM handles device token management, cross-platform delivery (web, iOS, Android), and retry logic. Building this from scratch is not justified. |
| **Cross-platform** | A single integration covers web push, mobile web, and future native apps. |
| **Narrow scope** | By limiting Firebase to notifications, we avoid coupling the core platform to Google's ecosystem. |

### Vercel

| Criterion | Rationale |
|---|---|
| **Optimized for Next.js** | Vercel is the company behind Next.js. Deployment, edge functions, ISR, and image optimization work without configuration. |
| **Edge network** | Static assets and ISR pages are served from the nearest edge node globally. |
| **Automatic deployments** | Every push to `main` triggers a production deployment. Every PR gets a preview deployment with a unique URL for review. |
| **Observability** | Built-in analytics, error tracking, and performance monitoring. |

### Claude AI

| Criterion | Rationale |
|---|---|
| **Strong reasoning** | Ancient manuscript translation requires nuanced understanding of context, ambiguity, and scholarly convention. Claude's reasoning capabilities handle this better than pattern-matching approaches. |
| **Structured output** | Pipelines require JSON-structured responses: variant maps, confidence scores, evidence chains. Claude reliably produces structured output when instructed. |
| **Long context** | Manuscript analysis often requires comparing long passages across multiple witnesses. Large context windows accommodate this. |
| **Safety alignment** | For a platform dealing with religious texts, responsible handling of sensitive content is essential. |

---

## 5. Manuscript Architecture

### 5.1 Provenance Tracking

Every manuscript record maintains a comprehensive provenance chain:

```
┌─────────────────────────────────────────┐
│           MANUSCRIPT RECORD              │
├─────────────────────────────────────────┤
│ identifier        — unique stable ID     │
│ title             — common name          │
│ origin            — place of creation    │
│ estimated_date    — date range           │
│ language          — primary language(s)  │
│ script            — writing system       │
│ archive_location  — current repository   │
│ archive_id        — catalog number       │
│ material          — papyrus, parchment…  │
│ condition         — preservation state   │
│ related_mss       — links to related mss │
│ historical_context— discovery, transfers │
│ metadata          — JSONB flexible fields│
│ created_at        — record creation      │
│ updated_at        — last modification    │
│ deleted_at        — soft deletion        │
├─────────────────────────────────────────┤
│ VERSIONS: all edits stored as versions   │
│ IMAGES: linked via storage layer         │
│ PASSAGES: segmented text units           │
└─────────────────────────────────────────┘
```

Provenance fields are sourced from catalog records, scholarly publications, and manual entry by verified scholars. Each field carries a `source` annotation indicating where the information came from.

### 5.2 Variant Engine

The Variant Engine detects and analyzes textual differences across manuscript witnesses for the same passage.

**For each passage, the engine produces:**

1. **Witness list** — all manuscripts that contain this passage.
2. **Variant readings** — the distinct textual forms attested across witnesses.
3. **Difference annotations** — character-level and word-level diffs between each pair of witnesses.
4. **Similarity metrics** — quantified similarity scores (Levenshtein distance, n-gram overlap, weighted scholarly metrics) between witnesses.
5. **Variant classification** — categorization of each variant (orthographic, morphological, lexical, transposition, omission, addition).

```
Passage: Mark 1:1
  ├── Witness A (Sinaiticus):  "αρχη του ευαγγελιου ιησου χριστου"
  ├── Witness B (Vaticanus):   "αρχη του ευαγγελιου ιησου χριστου υιου θεου"
  └── Witness C (Bezae):       "αρχη του ευαγγελιου ιησου χριστου υιου του θεου"
       │
       ▼
  Variants detected:
    - Variant 1: omission of "υιου θεου" (A vs B,C)
    - Variant 2: presence of article "του" before "θεου" (C vs B)
```

The Variant Engine is a **processing pipeline** (Section 2.6) — it runs asynchronously when new manuscripts or passages are added, and its results are stored in the knowledge graph.

### 5.3 Lineage Engine

The Lineage Engine reconstructs hypothesized family relationships between manuscripts based on shared variants, errors, and textual features.

**Outputs:**

- **Stemma (lineage trees)** — directed acyclic graphs showing hypothesized copying relationships. Multiple competing stemmata may exist for the same manuscript group.
- **Variant clustering** — grouping manuscripts into textual families based on shared variant profiles.
- **Relationship confidence scores** — each proposed relationship carries a confidence score based on the strength of the evidence.

**Critical principle:** lineage reconstructions are **hypotheses for scholarly investigation**, not assertions of fact. The platform presents them as such, always showing the evidence behind each proposed relationship and inviting scholarly critique.

```
                   [Autograph]*
                       │
              ┌────────┴────────┐
              ▼                 ▼
         [Family α]        [Family β]
          ├── MS-A            ├── MS-D
          ├── MS-B            └── MS-E
          └── MS-C

  * Hypothesized, not extant
  Confidence: α grouping 0.87, β grouping 0.72
  Method: Variant clustering + shared error analysis
```

### 5.4 Scalability

The manuscript architecture must support growth from hundreds of records (initial phase) to millions (long-term).

**Strategies:**

- **Database partitioning** — manuscript and passage tables can be partitioned by language, date range, or collection.
- **Knowledge graph indexing** — relationship tables use composite indexes and materialized views for common traversal patterns.
- **Processing pipeline independence** — heavy computation (OCR, variant detection, lineage reconstruction) runs outside the request/response cycle. Adding more manuscripts increases pipeline queue depth, not API latency.
- **Lazy loading** — the frontend loads manuscript data progressively. Catalog views show summaries; detail views load full records on demand.

---

## 6. Evidence Ledger

Every translation and research conclusion on CodexAtlas is backed by a complete evidence record.

**For each translation, the ledger stores:**

| Field | Description |
|---|---|
| `source_manuscripts` | List of manuscript witnesses consulted |
| `source_passages` | Specific passage references used |
| `translation_method` | Pipeline version and approach (e.g., "literal", "dynamic equivalence") |
| `ai_model` | Model identifier and version (e.g., "claude-3.5-sonnet-20241022") |
| `ai_prompt_version` | Version of the prompt template used |
| `confidence_score` | Model-reported confidence (0.0–1.0) |
| `evidence_score` | Composite score incorporating reviews, variant support, and consensus |
| `human_reviews` | All structured reviews submitted by scholars |
| `scholarly_disputes` | Flagged disagreements and their arguments |
| `version_history` | Complete chain of all previous versions |
| `revision_reasons` | Documented reason for each version change |
| `created_at` | Timestamp of creation |
| `created_by` | User or agent that produced the translation |

The Evidence Ledger makes CodexAtlas function as a **transparent scientific research ledger**. Any reader can trace any translation back to its source evidence, understand the methods used, see the scholarly conversation around it, and assess the strength of the conclusion independently.

---

## 7. Living Critical Edition

Traditional critical editions are fixed publications — a single editorial team produces a single text. CodexAtlas replaces this with a **living critical edition** that evolves as new evidence and scholarship emerge.

**For each passage, the platform presents:**

```
┌─────────────────────────────────────────────────────────┐
│ PASSAGE VIEW: Mark 1:1                                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ MANUSCRIPT VARIANTS          TRANSLATION VARIANTS        │
│ ┌─────────────────────┐     ┌──────────────────────┐    │
│ │ Sinaiticus (4th c.)  │     │ v3 (current)         │    │
│ │ Vaticanus  (4th c.)  │     │ v2 (superseded)      │    │
│ │ Bezae      (5th c.)  │     │ v1 (initial AI)      │    │
│ │ + 12 more witnesses  │     │                      │    │
│ └─────────────────────┘     └──────────────────────┘    │
│                                                          │
│ REVIEW HISTORY               EVIDENCE SCORE              │
│ ┌─────────────────────┐     ┌──────────────────────┐    │
│ │ 4 reviews submitted  │     │ Score: 0.82          │    │
│ │ 1 dispute active     │     │ Confidence: HIGH     │    │
│ │ Consensus: partial   │     │ Reviews: 4/5 agree   │    │
│ └─────────────────────┘     └──────────────────────┘    │
│                                                          │
│ HISTORICAL TIMELINE                                      │
│ ──●──────●──────●──────●──────●──────────────▶          │
│   v1     R1     R2     v2     R3,R4   v3                │
│   (AI)   (review)(review)(update)(reviews)(current)     │
│                                                          │
│ VERSION LINEAGE                                          │
│ v1 (AI initial) → v2 (revised after R1,R2) → v3 (curr) │
└─────────────────────────────────────────────────────────┘
```

- **Manuscript variants** — every known textual form, with links to the source manuscripts.
- **Translation variants** — every version of the translation, with diffs between versions.
- **Review history** — all scholarly reviews, structured as arguments with evidence citations.
- **Historical timeline** — a visual chronology of the translation's evolution.
- **Version lineage** — the causal chain from initial AI translation through reviews to current version.

---

## 8. Open Research Model

The research model is designed to be radically transparent and iterative.

### 8.1 AI Translation Publication

When a new passage is processed:

1. The Translation Pipeline produces an initial AI translation.
2. The translation is published **immediately** with clear transparency indicators:
   - `AI-GENERATED` label prominently displayed.
   - Confidence score visible.
   - Source manuscripts listed.
   - Translation method and AI model identified.
   - Full evidence ledger entry created.
3. The translation enters the review queue.

### 8.2 Transparency Indicators

Every translation displays its current status:

| Status | Meaning |
|---|---|
| `AI_INITIAL` | AI-generated, no human review yet |
| `UNDER_REVIEW` | Human reviews have been submitted |
| `DISPUTED` | Scholarly disagreement exists |
| `REVISED` | Updated based on review feedback |
| `SCHOLARLY_CONSENSUS` | Broad agreement among reviewers |

### 8.3 Structured Review Process

Human reviewers submit structured critiques, not free-form comments:

- **Assessment** — agree, disagree, or partially agree with the translation.
- **Evidence** — manuscript references, linguistic arguments, parallel texts cited.
- **Suggested revision** — alternative translation if disagreeing.
- **Confidence** — reviewer's self-assessed confidence in their critique.
- **Scope** — which specific words or phrases the review addresses.

### 8.4 Review Cluster Analysis

The Review Analysis Pipeline (AI-powered) examines the body of reviews for a translation and identifies:

- Areas of agreement.
- Points of dispute and the arguments on each side.
- Emerging consensus.
- Gaps in evidence that further review could address.

### 8.5 Translation Revision Cycle

If credible consensus emerges from reviews:

1. The system (or a scholar) proposes a new translation version.
2. The new version links to the reviews that motivated it.
3. The previous version remains visible with a `superseded` marker.
4. The evidence ledger is updated with the revision reason.

**All versions remain visible. Nothing is deleted.** A reader can always trace the complete history of how understanding of a passage evolved.

---

## 9. Scholarly Export and Reproducibility

Any analysis produced on CodexAtlas can be exported as a **research package** — a self-contained bundle that allows independent verification.

### 9.1 Research Package Contents

| Component | Description |
|---|---|
| Manuscripts used | Identifiers, provenance data, passage texts |
| Variant data | Full variant map for the passages analyzed |
| Translation pipeline version | Exact pipeline code version and configuration |
| AI model identifier | Model name, version, and prompt template |
| Review dataset | All reviews included in the analysis |
| Evidence score calculation | Formula, inputs, and intermediate values |
| Methodology notes | Any assumptions or limitations documented |

### 9.2 Export Formats

- **CSV** — tabular data (variant lists, review summaries, confidence scores) for spreadsheet analysis.
- **JSON** — structured data for programmatic consumption and integration with other tools.
- **TEI XML** — Text Encoding Initiative format, the scholarly standard for digital editions. Enables interoperability with other digital humanities projects.

### 9.3 Citation Identifiers

Every result on CodexAtlas has a **stable citation identifier** — a permanent URL and structured reference that can be used in academic publications. The identifier resolves to the specific version of the result at the time of citation, ensuring that cited evidence remains accessible even as the living edition evolves.

Format: `codexatlas.org/cite/{type}/{id}/v{version}`

---

## 10. AI Agent Organization

### 10.1 Development Organization (13 Agents)

These agents build, maintain, and improve the CodexAtlas platform itself.

| Agent | Responsibility |
|---|---|
| **Product Strategy** | Monitors the project roadmap, prioritizes features based on scholarly impact and user feedback, and ensures development effort aligns with the platform's mission of transparent, accessible manuscript research. |
| **UX Research** | Analyzes usage patterns across both the Research and Exploration surfaces, identifies friction points in scholar and public workflows, and proposes interface improvements grounded in observed behavior. |
| **Feature Proposal** | Translates research needs and UX findings into concrete feature specifications with acceptance criteria, data model implications, and pipeline requirements. |
| **Architecture Guardian** | Reviews all proposed changes for architectural consistency, ensures new features respect layer boundaries, and maintains the integrity of the append-only data model and evidence ledger. |
| **Development** | Implements features and fixes according to approved specifications. Writes code that adheres to project conventions, creates appropriate tests, and follows the development loop. |
| **Testing** | Designs and maintains the test suite across unit, integration, and end-to-end levels. Ensures critical paths — translation pipelines, evidence scoring, review submission — have comprehensive coverage. |
| **Security** | Audits RLS policies, authentication flows, API input validation, and storage access controls. Identifies vulnerabilities before they reach production. Reviews dependencies for known CVEs. |
| **Performance** | Monitors and optimizes load times, database query performance, pipeline throughput, and CDN cache hit rates. Ensures the platform meets its performance targets (LCP < 2.5s, API p95 < 500ms). |
| **Deployment** | Manages the CI/CD pipeline, Vercel configuration, database migrations, and rollback procedures. Ensures zero-downtime deployments and preview environment health. |
| **Documentation** | Maintains architecture documents, API references, onboarding guides, and agent task packet templates. Ensures documentation stays synchronized with the codebase. |
| **Technical Debt Monitor** | Tracks accumulated shortcuts, deprecated patterns, and growing complexity. Proposes refactoring work and prioritizes it against feature development based on maintenance cost projections. |
| **External Knowledge** | Monitors developments in relevant technologies (Next.js releases, Supabase features, AI model capabilities) and scholarly standards (TEI updates, IIIF protocols). Recommends adoptions that benefit the platform. |
| **Mission Integrity** | Ensures all platform development decisions serve the core mission: transparent, evidence-based, accessible manuscript research. Flags features or changes that could compromise scholarly integrity, introduce bias, or reduce transparency. |

### 10.2 Research Engine (9 Agents)

These agents perform the scholarly analysis work of the platform.

| Agent | Responsibility |
|---|---|
| **Discovery** | Monitors external sources (digital archives, academic databases, institutional catalogs) for newly available manuscript data. Proposes additions to the CodexAtlas collection with provenance documentation. |
| **OCR** | Processes manuscript images through optical character recognition pipelines. Handles multiple scripts (Greek, Hebrew, Aramaic, Latin, Syriac, Coptic). Outputs extracted text with per-character confidence maps. |
| **Translation** | Produces translations of manuscript texts with full evidence chains. Operates across multiple language pairs. Each translation includes confidence scores, source references, and methodology documentation. |
| **Variant Analysis** | Compares manuscript witnesses for shared passages. Detects, classifies, and catalogs textual variants. Produces variant maps with similarity metrics and difference annotations for the knowledge graph. |
| **Lineage Reconstruction** | Analyzes variant patterns and shared errors to propose manuscript family relationships. Produces stemma hypotheses with confidence scores. Explicitly frames outputs as hypotheses, not conclusions. |
| **Review Analysis** | Examines clusters of human reviews for patterns: consensus, dispute, evidence gaps. Synthesizes review data into structured assessments that inform translation revision decisions. |
| **Evidence Scoring** | Computes composite evidence scores for translations by combining AI confidence, review consensus, variant support, manuscript quality, and provenance strength into a single interpretable metric. |
| **Publication** | Prepares finalized translations and analyses for public presentation. Generates the living critical edition views, ensures all transparency indicators are correct, and validates evidence ledger completeness. |
| **Scholarly Export** | Assembles research packages on demand. Gathers all relevant data (manuscripts, variants, translations, reviews, scores), formats it in the requested export format (CSV, JSON, TEI XML), and generates citation identifiers. |

### 10.3 Task Packet System

All AI work — both development and research — is mediated by **task packets**.

A task packet is a structured document that provides an agent with everything it needs to perform a single unit of work, without requiring access to the full repository or broader system state.

**Task packet structure:**

```
┌─────────────────────────────────────────┐
│            TASK PACKET                   │
├─────────────────────────────────────────┤
│ task_id          — unique identifier     │
│ task_type        — category of work      │
│ description      — what needs to be done │
│ relevant_files   — specific file paths   │
│ relevant_docs    — architecture summaries│
│ constraints      — rules and boundaries  │
│ acceptance       — definition of done    │
│ cost_limit       — max token budget      │
│ autonomy_mode    — manual/hybrid/auto    │
│ context_summary  — compressed background │
│ parent_task      — link to parent if any │
│ output_format    — expected deliverable  │
└─────────────────────────────────────────┘
```

**Why task packets:**

- **Minimal context** — agents receive only what they need, reducing token consumption and hallucination risk.
- **Reproducibility** — a task packet fully specifies its inputs, making results reproducible.
- **Auditability** — every task packet and its result are logged, creating a complete record of all AI work.
- **Parallelism** — independent task packets can be processed concurrently by multiple agents.

### 10.4 Autonomy Modes

Agents operate under one of three autonomy modes, configurable per task type:

| Mode | Behavior | Use Case |
|---|---|---|
| **Manual** | Agent proposes a change or result. A human reviews and explicitly approves before it takes effect. | Translation revisions, architecture changes, security policy updates |
| **Hybrid** | Agent auto-applies minor, low-risk changes (formatting, typo fixes, documentation updates). Significant changes require human approval. | Development tasks, documentation, test maintenance |
| **Autonomous** | Agent implements within predefined limits without per-action approval. Limits include: file scope, token budget, allowed operations. | OCR processing, variant detection on new manuscripts, evidence score recalculation |

**Cost limits are enforced at all levels:**

- **Per-task** — each task packet specifies a maximum token budget.
- **Per-agent** — each agent has a daily token budget.
- **System-wide** — a monthly budget cap prevents runaway costs.
- **Alerting** — budget consumption is monitored, and alerts fire at 50%, 75%, and 90% thresholds.

---

## 11. Development Loop

All development work — whether performed by human developers or AI agents — follows a consistent loop:

```
    ┌──────────┐
    │ OBSERVE  │ ◄─── Monitor metrics, user feedback, error logs,
    └────┬─────┘      scholarly requests, tech developments
         │
    ┌────▼─────┐
    │ ANALYZE  │ ◄─── Identify root causes, assess impact,
    └────┬─────┘      evaluate priority against roadmap
         │
    ┌────▼─────┐
    │ PROPOSE  │ ◄─── Draft solution with specifications,
    └────┬─────┘      affected files, test plan, risk assessment
         │
    ┌────▼─────┐
    │ APPROVE  │ ◄─── Human review of proposal
    └────┬─────┘      (skipped for autonomous low-risk tasks)
         │
    ┌────▼─────┐
    │IMPLEMENT │ ◄─── Write code, update schemas,
    └────┬─────┘      modify pipelines, update docs
         │
    ┌────▼─────┐
    │  TEST    │ ◄─── Unit tests, integration tests,
    └────┬─────┘      pipeline validation, RLS verification
         │
    ┌────▼─────┐
    │ REVIEW   │ ◄─── Code review (human or AI),
    └────┬─────┘      architecture compliance check
         │
    ┌────▼─────┐
    │ DEPLOY   │ ◄─── CI/CD pipeline, preview → staging → production
    └────┬─────┘
         │
    ┌────▼─────┐
    │ MONITOR  │ ◄─── Verify deployment health, watch metrics,
    └────┬─────┘      confirm no regressions
         │
         └──────────── Loop back to OBSERVE
```

Each step in the loop is logged. For AI-driven work, the task packet captures the observe/analyze/propose phases; the implementation and test phases are captured in code changes and test results; the review and deploy phases are captured in CI/CD logs.

---

## 12. Integration Points

The system's layers communicate through well-defined integration points:

```
┌──────────┐     JWT auth      ┌──────────┐    API calls     ┌──────────┐
│ Supabase │ ◄───────────────▶ │ Frontend │ ◄──────────────▶ │   API    │
│   Auth   │                   │  (Next)  │                  │  Routes  │
└──────────┘                   └────┬─────┘                  └────┬─────┘
                                    │                             │
                          FCM push  │                    SQL/RLS  │
                                    │                             │
                               ┌────▼─────┐              ┌───────▼──────┐
                               │ Firebase │              │   Supabase   │
                               │   FCM    │              │   Database   │
                               └──────────┘              └───────┬──────┘
                                                                 │
                                                      ┌──────────┼──────────┐
                                                      ▼          ▼          ▼
                                                ┌──────────┐ ┌────────┐ ┌───────┐
                                                │ Pipelines│ │Storage │ │ Graph │
                                                │ (OCR,    │ │(Images,│ │Tables │
                                                │  Trans.) │ │ PDFs)  │ │       │
                                                └─────┬────┘ └────────┘ └───────┘
                                                      │
                                                      ▼
                                                ┌──────────┐
                                                │ AI Models│
                                                │ (Claude) │
                                                └──────────┘

                               ┌──────────┐    webhook     ┌──────────┐
                               │  GitHub  │ ◄────────────▶ │  Vercel  │
                               │   Repo   │   CI/CD        │ Hosting  │
                               └──────────┘                └──────────┘
```

**Integration details:**

| Connection | Protocol | Auth | Notes |
|---|---|---|---|
| Supabase Auth ↔ Frontend | HTTPS | OAuth/JWT | Frontend uses Supabase client library. Auth state managed client-side. |
| Frontend ↔ API Routes | HTTPS | Bearer JWT | Every protected API call includes the Supabase JWT in the Authorization header. |
| API Routes ↔ Supabase DB | TCP/SSL | Service role key | API routes use the Supabase service role for database operations. RLS still applies. |
| Pipelines ↔ Supabase DB | TCP/SSL | Service role key | Pipelines read inputs and write results directly to the database. |
| Pipelines ↔ Supabase Storage | HTTPS | Service role key | Pipelines read manuscript images and write generated assets. |
| Firebase FCM ↔ Frontend | HTTPS | FCM token | Service worker registers for push notifications and receives messages. |
| AI Models ↔ Pipelines | HTTPS | API key | Pipelines call Claude API with structured prompts and parse structured responses. |
| GitHub ↔ Vercel | Webhook | OAuth | Push to `main` triggers production build. PR creation triggers preview build. |

---

## 13. Scalability Strategy

The platform is designed to scale from a small research project to a global resource serving millions of users and millions of manuscript records.

### Postgres Partitioning

Large tables — `manuscripts`, `passages`, `variants`, `translations` — will be partitioned as they grow:

- **Range partitioning by date** for time-series data (reviews, pipeline runs, audit logs).
- **List partitioning by language/collection** for manuscript and passage tables, enabling queries scoped to a single tradition to scan only the relevant partition.

### CDN for Static and Manuscript Assets

- Manuscript images, generated PDFs, and static frontend assets are served through Supabase Storage's CDN layer.
- Incremental Static Regeneration pages (public manuscript views, translation pages) are cached at Vercel's edge network and revalidated on a configurable interval.
- Cache invalidation is triggered explicitly when underlying data changes.

### Edge Functions for Distributed Processing

- Lightweight, latency-sensitive operations (auth validation, search queries, notification dispatch) run as Vercel Edge Functions, executing at the nearest edge node to the user.
- Reduces round-trip latency for geographically distributed users.

### Queue-Based Pipeline Processing

- Heavy computation is queued, not synchronous. Adding 10,000 new manuscripts means 10,000 new queue items — the API remains responsive.
- Queue consumers scale horizontally. Multiple pipeline workers process items concurrently.
- Priority queues ensure scholar-initiated analyses complete before bulk background processing.

### Connection Pooling

- Supabase provides built-in connection pooling via PgBouncer.
- Prevents connection exhaustion under high concurrency from serverless function invocations.
- Transaction-mode pooling for short-lived API route connections; session-mode for long-lived pipeline connections.

### Incremental Static Regeneration

- Public manuscript and translation pages are statically generated at build time.
- ISR revalidates pages on-demand when underlying data changes, without requiring a full rebuild.
- Serves stale content instantly while regenerating in the background.
- Scales to millions of pages without proportional build time.

### Growth Projections

| Scale | Manuscripts | Users | Strategy |
|---|---|---|---|
| **Phase 1** (launch) | ~1,000 | ~100 | Single Supabase instance, basic CDN |
| **Phase 2** (growth) | ~100,000 | ~10,000 | Postgres partitioning, queue scaling, ISR |
| **Phase 3** (scale) | ~1,000,000+ | ~100,000+ | Read replicas, dedicated graph DB evaluation, multi-region CDN, horizontal pipeline scaling |

---

*This document is the primary technical reference for CodexAtlas. It is maintained by the Documentation agent and reviewed by the Architecture Guardian. Changes follow the standard development loop.*
