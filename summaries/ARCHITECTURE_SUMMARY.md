# CodexAtlas — Architecture Summary

> Compressed context for AI agents. Source of truth: `/docs/`

## Mission

Open-source AI-assisted research platform for ancient religious manuscripts.
Builder-first: build the content engine, fill the platform via AI agents, use it, share it organically.

## Current State

Phase 1 (MVP) complete. Phase 2 (Research Tools + Agent Engine) is next.

Working features: manuscript ingestion, passage creation, AI translation with evidence records, human reviews, variant comparison, transparency indicators, public read access.

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

## Phase 2 Priorities (Current Focus)

1. **Agent task system** — structured task execution with cost tracking
2. **Batch translation** — queue-based translation of all untranslated passages
3. **Manuscript discovery** — AI agent finds manuscripts from public digital archives
4. **OCR pipeline** — Claude vision extracts text from manuscript images
5. **Variant detection** — automated cross-manuscript comparison
6. **Advanced search** — full-text search across growing corpus
7. **Evidence explorer** — full chain navigation
8. **Scholarly export** — CSV, JSON, TEI XML
9. **Admin dashboard** — content stats, agent activity, cost monitoring
