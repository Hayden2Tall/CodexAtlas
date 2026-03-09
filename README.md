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

## Tech Stack

- **Frontend:** Next.js Progressive Web App
- **Hosting:** Vercel
- **Database:** Supabase (Postgres)
- **Storage:** Supabase Storage
- **Notifications:** Firebase Cloud Messaging
- **AI Models:** Claude (Anthropic)

## Repository Structure

```
CodexAtlas/
├── agents/              # Agent definitions and registry
├── app/                 # Next.js application source
├── data/                # Seed data and fixtures
├── docs/                # Project documentation
├── pipelines/           # AI processing pipelines
├── prompts/             # Agent task templates and prompts
├── public/              # Static assets
├── scripts/             # Build and utility scripts
├── services/            # Backend service modules
├── summaries/           # Compressed architecture summaries for agents
├── tests/               # Test suites
├── .gitignore           # Git ignore rules
├── LICENSE              # MIT License
└── README.md            # This file
```

## Documentation

All project documentation lives in `/docs`:

- [Project Constitution](docs/PROJECT_CONSTITUTION.md) — Governing rules and principles
- [Master Plan](docs/MASTER_PLAN.md) — System architecture and technical design
- [Product Strategy](docs/PRODUCT_STRATEGY.md) — Product vision and user strategy
- [Roadmap](docs/ROADMAP.md) — Phased development plan
- [Data Model](docs/DATA_MODEL.md) — Database schema and entity design
- [Security Model](docs/SECURITY_MODEL.md) — Security architecture
- [UX Guidelines](docs/UX_GUIDELINES.md) — Design system and patterns
- [Development Log](docs/DEVELOPMENT_LOG.md) — Architectural decision log

## Getting Started

> **Placeholder** — to be filled in Phase 1.

Prerequisites, setup instructions, and development commands will be added when the application is initialized.

## Contributing

CodexAtlas is open source. Contributions are welcome via pull requests.

1. Fork the repository
2. Create a feature branch
3. Follow the [Project Constitution](docs/PROJECT_CONSTITUTION.md)
4. Submit a pull request

All changes must comply with the Project Constitution and be reviewed by maintainers.

## License

MIT License — see [LICENSE](LICENSE) for details.

## Status

**Phase 0: Foundation** — Documentation and architecture complete. Application development begins in Phase 1.
