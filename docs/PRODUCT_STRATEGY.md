# CodexAtlas — Product Strategy

> **Version:** 2.0
> **Last Updated:** March 2026
> **Status:** Living Document

---

## 1. Product Vision

CodexAtlas is an open, transparent, AI-assisted research platform for ancient manuscripts. It makes manuscript research — discovery, analysis, translation, comparison, and publication — accessible and rigorous by combining AI-driven content pipelines with radical transparency.

The platform is built on a principle of **radical transparency**: every AI-generated translation, every confidence score, every piece of underlying evidence is visible, traceable, and reproducible. Nothing is hidden. Every claim links back to its evidence chain, and every AI decision can be inspected, challenged, and improved.

CodexAtlas treats ancient manuscript research not as a finished product but as a living scholarly conversation — one that AI can accelerate but only humans can validate.

---

## 2. Builder-First Philosophy

CodexAtlas is being built by its primary user. The development philosophy is:

1. **Build it and use it.** The platform should be genuinely useful to its creator first. If it's useful to one person doing real research, it will be useful to others.

2. **Content depth drives value.** A platform full of well-translated, well-evidenced manuscripts is inherently valuable. Get the content in first; worry about onboarding and marketing later.

3. **AI agents do the heavy lifting.** Manual manuscript entry is a bottleneck. AI agents discover, transcribe, translate, and analyze — humans review and validate.

4. **Share organically.** Share with people around you. See how they use it. Let adoption grow naturally from genuine utility, not from growth hacking.

5. **Design for scale, build for one.** The architecture supports thousands of users and millions of records. But right now, build for the needs of one serious user — and keep the door open for growth.

---

## 3. Target Users

### Now: The Builder

The primary user is the person building the platform — someone deeply interested in ancient manuscripts who wants a powerful, transparent tool for exploring, translating, and understanding these texts.

**Core needs:**
- AI-driven content pipeline that fills the platform with manuscripts and translations
- Tools to explore, compare, and understand the growing corpus
- Full evidence trails so every translation can be trusted or questioned
- Export capabilities for personal research

### Next: People Around You

Friends, study group members, fellow students, church community — people you'd share interesting findings with.

**Core needs:**
- Browse manuscripts and translations without needing an account
- Understand the evidence behind translations (confidence, method, reviews)
- Accessible enough for non-scholars to engage with

### Eventually: Scholars and the Public

If the platform proves genuinely useful and contains substantial content, broader adoption follows naturally.

**Core needs:**
- Professional-grade research tools (variant analysis, lineage, export)
- Reproducible workflows with stable citations
- Accessible exploration for non-specialists

---

## 4. Platform Surfaces

### Research Surface (Primary)

The workspace for serious manuscript work.

| Capability | Description |
|---|---|
| **Manuscript Browser** | Browse manuscripts with provenance, language, date, and archive metadata |
| **Variant Comparison** | Side-by-side passage comparison with word-level diff highlighting |
| **Translation Workspace** | Generate, version, and review translations with full evidence trails |
| **Evidence Explorer** | Trace any claim back to its source manuscripts and AI reasoning |
| **Review System** | Structured reviews with star ratings, categories, and free text |
| **Scholarly Export** | CSV, JSON, and TEI XML with stable citation identifiers |
| **Advanced Search** | Full-text and filtered search across the growing corpus |
| **Agent Dashboard** | Monitor AI agent activity, content stats, and API costs |

### Read Surface (Public)

The same data, accessible to anyone without an account.

| Capability | Description |
|---|---|
| **Browse** | All manuscripts, passages, and translations are publicly readable |
| **Transparency Indicators** | Confidence scores, method badges, and evidence links on every translation |
| **Reviews** | All reviews are visible — see what reviewers think of each translation |
| **Version History** | Every translation version is preserved and accessible |

---

## 5. Open Research Model

### Immediate Publication with Full Transparency

AI-generated translations are published immediately. There is no draft/publish gate. Every translation enters the platform with mandatory transparency metadata:

- **Confidence Score** — the AI's self-assessed reliability
- **Source Manuscripts** — which witnesses informed the translation
- **Translation Method** — AI initial, AI revised, human, or hybrid
- **AI Model** — the specific model and version
- **Version History** — complete record of all prior versions
- **Review History** — every review, rating, and critique

### The Legitimacy Signals Are the Product

Users determine trustworthiness for themselves by examining:
- How high is the confidence score?
- How many reviews has this received?
- What do reviewers say?
- What's the evidence chain?
- How many manuscript witnesses support this reading?

There is no editorial authority declaring translations "approved." The transparency indicators are the approval mechanism.

### Append-Only Model

Nothing is deleted. Every version of every translation, review, and evidence record is permanently preserved.

---

## 6. Living Critical Edition

CodexAtlas presents an **evolving textual tradition** — a critical edition that is alive.

For each passage, the platform maintains:

- **Manuscript Variants** — all known readings from manuscript witnesses
- **Translation Variants** — all translations with transparency metadata
- **Review History** — the scholarly conversation around each translation
- **Version Lineage** — how translations evolved through revisions

The critical apparatus is not a static footnote — it is a living, queryable system that updates as new manuscripts are ingested, new translations are produced, and new analyses are performed.

---

## 7. Growth Strategy

### Phase 1: Build and Use (Current)

**Target:** You.

**What happens:** AI agents fill the platform with manuscripts and translations. You use the research tools, review translations, explore variants, and find the content genuinely useful for your own study and curiosity.

**Success looks like:** A platform you actually use regularly, with hundreds or thousands of manuscripts, and translations you trust because you can see exactly how they were produced.

### Phase 2: Share and Learn

**Target:** People around you — friends, study groups, fellow students.

**What happens:** You share the platform link. People browse manuscripts, read translations, look at evidence chains. You learn what's confusing, what's compelling, what's missing.

**Success looks like:** Other people find it interesting and come back. You get feedback that improves the platform.

### Phase 3: Grow If It Makes Sense

**Target:** Broader scholarly and public audience.

**What happens:** If the content is substantial and the tool is useful, consider broader visibility — write about it, present it, reach out to scholars.

**Success looks like:** External validation that the platform provides real value. Possible academic citations, institutional interest, contributor community.

---

## 8. Success Metrics

### Content Depth (Primary)

| Metric | Description |
|---|---|
| Manuscripts ingested | Total manuscripts with provenance data |
| Passages translated | Total passages with at least one AI translation |
| Evidence records | Total evidence chains supporting translations |
| Reviews submitted | Total structured reviews |

### Personal Utility

| Metric | Description |
|---|---|
| Daily use | Do you actually open the platform regularly? |
| Trust | Do you trust the translations enough to learn from them? |
| Discovery | Does the platform surface things you didn't know? |

### Sharing (Later)

| Metric | Description |
|---|---|
| Engagement | Do people you share with come back? |
| Feedback | Are you getting useful feedback that improves the platform? |

---

## 9. Sustainability

### Cost Management

The primary cost is the Anthropic API for AI translations and agent tasks. Sustainability means:

- **Per-task token limits** — no single agent operation can exceed a defined budget
- **Session caps** — total token spend per batch run is capped
- **Cost dashboard** — real-time visibility into API spend
- **Rate limiting** — agents operate within defined throughput limits
- **Caching** — avoid re-translating passages that haven't changed

### Long-Term

Research data and core tools are always free. If the platform grows to need funding:

- Grants from digital humanities foundations
- Institutional subscriptions for premium features
- Donations
- Sponsored research partnerships

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| AI API costs exceed personal budget | High | Per-task limits, session budgets, cost dashboard, rate limiting |
| AI translations treated as authoritative without review | Medium | Mandatory transparency indicators, confidence scores, unreviewed translations clearly marked |
| Content quality issues from automated ingestion | Medium | Confidence scoring on all agent output, human review queue, evidence records |
| Scope creep into features before content depth | Medium | Phase 2 focuses on content engine and research tools; polish deferred |
| Burnout from solo development | Medium | Build what's useful to you first; don't chase external validation prematurely |

---

*CodexAtlas is built on the conviction that the world's ancient textual heritage belongs to everyone — and that transparency, not obscurity, is the foundation of trust.*
