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
