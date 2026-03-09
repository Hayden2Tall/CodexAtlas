# CodexAtlas — Agent Protocol Summary

> Compressed context for AI agents operating within CodexAtlas. Source of truth: `/docs/`

## Task Packet Format

Every agent receives a structured task packet:

```json
{
  "task_description": "What the agent should do",
  "relevant_files": ["paths/to/files/needed"],
  "doc_summaries": ["summaries/ARCHITECTURE_SUMMARY.md", "..."],
  "architecture_constraints": ["no hard deletes", "evidence required", "..."]
}
```

Agents must not reach beyond the files and summaries provided unless explicitly permitted.

## Context Rules

- **Never load the entire repo** — use summaries, not full docs
- **Review agents** use git diffs, not full file contents
- **Request only what you need** — minimize token consumption
- **Summaries directory** (`/summaries/`) is the primary context source for agents
- **Full docs** (`/docs/`) only when summaries are insufficient

## Autonomy Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Manual** | Propose changes → wait for human approval | Architecture changes, data model, security |
| **Hybrid** | Auto-fix minor issues, propose for significant changes | Bug fixes, formatting, test additions |
| **Autonomous** | Implement within defined limits, log all actions | Linting, docs updates, routine analysis |

Default mode is **Manual** unless the task packet specifies otherwise.

## Cost Controls

- **Per-agent limits**: Max tokens per invocation (defined in agent config)
- **Per-session caps**: Total token budget across all agents in a session
- **Estimate before executing**: Agents should estimate token cost before large operations
- **Log all API calls**: Every AI API call logged with tokens used, cost, and purpose

## Agent Types — Development

| Agent | Responsibility |
|-------|---------------|
| Product Strategy | Roadmap alignment, feature prioritization |
| UX Research | User needs, accessibility, interface patterns |
| Feature Proposal | Spec drafting, requirements gathering |
| Architecture Guardian | Structural integrity, dependency review |
| Development | Code implementation within constraints |
| Testing | Test creation, coverage analysis |
| Security | Vulnerability scanning, auth review |
| Performance | Optimization, profiling, caching |
| Deployment | CI/CD, release management |
| Documentation | Docs generation, summary updates |
| Technical Debt Monitor | Debt tracking, refactor proposals |
| External Knowledge | Library updates, ecosystem awareness |
| Mission Integrity | Ensures adherence to core principles |

## Agent Types — Research

| Agent | Responsibility |
|-------|---------------|
| Discovery | Find and catalog new manuscript sources |
| OCR | Process manuscript images into text |
| Translation | Generate and version translations with evidence |
| Variant Analysis | Identify and compare textual variants |
| Lineage Reconstruction | Build stemmatic relationships |
| Review Analysis | Aggregate and synthesize reviews |
| Evidence Scoring | Score and validate evidence records |
| Publication | Prepare content for public exploration surface |
| Scholarly Export | Generate academic-format exports (PDF, TEI, etc.) |

## Constitution Compliance

All agents must adhere to these inviolable rules:

- **No hard deletes** — soft delete via `archived_at` only
- **Evidence required** — translations without evidence records are rejected
- **Transparency mandatory** — all actions logged, all reasoning visible
- **Human gating** — agents propose, humans approve (unless Autonomous mode)
- **Core principles** — never violate the five core principles (see ARCHITECTURE_SUMMARY)

## Action Logging

Every agent action is recorded in `audit_log`:

| Field | Value |
|-------|-------|
| `actor_type` | `'agent'` |
| `actor_id` | Agent's scoped token ID |
| `action` | Description of what was done |
| `target_table` | Table affected (if applicable) |
| `target_id` | Row affected (if applicable) |
| `diff` | JSON diff of changes |
| `timestamp` | UTC timestamp |

Agents that fail to log actions are considered non-compliant and will be terminated.
