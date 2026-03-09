# Agent Registry

Central registry of all CodexAtlas AI agents. Each agent operates within the boundaries defined by the [Project Constitution](../docs/PROJECT_CONSTITUTION.md) and receives context through [Task Packets](../prompts/TASK_PACKET_TEMPLATE.md).

---

## Development Organization Agents

### 1. Product Strategy Agent

| Field | Value |
|-------|-------|
| **Category** | Development Organization |
| **Responsibility** | Translates project mission into prioritized features and milestones. Maintains the product roadmap and ensures development effort aligns with user needs and the project constitution. |
| **Autonomy Default** | manual |
| **Required Summaries** | `summaries/product-strategy.md`, `summaries/roadmap.md` |

### 2. UX Research Agent

| Field | Value |
|-------|-------|
| **Category** | Development Organization |
| **Responsibility** | Defines user personas, maps user journeys, and identifies usability issues. Produces design recommendations grounded in research for both scholars and public users. |
| **Autonomy Default** | manual |
| **Required Summaries** | `summaries/ux-guidelines.md`, `summaries/product-strategy.md` |

### 3. Feature Proposal Agent

| Field | Value |
|-------|-------|
| **Category** | Development Organization |
| **Responsibility** | Drafts detailed feature specifications from product strategy inputs. Produces scoped proposals with acceptance criteria, data requirements, and UI sketches for review. |
| **Autonomy Default** | manual |
| **Required Summaries** | `summaries/product-strategy.md`, `summaries/data-model.md`, `summaries/ux-guidelines.md` |

### 4. Architecture Guardian Agent

| Field | Value |
|-------|-------|
| **Category** | Development Organization |
| **Responsibility** | Reviews all code changes and architectural decisions against the project constitution and master plan. Blocks changes that violate modularity, transparency, or append-only principles. |
| **Autonomy Default** | hybrid |
| **Required Summaries** | `summaries/master-plan.md`, `summaries/project-constitution.md`, `summaries/data-model.md` |

### 5. Development Agent

| Field | Value |
|-------|-------|
| **Category** | Development Organization |
| **Responsibility** | Implements features, fixes bugs, and writes application code. Operates strictly within the scope of assigned task packets and follows architecture guidelines. |
| **Autonomy Default** | hybrid |
| **Required Summaries** | `summaries/master-plan.md`, `summaries/data-model.md` |

### 6. Testing Agent

| Field | Value |
|-------|-------|
| **Category** | Development Organization |
| **Responsibility** | Writes and maintains unit, integration, and end-to-end tests. Validates that features meet acceptance criteria and that regressions are caught before merge. |
| **Autonomy Default** | hybrid |
| **Required Summaries** | `summaries/master-plan.md`, `summaries/data-model.md` |

### 7. Security Agent

| Field | Value |
|-------|-------|
| **Category** | Development Organization |
| **Responsibility** | Audits code and infrastructure for security vulnerabilities. Enforces the security model, reviews authentication and authorization flows, and validates data access policies. |
| **Autonomy Default** | manual |
| **Required Summaries** | `summaries/security-model.md`, `summaries/master-plan.md` |

### 8. Performance Agent

| Field | Value |
|-------|-------|
| **Category** | Development Organization |
| **Responsibility** | Profiles application performance, identifies bottlenecks, and recommends optimizations. Monitors bundle size, query performance, and rendering efficiency. |
| **Autonomy Default** | hybrid |
| **Required Summaries** | `summaries/master-plan.md` |

### 9. Deployment Agent

| Field | Value |
|-------|-------|
| **Category** | Development Organization |
| **Responsibility** | Manages CI/CD pipelines, Vercel deployments, and environment configuration. Ensures builds are reproducible and deployments follow the defined release process. |
| **Autonomy Default** | hybrid |
| **Required Summaries** | `summaries/master-plan.md`, `summaries/security-model.md` |

### 10. Documentation Agent

| Field | Value |
|-------|-------|
| **Category** | Development Organization |
| **Responsibility** | Maintains project documentation, API references, and developer guides. Keeps all `/docs` files accurate and synchronized with the current state of the codebase. |
| **Autonomy Default** | autonomous |
| **Required Summaries** | `summaries/master-plan.md`, `summaries/project-constitution.md` |

### 11. Technical Debt Monitor Agent

| Field | Value |
|-------|-------|
| **Category** | Development Organization |
| **Responsibility** | Tracks accumulating technical debt, flags code quality regressions, and proposes refactoring tasks. Maintains a prioritized debt backlog aligned with the roadmap. |
| **Autonomy Default** | autonomous |
| **Required Summaries** | `summaries/master-plan.md`, `summaries/roadmap.md` |

### 12. External Knowledge Agent

| Field | Value |
|-------|-------|
| **Category** | Development Organization |
| **Responsibility** | Researches external libraries, APIs, and best practices relevant to development tasks. Provides vetted recommendations with compatibility and licensing analysis. |
| **Autonomy Default** | autonomous |
| **Required Summaries** | `summaries/master-plan.md` |

### 13. Mission Integrity Agent

| Field | Value |
|-------|-------|
| **Category** | Development Organization |
| **Responsibility** | Monitors all project activity for alignment with the core mission and principles. Flags scope creep, principle violations, and decisions that compromise transparency or evidence-based operation. |
| **Autonomy Default** | autonomous |
| **Required Summaries** | `summaries/project-constitution.md`, `summaries/product-strategy.md` |

---

## Research Engine Agents

### 14. Discovery Agent

| Field | Value |
|-------|-------|
| **Category** | Research Engine |
| **Responsibility** | Searches digital archives, library catalogs, and academic databases to locate manuscript references. Produces structured discovery records with provenance metadata and confidence scores. |
| **Autonomy Default** | autonomous |
| **Required Summaries** | `summaries/data-model.md` |

### 15. OCR Agent

| Field | Value |
|-------|-------|
| **Category** | Research Engine |
| **Responsibility** | Processes manuscript images through optical character recognition pipelines. Extracts text with per-character confidence scores and maps results to the manuscript coordinate system. |
| **Autonomy Default** | autonomous |
| **Required Summaries** | `summaries/data-model.md`, `summaries/master-plan.md` |

### 16. Translation Agent

| Field | Value |
|-------|-------|
| **Category** | Research Engine |
| **Responsibility** | Translates extracted manuscript text using Claude AI with full transparency. Produces translations with word-level confidence scores, alternative readings, and explanatory notes for every decision. |
| **Autonomy Default** | hybrid |
| **Required Summaries** | `summaries/data-model.md`, `summaries/master-plan.md` |

### 17. Variant Analysis Agent

| Field | Value |
|-------|-------|
| **Category** | Research Engine |
| **Responsibility** | Compares multiple manuscript witnesses to identify textual variants. Produces critical apparatus entries with categorized differences and statistical significance measures. |
| **Autonomy Default** | hybrid |
| **Required Summaries** | `summaries/data-model.md` |

### 18. Lineage Reconstruction Agent

| Field | Value |
|-------|-------|
| **Category** | Research Engine |
| **Responsibility** | Analyzes variant patterns across manuscript families to reconstruct copying relationships and stemmatic trees. Produces lineage hypotheses with supporting evidence chains. |
| **Autonomy Default** | hybrid |
| **Required Summaries** | `summaries/data-model.md` |

### 19. Review Analysis Agent

| Field | Value |
|-------|-------|
| **Category** | Research Engine |
| **Responsibility** | Synthesizes scholarly literature and commentary related to specific manuscripts or passages. Aggregates expert opinions and maps consensus and disagreement across the academic record. |
| **Autonomy Default** | hybrid |
| **Required Summaries** | `summaries/data-model.md` |

### 20. Evidence Scoring Agent

| Field | Value |
|-------|-------|
| **Category** | Research Engine |
| **Responsibility** | Assigns and calibrates confidence scores across all research outputs. Combines OCR confidence, translation certainty, variant frequency, and scholarly consensus into unified evidence ratings. |
| **Autonomy Default** | autonomous |
| **Required Summaries** | `summaries/data-model.md`, `summaries/master-plan.md` |

### 21. Publication Agent

| Field | Value |
|-------|-------|
| **Category** | Research Engine |
| **Responsibility** | Assembles reviewed research into publishable formats for the platform. Generates manuscript pages, comparison views, and evidence trails that meet the transparency standards of the constitution. |
| **Autonomy Default** | hybrid |
| **Required Summaries** | `summaries/data-model.md`, `summaries/ux-guidelines.md`, `summaries/project-constitution.md` |

### 22. Scholarly Export Agent

| Field | Value |
|-------|-------|
| **Category** | Research Engine |
| **Responsibility** | Exports research data into standard academic formats (TEI-XML, critical edition PDFs, BibTeX). Ensures exported artifacts are citation-ready and comply with digital humanities interchange standards. |
| **Autonomy Default** | autonomous |
| **Required Summaries** | `summaries/data-model.md` |

---

## Autonomy Levels

| Level | Description |
|-------|-------------|
| **manual** | Agent produces recommendations only; a human must approve and execute all changes. |
| **hybrid** | Agent may execute low-risk changes autonomously but must request human approval for structural or high-impact changes. |
| **autonomous** | Agent may execute within its defined scope without per-action approval, subject to post-hoc review and constitutional constraints. |
