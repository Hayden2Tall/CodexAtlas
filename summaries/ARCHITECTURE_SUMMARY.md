# CodexAtlas — Architecture Summary

> Compressed context for AI agents. Source of truth: `/docs/`

## Mission

Open-source AI-assisted research platform for ancient religious manuscripts.
Two audiences: **scholars** (deep research tools) and **public** (accessible exploration).

## Core Principles

- **Transparency over convenience** — every decision visible and traceable
- **Evidence over authority** — claims require sourced evidence records
- **Version history over overwriting** — append-only, nothing destroyed
- **Human review over hidden automation** — AI proposes, humans approve
- **Modularity over speed** — decoupled components, clear boundaries

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js (PWA) | Deployed on Vercel |
| Database | Supabase Postgres | RLS on all tables |
| Auth | Supabase Auth | Email/password, OAuth, magic link |
| Storage | Supabase Storage | Manuscript images, exports |
| AI | Claude (Anthropic) | Task-packet architecture |
| Notifications | Firebase | Push notifications only |

## Architecture Layers

1. **Frontend** — Next.js PWA with two surfaces:
   - *Research Surface*: scholar tools (translation, variant analysis, lineage)
   - *Exploration Surface*: public-facing discovery and reading
2. **API** — Next.js API routes (server-side, Supabase service role)
3. **Database** — Supabase Postgres, append-only, RLS enforced on every table
4. **Storage** — Supabase Storage for images, PDFs, exports
5. **Knowledge Graph** — Relationship tables in Postgres (lineage, variants, cross-refs)
6. **Processing Pipelines** — Decoupled, queue-based (OCR, analysis, scoring)
7. **AI Agents** — Task packets with minimal context, scoped permissions
8. **Notifications** — Firebase Cloud Messaging

## Repository Structure

```
/app          → Frontend (Next.js pages, components, hooks)
/agents       → Agent definitions and configurations
/pipelines    → Analysis and processing pipelines
/services     → Backend services and utilities
/data         → Research data and seed files
/prompts      → AI task templates and prompt definitions
/summaries    → Compressed summaries (this directory)
/docs         → Full documentation and governance
/tests        → Test suites
/scripts      → Build, deploy, and utility scripts
/public       → Static assets
```

## Key Constraints

- **No hard deletes** — all records soft-deleted via `archived_at`
- **Evidence required** — every translation must have an evidence record
- **Append-only data** — version numbers monotonically increase, history preserved
- **RLS on all tables** — no table accessible without policy
- **Cost controls** — per-agent token limits, per-session caps, all AI calls logged
- **Audit trail** — every mutation logged in `audit_log`

## Development Loop

```
observe → analyze → propose → approve → implement → test → review → deploy → monitor
```

Each stage is explicit. AI agents participate in `analyze`, `propose`, and `implement` but humans gate `approve` and `review`.
