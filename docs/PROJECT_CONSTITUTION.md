# CodexAtlas Project Constitution

**Version:** 1.0  
**Effective Date:** March 9, 2026  
**Status:** Ratified  
**Authority:** This document is the supreme governing instrument of the CodexAtlas project. All agents, contributors, systems, and processes are bound by its provisions. In the event of conflict between this constitution and any other project document, this constitution prevails.

---

## 1. PREAMBLE

CodexAtlas exists to make ancient manuscript research transparent, accessible, and evidence-based. The world's ancient religious manuscripts — their texts, variants, lineages, and translations — belong to all of humanity. The tools used to study them must be open, auditable, and free from opaque decision-making.

This constitution governs all development activity, AI agent behavior, and community contributions within the CodexAtlas project. No code shall be merged, no agent shall act, and no architectural decision shall be made that contradicts the provisions set forth herein.

Every participant — human or artificial — operates under the authority of this document.

---

## 2. MISSION

The mission of CodexAtlas is threefold:

1. **Build an open-source, AI-assisted research platform** for the discovery, analysis, translation, comparison, and publication of ancient religious manuscripts.

2. **Serve two audiences with equal commitment:**
   - **Scholars** receive professional-grade research tools: critical apparatus generation, variant analysis, lineage reconstruction, collaborative review, and peer-quality export.
   - **The public** receives accessible exploration tools: readable translations, visual manuscript comparisons, guided discovery, and plain-language explanations of scholarly conclusions.

3. **Expose the evidence and reasoning behind every translation and conclusion.** No result shall be presented without its supporting evidence chain. No AI output shall be opaque. Every translation, analysis, and conclusion must be traceable to its source manuscripts, methods, and decision points. Nothing is hidden.

---

## 3. CORE PRINCIPLES

These principles are the foundation of the project. They are ordered by priority. When principles conflict, the higher-numbered principle yields to the lower-numbered one.

### Principle 1: Transparency Over Convenience

Every AI decision, translation, and analysis must be explainable and auditable. If a system cannot explain why it produced a result, that result shall not be published. Convenience — faster pipelines, simpler interfaces, fewer steps — must never come at the cost of traceability. Users, reviewers, and scholars must be able to inspect the full reasoning chain behind any output at any time.

### Principle 2: Evidence Over Authority

Conclusions derive from manuscript evidence, not from reputation, tradition, or assertion. The platform shall not privilege any translation, interpretation, or scholarly position based on the identity or credentials of its author. All claims are evaluated on the strength of their evidence. The evidence record must be complete, accessible, and independently verifiable.

### Principle 3: Version History Over Overwriting

All data is append-only. Nothing is deleted. Every version of every record is preserved. Corrections are made by appending new versions, not by mutating or destroying prior versions. The full history of any translation, analysis, or conclusion must be reconstructable from the data store. This principle applies to manuscript data, translations, research conclusions, agent actions, and system configurations.

### Principle 4: Human Review Over Hidden Automation

AI assists; humans validate. No AI-generated output shall be published or treated as authoritative without human review, except where explicitly permitted by the autonomy mode in effect (see Section 6). All automation must be visible — users must be able to see what was automated, when, and by which agent. Hidden automation is prohibited.

### Principle 5: Modularity Over Speed

Clean boundaries between components take priority over speed of delivery. No implementation shortcut that creates coupling between independent components is permitted. Every module, service, pipeline, and agent must be independently deployable, testable, and replaceable. Coupling is technical debt; modularity is structural integrity.

### Principle 6: Agent Constitutional Compliance

Agents must never propose, implement, approve, or deploy changes that violate any principle in this section. An agent that detects a constitutional violation must halt execution and flag the violation for human review. This principle is self-enforcing: it applies to the agent's own behavior, including its interpretation of task packets.

---

## 4. ARCHITECTURE RULES

The following architectural constraints are binding. Deviations require a constitutional amendment (see Section 12).

### 4.1 Technology Stack

| Layer | Technology | Deployment |
|---|---|---|
| Frontend | Next.js (Progressive Web App) | Vercel |
| Backend | Next.js API Routes | Vercel |
| Database | Supabase (PostgreSQL) with Row-Level Security | Supabase Cloud |
| File Storage | Supabase Storage | Supabase Cloud |
| Notifications | Firebase Cloud Messaging | Google Cloud |
| Primary AI Model | Anthropic Claude | API |

### 4.2 Structural Constraints

1. **Independent testability.** Every component — frontend pages, API routes, database functions, pipelines, and agents — must be independently testable with no dependency on the running state of other components.

2. **Knowledge graph layer.** Manuscript relationships (textual dependencies, variant lineages, source-derivative chains, cross-references) must be represented in a dedicated knowledge graph layer. This layer must be queryable independently of the primary relational database.

3. **Decoupled processing pipelines.** OCR, translation, variant analysis, lineage reconstruction, and all other research processing pipelines must be decoupled from the application layer. Pipelines communicate with the application exclusively through defined interfaces (queues, APIs, or event streams). No pipeline may directly access application state.

4. **Horizontal scalability.** Every layer of the system must be horizontally scalable. No component may introduce a singleton bottleneck, a shared mutable resource without concurrency controls, or an architecture that prevents adding additional instances under load.

---

## 5. DATA INTEGRITY RULES

Data integrity is non-negotiable. These rules have the same authority as the Core Principles.

### 5.1 No Deletion

No record may be physically deleted from the database. All removals must be implemented as soft-deletes with a complete audit trail recording: the actor (human or agent), the timestamp, the reason, and the prior state of the record.

### 5.2 Translation Metadata Requirements

Every translation stored in the system must carry the following metadata, without exception:

- **Confidence score** — a numerical assessment of translation reliability
- **Source manuscripts** — identifiers of all manuscripts used as input
- **Translation method** — the approach employed (e.g., direct translation, comparative, AI-assisted)
- **AI model used** — the specific model and version, if AI was involved
- **Version history** — a complete, ordered record of all prior versions of this translation
- **Review history** — a record of all human and agent reviews, including reviewer identity, timestamp, verdict, and comments

A translation missing any of these fields must not be published or presented to users as a completed result.

### 5.3 Evidence Records

Every research conclusion (variant analysis result, lineage hypothesis, textual dependency claim, dating estimate, or any other scholarly assertion) must have a complete evidence record. The evidence record must contain: the source data, the analytical method, the confidence assessment, and the chain of reasoning from source to conclusion. Conclusions without complete evidence records are draft-only and must be labeled as such.

### 5.4 Version Preservation

All versions of all records must be preserved and accessible. No version may be made inaccessible, hidden, or archived in a way that prevents retrieval. Version histories must be queryable through the API.

### 5.5 Stable Citation Identifiers

All published results (translations, analyses, conclusions, manuscript records) must receive stable citation identifiers upon publication. These identifiers must never change, must resolve to the correct version, and must follow an established citation standard. Breaking a citation identifier is a constitutional violation.

---

## 6. AGENT BEHAVIOR RULES

All AI agents operating within CodexAtlas are bound by the following rules.

### 6.1 Task Packet Protocol

Agents operate using **task packets**. A task packet is a structured bundle containing:

- **Task description** — a precise statement of what the agent must accomplish
- **Relevant files** — only the files necessary for the task (not the full repository)
- **Relevant documentation summaries** — compressed summaries of applicable architectural and design documents
- **Architecture constraints** — the subset of this constitution and related rules that apply to the task

An agent must not begin work without a well-formed task packet. An agent must not access files or resources not included in or referenced by its task packet without explicit authorization.

### 6.2 Minimal Context Loading

Agents must never load the entire repository into context. Agents must operate on the minimum context necessary to complete their task. Compressed architecture summaries must be used in place of full documentation whenever possible. Violation of this rule wastes resources and is grounds for agent session termination.

### 6.3 Review Protocol

Review agents must analyze Git diffs, not entire repositories. Code review must be scoped to the changeset under review plus the minimal surrounding context required for comprehension. Whole-repository review passes are prohibited unless explicitly authorized by a maintainer.

### 6.4 Autonomy Modes

Every agent operates in one of three autonomy modes. The mode in effect determines the agent's authority to act without human approval.

| Mode | Behavior | Approval Required |
|---|---|---|
| **Manual** | Agent proposes changes and waits for explicit human approval before any implementation. | All actions require approval. |
| **Hybrid** | Agent may autonomously fix minor issues (formatting, lint errors, typos, trivial test failures). All substantive changes require human approval. | Substantive changes require approval. |
| **Autonomous** | Agent implements changes within predefined limits (scope, file count, complexity). Changes exceeding limits require human approval. | Only out-of-bounds changes require approval. |

The default mode is **Manual**. Mode escalation requires explicit human authorization.

### 6.5 Cost Limits

Cost limits must be enforceable per agent and per session. No agent may exceed its allocated cost limit. When a limit is approached, the agent must pause and request authorization to continue. See Section 9 for detailed cost control policies.

### 6.6 Action Logging

Agents must log all actions taken, including: files read, files modified, API calls made, AI model invocations, decisions made, and reasons for those decisions. Agent logs must be retained and must be queryable for audit purposes.

### 6.7 Development Organization Agents

The following agents govern the development lifecycle of CodexAtlas:

| Agent | Responsibility |
|---|---|
| **Product Strategy** | Defines product direction, prioritizes features, aligns development with the mission. |
| **UX Research** | Conducts user research, defines personas, validates interface decisions with evidence. |
| **Feature Proposal** | Drafts feature specifications, ensures completeness, validates against architecture constraints. |
| **Architecture Guardian** | Enforces architectural rules, reviews structural changes, prevents coupling and drift. |
| **Development** | Implements features, writes code, follows task packets, respects modularity boundaries. |
| **Testing** | Writes and maintains tests, validates coverage, ensures independent testability. |
| **Security** | Audits code for vulnerabilities, enforces security standards, reviews authentication flows. |
| **Performance** | Profiles system performance, identifies bottlenecks, validates scalability requirements. |
| **Deployment** | Manages CI/CD pipelines, deployment configurations, and environment integrity. |
| **Documentation** | Maintains project documentation, ensures accuracy, enforces documentation rules. |
| **Technical Debt Monitor** | Tracks technical debt, flags coupling violations, proposes refactoring priorities. |
| **External Knowledge** | Integrates external scholarly data, validates source quality, manages data ingestion. |
| **Mission Integrity** | Reviews all significant decisions against the mission and core principles. Has veto authority over changes that violate this constitution. |

### 6.8 Research Engine Agents

The following agents power the manuscript research pipeline:

| Agent | Responsibility |
|---|---|
| **Discovery** | Identifies and catalogs manuscripts from digital libraries, archives, and scholarly databases. |
| **OCR** | Performs optical character recognition on manuscript images, handling ancient scripts and damaged texts. |
| **Translation** | Produces translations with full metadata (confidence, method, sources) per Section 5.2. |
| **Variant Analysis** | Compares manuscript witnesses, identifies textual variants, and classifies variant types. |
| **Lineage Reconstruction** | Builds stemmatic hypotheses for manuscript transmission history using evidence-based methods. |
| **Review Analysis** | Facilitates scholarly review of AI-generated results, tracks review status and feedback. |
| **Evidence Scoring** | Assigns confidence scores to conclusions based on evidence quality, quantity, and consistency. |
| **Publication** | Prepares finalized results for publication, assigns citation identifiers, enforces completeness. |
| **Scholarly Export** | Formats results for academic use: critical apparatus, TEI-XML, BibTeX, and standard citation formats. |

---

## 7. SECURITY STANDARDS

Security is a structural requirement, not an afterthought. The following standards are mandatory.

### 7.1 Authentication

All user authentication must be handled through Supabase Auth. No custom authentication system may be built. Authentication tokens must be validated on every protected request.

### 7.2 Row-Level Security

Row-Level Security (RLS) must be enabled on all database tables without exception. Every table must have explicit RLS policies defining read, insert, update, and soft-delete permissions. A table without RLS policies is a security violation.

### 7.3 Rate Limiting

All API endpoints must enforce rate limiting. Rate limits must be configured per endpoint based on expected usage patterns. Rate limit responses must follow standard HTTP conventions (429 status code, Retry-After header).

### 7.4 Input Validation

All API endpoints must validate all input parameters. Validation must occur at the API boundary before any business logic executes. Unvalidated input must never reach the database layer. Validation rules must be explicit and documented.

### 7.5 Secret Management

No secrets, credentials, API keys, or tokens may appear in source code, configuration files committed to the repository, or agent logs. All secrets must be managed through environment variables. Secrets must be rotated on a regular schedule defined by maintainers.

### 7.6 Dependency Auditing

All project dependencies must be audited for known vulnerabilities on a regular basis. Automated dependency scanning must be integrated into the CI/CD pipeline. Dependencies with known critical vulnerabilities must be updated or replaced before deployment.

### 7.7 Agent Sandboxing

All agent actions must be sandboxed. Agents must not have direct access to production databases, secret stores, or deployment infrastructure. Agent file system access must be limited to the working directory specified in the task packet. Agents must not execute arbitrary shell commands outside their authorized scope.

---

## 8. DOCUMENTATION RULES

Documentation is a first-class deliverable, not an optional supplement.

### 8.1 Architectural Decision Logging

All architectural decisions — technology choices, structural changes, pattern adoptions, dependency additions — must be logged in `DEVELOPMENT_LOG.md` with: the decision, the rationale, the alternatives considered, and the date. An unlogged architectural decision is an unauthorized architectural decision.

### 8.2 Feature Design Documents

Every feature must have a design document before implementation begins. The design document must specify: the problem being solved, the proposed solution, the affected components, the data model changes, the API changes, the testing strategy, and the rollback plan. Implementation without a design document is prohibited.

### 8.3 API Documentation

All API endpoints must be documented with: the endpoint path, the HTTP method, the request schema (parameters, headers, body), the response schema (success and error cases), authentication requirements, and rate limits. Undocumented endpoints must not be deployed to production.

### 8.4 Agent Task Packet Documentation

Agent task packets must reference relevant documentation summaries. Task packets must not rely on agents having prior knowledge of the system. Every task packet must be self-contained: an agent with no prior context must be able to execute the task using only the information in the packet and the referenced summaries.

### 8.5 Documentation Versioning

All documentation must be versioned. When a system changes, its documentation must be updated in the same pull request. Documentation that contradicts the current system state is a defect and must be corrected with the same urgency as a code bug.

---

## 9. AI COST CONTROL POLICIES

AI resources are finite and expensive. Responsible usage is mandatory.

### 9.1 Per-Agent Cost Limits

Every agent must have a configurable cost limit. The limit must be enforced by the agent orchestration layer. Limits must be configurable per autonomy mode:

- **Manual mode:** Conservative limits (agent proposes, human decides).
- **Hybrid mode:** Moderate limits (agent handles minor tasks autonomously).
- **Autonomous mode:** Strict limits with hard caps (agent works independently but within a tight budget).

### 9.2 Per-Session Cost Caps

Every agent session must have a cost cap. When the cap is reached, the session must pause and require human authorization to continue. Cost caps must be logged at session start and enforced throughout.

### 9.3 Token Usage Estimation

Task packets must include an estimated token usage before execution. If the estimated cost exceeds the agent's remaining budget, the task must not proceed without human approval.

### 9.4 Context Window Optimization

Agents must prefer smaller context windows when possible. Full documents must not be loaded when compressed summaries are sufficient. Redundant context loading across sequential tasks must be avoided through context caching strategies.

### 9.5 Compressed Summaries

Compressed architectural and documentation summaries must be maintained and used in preference to full documents. Summary accuracy must be validated when the source documents change.

### 9.6 API Call Logging

All AI API calls must be logged with: the agent identity, the timestamp, the model used, the input token count, the output token count, the estimated cost, and the task packet reference. Logs must be retained for cost analysis and auditing.

### 9.7 Monthly Cost Reporting

A monthly cost report must be generated summarizing: total AI spend, per-agent spend, per-model spend, average cost per task, and trend analysis. The report must be accessible to all maintainers.

---

## 10. OPEN SOURCE GOVERNANCE

CodexAtlas is an open-source project. Its governance must reflect the values of openness, collaboration, and accountability.

### 10.1 Public Repository

The CodexAtlas repository is public on GitHub. All source code, documentation, and project governance documents are publicly accessible. No development may occur in private forks that is intended for the main project without being submitted through the public process.

### 10.2 Contribution Process

Community members may fork the repository and contribute improvements. All contributions must be submitted via pull requests to the main repository. Pull requests must include: a description of the change, the motivation, testing evidence, and confirmation that the change complies with this constitution.

### 10.3 Maintainer Approval

Pull requests require approval from at least one maintainer before merging. Maintainers are responsible for verifying: code quality, architectural compliance, test coverage, documentation completeness, and constitutional adherence. Maintainers may request changes or reject contributions that violate project standards.

### 10.4 Open Discussion

All project discussions — feature proposals, architectural debates, bug reports, and governance questions — must happen in the open through GitHub Issues and GitHub Discussions. Private decision-making on matters that affect the project is prohibited except where security-sensitive disclosures require responsible handling.

### 10.5 Code of Conduct

All contributors, maintainers, and participants must adhere to the project's Code of Conduct. The Code of Conduct must be documented in the repository and enforced consistently. Violations are handled by maintainers according to the documented enforcement process.

---

## 11. DEVELOPMENT LOOP

All development activity within CodexAtlas must follow this loop. No step may be skipped.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   OBSERVE → ANALYZE → PROPOSE → REQUEST APPROVAL → IMPLEMENT    │
│       ↑                                              │           │
│       │                                              ↓           │
│   MONITOR ← DEPLOY ← REVIEW ← TEST                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Step Definitions

1. **Observe** — Gather data on the current system state, user needs, bug reports, or performance metrics.
2. **Analyze** — Interpret the observations. Identify root causes, patterns, and opportunities. Reference evidence.
3. **Propose** — Draft a specific, actionable proposal. Include the change, the rationale, the affected components, and the expected outcome.
4. **Request Approval** — Submit the proposal for human review. In Manual and Hybrid modes, await explicit approval. In Autonomous mode, verify the proposal falls within authorized limits.
5. **Implement** — Execute the approved change. Follow the task packet protocol. Respect modularity boundaries.
6. **Test** — Validate the implementation through automated tests, integration tests, and manual verification as appropriate.
7. **Review** — Submit the implementation for code review. Review must verify correctness, style, architectural compliance, and constitutional adherence.
8. **Deploy** — Deploy the reviewed change through the CI/CD pipeline. Verify deployment success.
9. **Monitor** — Observe the deployed change in production. Verify expected behavior. Detect regressions. Feed observations back into step 1.

Skipping any step is a process violation. In urgent hotfix scenarios, steps may be compressed but not eliminated — a post-incident review must document the compressed process and any deferred steps.

---

## 12. AMENDMENT PROCESS

This constitution is a living document, but it is not easily changed. Stability is a feature.

### 12.1 Proposal Requirement

Any proposed amendment must be submitted as a written document containing: the specific section(s) to be amended, the proposed new text, the rationale for the change, and the impact assessment (what systems, processes, or agents are affected).

### 12.2 Mission Integrity Review

The Mission Integrity Agent must review all proposed amendments before they are considered for approval. The Mission Integrity Agent must assess whether the amendment is consistent with the project's mission (Section 2) and core principles (Section 3). Amendments that the Mission Integrity Agent determines to be inconsistent with the mission require additional justification and maintainer deliberation.

### 12.3 Approval Thresholds

- **Sections 1–3 (Preamble, Mission, Core Principles):** Amendments require supermajority approval (two-thirds or more) from active maintainers. These sections define the identity of the project and must not be changed lightly.
- **All other sections:** Amendments require majority approval from active maintainers.

### 12.4 Amendment Logging

All approved amendments must be logged in `DEVELOPMENT_LOG.md` with: the amendment text, the rationale, the vote count, the date of approval, and the effective date. The constitution's version number must be incremented with each amendment.

### 12.5 Retroactivity

Amendments are not retroactive unless explicitly stated. Existing data, translations, and conclusions produced under prior constitutional rules remain valid under the rules in effect at the time of their creation.

---

*This constitution was ratified on March 9, 2026. It is the supreme governing document of the CodexAtlas project. All participants — human and artificial — are bound by its provisions from the moment of their engagement with the project.*
