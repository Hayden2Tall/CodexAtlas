# CodexAtlas

An open-source AI-assisted research platform for ancient religious manuscripts.

CodexAtlas discovers, analyzes, translates, compares, and publishes ancient religious manuscripts with radical transparency. Every AI translation, every confidence score, every piece of evidence is visible and traceable.

## Mission

Build an open research platform that serves two equally important purposes:

1. **Research Platform** — Professional tools for scholars and historians to analyze manuscripts, compare variants, trace lineage, and publish reproducible research.
2. **Knowledge Exploration** — Accessible tools for the public to explore ancient texts, understand translation evidence, and discover manuscript history.

## Core Principles

| Principle | Meaning |
|-----------|---------|
| Transparency over convenience | Every AI decision is explainable and auditable |
| Evidence over authority | Conclusions derive from manuscript evidence |
| Version history over overwriting | All data is append-only; nothing is deleted |
| Human review over hidden automation | AI assists; humans validate |
| Modularity over speed | Clean component boundaries; no coupling shortcuts |

## Current Status

**Phase 2: Research Tools + Agent Engine — Complete.** The full AI agent framework and research toolkit are operational. Manuscript discovery, OCR, batch translation, variant detection, advanced search, evidence explorer, and scholarly export (JSON, CSV, TEI XML) all work end-to-end. Six-step text source chain prioritizes manuscript-specific scholarly transcriptions over standard editions over AI. Comprehensive structured logging across all pipelines.

**Phase 3.1: Public Exploration Surface — Complete.** Scripture browser (`/read`) lets readers navigate by book and chapter across all manuscripts. Chapter reading view with clean serif layout, transparency indicators, and evidence chain links. Side-by-side manuscript comparison view. Dynamic landing page with live stats, featured manuscripts, and recent translations. Deep-link sharing with OG metadata. Public API endpoints for scripture browsing and platform statistics.

**Next: Phase 3.2 (Variant System Enhancement).** Variant versioning, cross-source comparison, and variant exploration UI. See [Roadmap](docs/ROADMAP.md) for details.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 15 (App Router, TypeScript, Tailwind CSS) |
| Hosting | Vercel |
| Database | Supabase (PostgreSQL with Row-Level Security) |
| Storage | Supabase Storage |
| Auth | Supabase Auth (email, Google OAuth, GitHub OAuth) |
| Notifications | Firebase Cloud Messaging |
| AI Models | Claude (Anthropic) |

## Repository Structure

```
CodexAtlas/
├── app/                 # Next.js application
│   ├── public/          #   Static assets and PWA icons
│   └── src/
│       ├── app/         #   Pages and API routes (App Router)
│       ├── components/  #   Shared UI components
│       └── lib/         #   Supabase clients, types, utilities
├── docs/                # Project documentation
├── scripts/
│   ├── migrations/      # SQL migration files (001-023)
│   ├── preprocess-sinaiticus.mjs  # One-time Sinaiticus XML preprocessing
│   └── preprocess-dss.mjs        # One-time Dead Sea Scrolls preprocessing
├── agents/              # Agent definitions and registry
├── prompts/             # Agent task templates
├── summaries/           # Compressed architecture summaries for agents
├── .gitignore
├── LICENSE              # MIT License
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Hayden2Tall/CodexAtlas.git
   cd CodexAtlas
   ```

2. Install dependencies:
   ```bash
   cd app
   npm install
   ```

3. Create your environment file:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase URL, anon key, service role key, and Anthropic API key.

4. Run the database migrations:
   Execute each SQL file in `scripts/migrations/` (001 through 023) in order via the Supabase SQL Editor.

5. Start the dev server:
   ```bash
   npm run dev
   ```

6. Open http://localhost:3000

### First-time Setup

After signing up, promote yourself to admin in the Supabase Table Editor:
- Go to the `users` table
- Change your `role` from `reader` to `admin`

## Documentation

| Document | Purpose |
|----------|---------|
| [Project Constitution](docs/PROJECT_CONSTITUTION.md) | Governing rules and principles |
| [Master Plan](docs/MASTER_PLAN.md) | System architecture and technical design |
| [Product Strategy](docs/PRODUCT_STRATEGY.md) | Product vision and user strategy |
| [Roadmap](docs/ROADMAP.md) | Phased development plan |
| [Data Model](docs/DATA_MODEL.md) | Database schema and entity design |
| [Security Model](docs/SECURITY_MODEL.md) | Security architecture |
| [UX Guidelines](docs/UX_GUIDELINES.md) | Design system and patterns |
| [Development Log](docs/DEVELOPMENT_LOG.md) | Architectural decision log |

## Contributing

CodexAtlas is open source. Contributions are welcome via pull requests.

1. Fork the repository
2. Create a feature branch
3. Follow the [Project Constitution](docs/PROJECT_CONSTITUTION.md)
4. Submit a pull request

All changes must comply with the Project Constitution and be reviewed by maintainers.

## License

MIT License — see [LICENSE](LICENSE) for details.
