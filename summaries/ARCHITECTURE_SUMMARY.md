# CodexAtlas — Architecture Summary

> Compressed context for AI agents. Source of truth: `/docs/`

## Mission

Open-source AI-assisted research platform for ancient religious manuscripts.
Builder-first: build the content engine, fill the platform via AI agents, use it, share it organically.

## Current State

Phase 2 (Research Tools + Agent Engine) complete. Actively populating content. Phase 3 (Polish + Scale) when ready.

Working features: manuscript discovery, full manuscript import (TOC → iterative section import), AI translation (single + batch), OCR pipeline, automated variant detection, advanced search, evidence explorer, scholarly export (JSON/CSV/TEI XML), admin dashboard with cost tracking, passage editing/deletion, human reviews, public read access.

## Core Principles

- **Transparency over convenience** — every decision visible and traceable
- **Evidence over authority** — claims require sourced evidence records
- **Version history over overwriting** — append-only, nothing destroyed
- **Human review over hidden automation** — AI proposes, humans validate
- **Content depth over user breadth** — fill the platform first, grow audience later

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 15 (PWA) | Deployed on Vercel |
| Database | Supabase Postgres | RLS on all tables, public read access |
| Auth | Supabase Auth | Email/password, Google OAuth, GitHub OAuth |
| Storage | Supabase Storage | Manuscript images, exports |
| AI | Claude (Anthropic) | Translation, OCR, discovery, analysis |
| Notifications | Firebase | Push notifications (deferred to Phase 3) |

## Architecture Layers

1. **Frontend** — Next.js PWA (App Router, TypeScript, Tailwind CSS)
2. **API** — Next.js API routes (server-side, Supabase service role for agents)
3. **Database** — Supabase Postgres, append-only, RLS enforced on every table
4. **Storage** — Supabase Storage for manuscript images and exports
5. **Knowledge Graph** — Relationship tables in Postgres (lineage, variants, cross-refs)
6. **Processing Pipelines** — Agent-driven (batch translation, OCR, variant detection)
7. **AI Agents** — Task packets with cost tracking, scoped permissions, audit logging

## Repository Structure

```
/app          → Next.js application (pages, components, API routes, lib)
/agents       → Agent definitions and registry
/prompts      → AI task templates and prompt definitions
/summaries    → Compressed summaries (this directory)
/docs         → Full documentation and governance
/scripts      → Database migrations and utility scripts
```

## Key Constraints

- **No hard deletes** — all records soft-deleted via `archived_at`
- **Evidence required** — every translation must have an evidence record
- **Append-only data** — version numbers increase monotonically, history preserved
- **RLS on all tables** — public SELECT policies for research data, auth-gated writes
- **Cost controls** — per-task token limits, session caps, all AI calls logged
- **Audit trail** — every mutation logged in `audit_log`
- **Published by default** — translations are immediately visible with transparency indicators

## AI Model Strategy

| Task | Model | Rationale |
|------|-------|-----------|
| Text import / recall | Claude Haiku 4.5 | Fast, cheap — recall task, not reasoning |
| Translation | Claude Sonnet 4 | Needs scholarly reasoning and nuance |
| Discovery / TOC | Claude Sonnet 4 | Needs research knowledge |
| OCR | Claude Sonnet 4 | Needs vision + script recognition |
| Variant detection | Claude Sonnet 4 | Needs textual criticism reasoning |

All AI endpoints use 50s AbortControllers (under Vercel's 60s limit). Client-side orchestration handles batch workflows with retry, pause/cancel, and per-item progress tracking.

## Current Focus: Content Population

Use the working agent pipeline to fill the platform with manuscripts and translations:
1. Discover manuscripts → add to library
2. Full import (TOC scan → select sections → import text)
3. Batch translate imported passages
4. Detect variants across manuscripts
5. Review, validate, and share
