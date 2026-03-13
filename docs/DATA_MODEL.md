# CodexAtlas Data Model Specification

> **Database:** Supabase (PostgreSQL)
> **Last Updated:** 2026-03-12
> **Status:** Canonical Reference

This document defines the complete data model for CodexAtlas, an open-source AI-assisted research platform for ancient religious manuscripts. It is intended to be precise enough for a developer to implement the schema directly.

---

## 1. Design Principles

| Principle | Detail |
|---|---|
| **Append-only** | No records are ever hard-deleted. Soft-delete uses an `archived_at TIMESTAMPTZ` column set to the time of logical deletion. Queries filter on `archived_at IS NULL` by default. |
| **Version everything** | Every mutation to translated content creates a new `translation_versions` row. The previous version is marked `superseded`; the new version becomes current. |
| **Standard audit fields** | All entities carry `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ`, and `created_by UUID REFERENCES users(id)`. |
| **UUIDs as primary keys** | All primary keys are `UUID DEFAULT gen_random_uuid()`. This avoids sequential ID leakage and simplifies cross-system replication. |
| **JSONB for flexible metadata** | Columns named `metadata JSONB DEFAULT '{}'::jsonb` appear on entities where the schema may evolve without a migration (e.g., manuscript provenance notes, experimental AI parameters). |
| **Referential integrity** | All foreign keys are declared with `REFERENCES` and appropriate `ON DELETE` behavior (typically `RESTRICT` given append-only semantics). |
| **UTC timestamps** | All `TIMESTAMPTZ` values are stored and compared in UTC. Application layers must convert for display. |
| **Row-Level Security** | RLS is enabled on every table. Policies enforce role-based access as described in §5. |

---

## 2. Core Entities

### 2.1 `manuscripts`

The root entity representing a single physical or reconstructed manuscript.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `title` | `TEXT` | `NOT NULL` | Human-readable title (e.g., "Codex Sinaiticus"). |
| `original_language` | `TEXT` | `NOT NULL` | ISO 639-3 language code (e.g., `grc` for Ancient Greek, `hbo` for Ancient Hebrew). |
| `estimated_date_start` | `INTEGER` | | Earliest estimated year of composition. Negative values represent BCE (e.g., `-250` = 250 BCE). |
| `estimated_date_end` | `INTEGER` | | Latest estimated year of composition. |
| `origin_location` | `TEXT` | | Geographic origin (e.g., "Alexandria, Egypt"). |
| `archive_location` | `TEXT` | | Current holding institution or archive. |
| `archive_identifier` | `TEXT` | | Catalog number within the holding institution. |
| `description` | `TEXT` | | Free-form scholarly description. |
| `historical_context` | `TEXT` | | Historical and cultural context of the manuscript. |
| `metadata` | `JSONB` | `DEFAULT '{}'::jsonb` | Extensible metadata (provenance chain, conservation notes, digitization details). See §2.1a for IIIF-harvested fields. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time. |
| `updated_at` | `TIMESTAMPTZ` | | Last modification time. |
| `created_by` | `UUID` | `REFERENCES users(id)` | User who created the record. |
| `archived_at` | `TIMESTAMPTZ` | | Soft-delete timestamp. `NULL` means active. |

#### 2.1a `manuscripts.metadata` — IIIF-Harvested Fields

When a manuscript record is created by the IIIF harvest pipeline (`POST /api/iiif/harvest`), the following keys are written into `manuscripts.metadata`:

| Key | Type | Description |
|---|---|---|
| `iiif_manifest_url` | `string` | Canonical IIIF Presentation API manifest URL. Used for deduplication and image retrieval. |
| `iiif_institution` | `string` | Harvesting institution key (e.g., `"e-codices"`, `"vatican"`, `"british-library"`). |
| `page_count` | `number` | Number of pages (canvases) in the manifest. |
| `thumbnail_url` | `string \| null` | Thumbnail image URL extracted from the manifest. |

---

### 2.2 `manuscript_images`

Individual images (photographs, scans, multispectral captures) associated with a manuscript.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `manuscript_id` | `UUID` | `NOT NULL REFERENCES manuscripts(id)` | Parent manuscript. |
| `storage_path` | `TEXT` | `NOT NULL` | Path in Supabase Storage (e.g., `manuscripts/{id}/pages/001.tiff`). |
| `page_number` | `INTEGER` | | Physical page or folio number. |
| `image_type` | `TEXT` | | Imaging modality: `'photograph'`, `'scan'`, `'infrared'`, `'ultraviolet'`, `'multispectral'`. |
| `ocr_status` | `TEXT` | `DEFAULT 'pending'` | Processing state: `'pending'`, `'processing'`, `'completed'`, `'failed'`. |
| `metadata` | `JSONB` | `DEFAULT '{}'::jsonb` | Image-specific metadata (resolution, color space, equipment used). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time. |
| `created_by` | `UUID` | `REFERENCES users(id)` | User who uploaded the image. |

### 2.3 `passages`

A discrete textual unit within a manuscript, identified by a canonical reference.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `manuscript_id` | `UUID` | `NOT NULL REFERENCES manuscripts(id)` | Source manuscript. |
| `reference` | `TEXT` | `NOT NULL` | Canonical reference string (e.g., `"Genesis 1:1"`, `"P.Oxy. 5101 col. ii.3-7"`). |
| `sequence_order` | `INTEGER` | | Ordering index within the manuscript for sequential reading. |
| `original_text` | `TEXT` | | Transcribed text in the original language. |
| `transcription_method` | `TEXT` | | How the text was obtained: `'manual'`, `'ocr_auto'`, `'ocr_reviewed'`, `'ai_reconstructed'`, `'ai_imported'`, `'standard_edition'`, `'scholarly_transcription'`, `'iiif_metadata'`. |
| `metadata` | `JSONB` | `DEFAULT '{}'::jsonb` | Extensible metadata (paleographic notes, lacunae descriptions). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time. |
| `updated_at` | `TIMESTAMPTZ` | | Last modification time. |
| `created_by` | `UUID` | `REFERENCES users(id)` | User who created the passage record. |

### 2.4 `translations`

A translation effort for a specific passage into a target language. Acts as the parent container for version history.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `passage_id` | `UUID` | `NOT NULL REFERENCES passages(id)` | Source passage being translated. |
| `target_language` | `TEXT` | `NOT NULL` | ISO 639-3 code of the target language (e.g., `eng` for English). |
| `current_version_id` | `UUID` | `REFERENCES translation_versions(id)` | Points to the latest accepted/published version. `NULL` if no version is published yet. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time. |
| `created_by` | `UUID` | `REFERENCES users(id)` | User who initiated the translation. |

### 2.5 `translation_versions`

Immutable version records for translations. Each edit creates a new row; previous versions remain queryable.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `translation_id` | `UUID` | `NOT NULL REFERENCES translations(id)` | Parent translation. |
| `version_number` | `INTEGER` | `NOT NULL` | Monotonically increasing within a translation. `UNIQUE(translation_id, version_number)`. |
| `translated_text` | `TEXT` | `NOT NULL` | The translated content for this version. |
| `translation_method` | `TEXT` | `NOT NULL` | How this version was produced: `'ai_initial'`, `'ai_revised'`, `'human'`, `'hybrid'`. |
| `ai_model` | `TEXT` | | Model identifier if AI-generated (e.g., `"codex-atlas-v2.1"`). `NULL` for purely human translations. |
| `confidence_score` | `DECIMAL(5,4)` | | Confidence in range `0.0000`–`1.0000`. AI-assigned or editorially set. |
| `source_manuscript_ids` | `UUID[]` | | Array of manuscript IDs consulted to produce this translation. |
| `revision_reason` | `TEXT` | | Human-readable explanation of why this version was created. |
| `status` | `TEXT` | `NOT NULL DEFAULT 'draft'` | Lifecycle state: `'draft'`, `'published'`, `'superseded'`, `'disputed'`. |
| `evidence_record_id` | `UUID` | `REFERENCES evidence_records(id)` | Link to the provenance/evidence chain for this version. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time (version timestamp). |
| `created_by` | `UUID` | `REFERENCES users(id)` | User or agent who created this version. |

### 2.6 `variants`

A textual variant at a specific canonical reference point, grouping divergent readings across manuscripts.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `passage_reference` | `TEXT` | `NOT NULL` | Canonical reference where the variant occurs (e.g., `"Mark 16:9"`). Links conceptually to `passages.reference`. |
| `description` | `TEXT` | | Scholarly description of the variant (e.g., "Longer ending of Mark"). |
| `metadata` | `JSONB` | `DEFAULT '{}'::jsonb` | Extensible metadata (text-critical sigla, editorial notes). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time. |
| `created_by` | `UUID` | `REFERENCES users(id)` | User who created the variant record. |

### 2.7 `variant_readings`

A specific reading of a variant as found in a particular manuscript.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `variant_id` | `UUID` | `NOT NULL REFERENCES variants(id)` | Parent variant. |
| `manuscript_id` | `UUID` | `NOT NULL REFERENCES manuscripts(id)` | Manuscript containing this reading. |
| `reading_text` | `TEXT` | `NOT NULL` | The actual text of the reading in this manuscript. |
| `apparatus_notes` | `TEXT` | | Critical apparatus commentary. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time. |
| `created_by` | `UUID` | `REFERENCES users(id)` | User who recorded this reading. |

### 2.8 `variant_comparisons`

Pairwise comparison results between manuscript readings of a variant.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `variant_id` | `UUID` | `NOT NULL REFERENCES variants(id)` | Parent variant being compared. |
| `manuscript_a_id` | `UUID` | `NOT NULL REFERENCES manuscripts(id)` | First manuscript in the comparison. |
| `manuscript_b_id` | `UUID` | `NOT NULL REFERENCES manuscripts(id)` | Second manuscript in the comparison. |
| `similarity_score` | `DECIMAL(5,4)` | | Textual similarity in range `0.0000`–`1.0000`. |
| `diff_data` | `JSONB` | | Structured diff output (insertions, deletions, substitutions). |
| `comparison_method` | `TEXT` | | Algorithm or approach used: `'levenshtein'`, `'semantic'`, `'ai_assisted'`, `'manual'`. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time. |

### 2.9 `manuscript_lineage`

Directed edges in the stemmatic tree representing copy/derivation relationships between manuscripts.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `parent_manuscript_id` | `UUID` | `NOT NULL REFERENCES manuscripts(id)` | The source/ancestor manuscript. |
| `child_manuscript_id` | `UUID` | `NOT NULL REFERENCES manuscripts(id)` | The derived/descendant manuscript. |
| `relationship_type` | `TEXT` | `NOT NULL` | Nature of the relationship: `'copy'`, `'derivative'`, `'shared_source'`, `'hypothetical'`. |
| `confidence_score` | `DECIMAL(5,4)` | | Confidence in the proposed relationship (`0.0000`–`1.0000`). |
| `evidence_summary` | `TEXT` | | Scholarly justification for the proposed lineage. |
| `metadata` | `JSONB` | `DEFAULT '{}'::jsonb` | Extensible metadata (computational evidence, bibliography). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time. |
| `created_by` | `UUID` | `REFERENCES users(id)` | User who proposed this relationship. |

### 2.10 `reviews`

Peer reviews of specific translation versions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `translation_version_id` | `UUID` | `NOT NULL REFERENCES translation_versions(id)` | The version being reviewed. |
| `reviewer_id` | `UUID` | `NOT NULL REFERENCES users(id)` | The reviewing user. |
| `rating` | `INTEGER` | `NOT NULL CHECK (rating >= 1 AND rating <= 5)` | Quality rating from 1 (poor) to 5 (excellent). |
| `critique` | `TEXT` | `NOT NULL` | Free-form review text. |
| `structured_feedback` | `JSONB` | `DEFAULT '{}'::jsonb` | Machine-parseable critique fields (e.g., `{"accuracy": 4, "fluency": 3, "terminology": 5}`). |
| `status` | `TEXT` | `NOT NULL DEFAULT 'submitted'` | Lifecycle state: `'submitted'`, `'acknowledged'`, `'incorporated'`, `'disputed'`. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time. |
| `updated_at` | `TIMESTAMPTZ` | | Last modification time. |

### 2.11 `review_clusters`

AI-generated or editorially curated summaries of multiple reviews for a translation.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `translation_id` | `UUID` | `NOT NULL REFERENCES translations(id)` | The translation these reviews pertain to. |
| `cluster_summary` | `TEXT` | | Synthesized summary of the grouped reviews. |
| `consensus_direction` | `TEXT` | | Aggregate recommendation: `'approve'`, `'revise'`, `'dispute'`, `'insufficient'`. |
| `consensus_confidence` | `DECIMAL(5,4)` | | Confidence in the consensus (`0.0000`–`1.0000`). |
| `review_ids` | `UUID[]` | | Array of `reviews.id` values included in this cluster. |
| `analysis_method` | `TEXT` | | How the cluster was generated: `'ai_clustering'`, `'manual_curation'`, `'statistical'`. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time. |

### 2.12 `evidence_records`

Polymorphic provenance records that capture the full evidence chain for any AI-assisted or scholarly determination.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `entity_type` | `TEXT` | `NOT NULL` | Type of entity this evidence supports: `'translation_version'`, `'variant_comparison'`, `'lineage'`. |
| `entity_id` | `UUID` | `NOT NULL` | ID of the entity this evidence supports. Polymorphic reference (not a formal FK). |
| `source_manuscript_ids` | `UUID[]` | | Manuscript IDs consulted as source material. |
| `translation_method` | `TEXT` | | Method used if relevant (mirrors `translation_versions.translation_method`). |
| `ai_model` | `TEXT` | | AI model identifier used in producing the determination. |
| `confidence_score` | `DECIMAL(5,4)` | | Computed or assigned confidence (`0.0000`–`1.0000`). |
| `human_review_ids` | `UUID[]` | | Array of `reviews.id` values that informed this record. |
| `scholarly_disputes` | `JSONB` | | Structured record of disputes (dissenting opinions, counter-evidence). |
| `version_history` | `JSONB` | | Snapshot of prior states for traceability. |
| `revision_reason` | `TEXT` | | Explanation for this evidence record's creation or update. |
| `metadata` | `JSONB` | `DEFAULT '{}'::jsonb` | Extensible metadata. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time. |

### 2.13 `users`

User profiles synchronized with Supabase Auth.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK` | Matches the Supabase Auth `auth.users.id`. Not auto-generated — set on signup via trigger. |
| `display_name` | `TEXT` | | User's chosen display name. |
| `role` | `TEXT` | `NOT NULL DEFAULT 'reader'` | Access role: `'reader'`, `'reviewer'`, `'scholar'`, `'editor'`, `'admin'`. |
| `institution` | `TEXT` | | Affiliated institution or university. |
| `orcid` | `TEXT` | | ORCID identifier (e.g., `"0000-0002-1825-0097"`). |
| `bio` | `TEXT` | | Short biography or research summary. |
| `metadata` | `JSONB` | `DEFAULT '{}'::jsonb` | Extensible metadata (preferences, notification settings). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time. |
| `updated_at` | `TIMESTAMPTZ` | | Last modification time. |

### 2.14 `research_packages`

Exportable, citable research bundles for reproducibility and scholarly citation.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `title` | `TEXT` | `NOT NULL` | Human-readable package title. |
| `description` | `TEXT` | | Package contents description and scope. |
| `creator_id` | `UUID` | `NOT NULL REFERENCES users(id)` | User who assembled the package. |
| `citation_id` | `TEXT` | `UNIQUE NOT NULL` | Stable citation identifier (e.g., `"codexatlas:pkg:2026-03-09-a1b2c3"`). Used in academic citations. |
| `package_data` | `JSONB` | | Full reproducibility payload: manuscript IDs, passage IDs, version IDs, query parameters, and timestamps used to assemble the package. |
| `export_formats` | `TEXT[]` | | Available export formats (e.g., `{'json', 'csv', 'tei_xml', 'pdf'}`). |
| `storage_path` | `TEXT` | | Path in Supabase Storage to generated package files. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time. |

### 2.15 `audit_log`

Immutable, append-only log of every state-changing operation in the system.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `actor_id` | `UUID` | `REFERENCES users(id)` | User who performed the action. `NULL` for system-initiated events. |
| `actor_type` | `TEXT` | `NOT NULL` | Origin of the action: `'user'`, `'agent'` (AI pipeline), `'system'` (automated trigger). |
| `action` | `TEXT` | `NOT NULL` | Operation performed: `'create'`, `'update'`, `'archive'`, `'publish'`, `'review'`, etc. |
| `entity_type` | `TEXT` | `NOT NULL` | Table name of the affected entity (e.g., `'translation_versions'`). |
| `entity_id` | `UUID` | `NOT NULL` | Primary key of the affected row. |
| `diff_data` | `JSONB` | | Before/after diff for update operations (e.g., `{"before": {...}, "after": {...}}`). |
| `metadata` | `JSONB` | `DEFAULT '{}'::jsonb` | Contextual metadata (IP address, user agent, pipeline run ID). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Time the event occurred. |

### 2.16 `agent_tasks`

Tracks all AI agent-initiated tasks: batch translations, manuscript discovery, OCR jobs, variant detection, etc.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `task_type` | `TEXT` | `NOT NULL CHECK (...)` | Task category: `'batch_translate'`, `'discover_manuscript'`, `'ocr_process'`, `'detect_variants'`, `'custom'`. |
| `status` | `TEXT` | `NOT NULL DEFAULT 'queued'` | Lifecycle state: `'queued'`, `'running'`, `'completed'`, `'failed'`, `'cancelled'`. |
| `priority` | `INTEGER` | `NOT NULL DEFAULT 0` | Scheduling priority (higher = sooner). |
| `config` | `JSONB` | `NOT NULL DEFAULT '{}'::jsonb` | Task-specific configuration (target language, source filters, etc.). |
| `result` | `JSONB` | | Task output data. |
| `error_message` | `TEXT` | | Error details if the task failed. |
| `tokens_input` | `INTEGER` | `NOT NULL DEFAULT 0` | Total input tokens consumed. |
| `tokens_output` | `INTEGER` | `NOT NULL DEFAULT 0` | Total output tokens produced. |
| `estimated_cost_usd` | `NUMERIC(10,6)` | `NOT NULL DEFAULT 0` | Estimated API cost in USD. |
| `ai_model` | `TEXT` | | AI model identifier used. |
| `total_items` | `INTEGER` | | Total items in the batch. |
| `completed_items` | `INTEGER` | `NOT NULL DEFAULT 0` | Items processed successfully. |
| `failed_items` | `INTEGER` | `NOT NULL DEFAULT 0` | Items that failed. |
| `created_by` | `UUID` | `REFERENCES users(id)` | User who initiated the task. |
| `started_at` | `TIMESTAMPTZ` | | When processing began. |
| `completed_at` | `TIMESTAMPTZ` | | When processing finished. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` | Row creation time. |
| `updated_at` | `TIMESTAMPTZ` | | Last modification time. |

### 2.17 `manuscript_source_texts`

Preprocessed manuscript transcription data from external scholarly sources. Populated by one-time offline CLI preprocessor scripts (`scripts/preprocess-*.mjs`), not by the application at runtime. Each source has a dedicated preprocessor and is registered in `app/src/lib/utils/source-registry.ts`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | `PK DEFAULT gen_random_uuid()` | Unique identifier. |
| `source` | `TEXT` | `NOT NULL` | Data source identifier. See table below. |
| `manuscript_name` | `TEXT` | `NOT NULL` | Display name of the manuscript or scroll. |
| `book` | `TEXT` | `NOT NULL` | Biblical book name (e.g., "Genesis", "Isaiah"). |
| `chapter` | `INTEGER` | `NOT NULL` | Chapter number within the book. |
| `text` | `TEXT` | `NOT NULL` | The transcribed text content in original language (Hebrew or Greek). |
| `metadata` | `JSONB` | `DEFAULT '{}'::jsonb` | Source-specific metadata (license, scroll ID, corpus version). |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` | Row creation time. |

**Unique constraint:** `UNIQUE(source, manuscript_name, book, chapter)` — prevents duplicate entries for the same text unit.

**Performance indexes** (migration 026):
```sql
CREATE INDEX idx_mst_source_only ON manuscript_source_texts (source);
CREATE INDEX idx_mst_source_book  ON manuscript_source_texts (source, book);
```

#### `manuscript_source_texts.source` Values

| `source` | Corpus | Language | Coverage | Transcription Method | Preprocessor |
|---|---|---|---|---|---|
| `sinaiticus_project` | Codex Sinaiticus Project (TEI XML) | `grc` | Full Bible | `scholarly_transcription` | `preprocess-sinaiticus.mjs` |
| `etcbc_dss` | ETCBC Dead Sea Scrolls (Text-Fabric) | `heb` | OT | `scholarly_transcription` | `preprocess-dss.mjs` |
| `wlc` | Westminster Leningrad Codex (OSIS XML) | `heb` | OT | `scholarly_transcription` | `preprocess-wlc.mjs` |
| `sblgnt` | SBL Greek New Testament (plain text) | `grc` | NT | `standard_edition` | `preprocess-sblgnt.mjs` |
| `thgnt` | Tyndale House GNT (TSV) | `grc` | NT | `standard_edition` | `preprocess-thgnt.mjs` |
| `coptic_scriptorium` | Coptic Scriptorium — Sahidic NT (TEI XML) | `cop` | Mixed | `scholarly_transcription` | `preprocess-coptic.mjs` |
| `oshb` | Open Scriptures Hebrew Bible (OSIS XML) | `heb` | OT | `standard_edition` | `preprocess-oshb.mjs` |
| `first1k_greek` | OpenGreekAndLatin First1KGreek (TEI XML) | `grc` | Patristic | `scholarly_transcription` | `preprocess-ogl.mjs` |

> **Note:** For `first1k_greek`, the `book` column stores the work title (e.g., `"Ignatius - To the Ephesians"`) and `chapter` stores the section number, not a biblical chapter.

---

## 3. Knowledge Graph Relationships

The relational model forms a directed knowledge graph where manuscripts sit at the root and scholarly determinations flow outward through passages, translations, variants, and reviews — all anchored by evidence records.

### Relationship Summary

| Relationship | Type | Description |
|---|---|---|
| `manuscripts` → `passages` | 1:many | A manuscript contains many discrete textual passages. |
| `manuscripts` → `manuscript_images` | 1:many | A manuscript has many associated images. |
| `passages` → `translations` | 1:many | A passage can be translated into multiple languages. |
| `translations` → `translation_versions` | 1:many | Each translation accumulates immutable version records. |
| `passages` ↔ `variants` | many:many (via `passage_reference`) | Variants are linked to passages by canonical reference string, enabling cross-manuscript alignment. |
| `variants` → `variant_readings` | 1:many | Each variant collects readings from multiple manuscripts. |
| `variant_readings` → `manuscripts` | many:1 | Each reading originates from a specific manuscript. |
| `variants` → `variant_comparisons` | 1:many | Pairwise comparison results between manuscript readings. |
| `manuscripts` ↔ `manuscripts` | many:many (via `manuscript_lineage`) | Self-referencing stemmatic relationships (parent → child). |
| `translation_versions` → `reviews` | 1:many | Each version can receive multiple peer reviews. |
| `translations` → `review_clusters` | 1:many | Aggregated review summaries per translation. |
| `* entities` → `evidence_records` | polymorphic | Any entity can have provenance evidence attached via `(entity_type, entity_id)`. |
| `* mutations` → `audit_log` | polymorphic | Every state change is logged via `(entity_type, entity_id)`. |

### Entity Relationship Diagram

```
┌─────────────────┐        ┌──────────────────────┐
│     users        │        │     audit_log         │
│─────────────────│        │──────────────────────│
│ id (PK)          │◄───┐   │ id (PK)               │
│ display_name     │    │   │ actor_id (FK→users)    │
│ role             │    │   │ entity_type            │
│ institution      │    │   │ entity_id              │
│ orcid            │    │   │ action                 │
└────────┬─────────┘    │   │ diff_data              │
         │              │   └──────────────────────┘
         │ created_by   │            ▲
         ▼              │            │ (logs all mutations)
┌─────────────────────┐ │            │
│    manuscripts       │ │   ┌───────┴──────────────┐
│─────────────────────│ │   │   evidence_records     │
│ id (PK)              │ │   │──────────────────────│
│ title                │ │   │ id (PK)               │
│ original_language    │ │   │ entity_type            │
│ estimated_date_*     │ │   │ entity_id              │
│ metadata             │ │   │ confidence_score       │
│ archived_at          │ │   │ scholarly_disputes     │
└──┬──────┬──────┬─────┘ │   └───────────────────────┘
   │      │      │        │            ▲
   │      │      │        │            │ (polymorphic)
   │      │      │        │            │
   │      │      │   ┌────┴────────────┴──────────┐
   │      │      │   │                             │
   │      │      ▼   │                             │
   │      │   ┌──────┴──────────┐                  │
   │      │   │ manuscript_      │                  │
   │      │   │ images           │                  │
   │      │   │─────────────────│                  │
   │      │   │ id (PK)          │                  │
   │      │   │ manuscript_id    │                  │
   │      │   │ storage_path     │                  │
   │      │   │ ocr_status       │                  │
   │      │   └─────────────────┘                  │
   │      │                                        │
   │      ▼                                        │
   │   ┌─────────────────────┐                     │
   │   │ manuscript_lineage   │                     │
   │   │─────────────────────│                     │
   │   │ id (PK)              │                     │
   │   │ parent_manuscript_id │─┐  (self-ref)       │
   │   │ child_manuscript_id  │─┘                   │
   │   │ relationship_type    │                     │
   │   │ confidence_score     │─────────────────────┘
   │   └─────────────────────┘
   │
   ▼
┌─────────────────────┐
│     passages         │
│─────────────────────│
│ id (PK)              │
│ manuscript_id (FK)   │
│ reference            │◄──────────────────────┐
│ original_text        │                       │ (via passage_reference)
│ sequence_order       │                       │
└──────────┬──────────┘                       │
           │                                   │
     ┌─────┴──────┐                   ┌────────┴──────────┐
     │            │                   │     variants       │
     ▼            │                   │───────────────────│
┌────────────┐    │                   │ id (PK)            │
│translations│    │                   │ passage_reference   │
│────────────│    │                   │ description         │
│ id (PK)    │    │                   └────────┬───────────┘
│ passage_id │    │                            │
│ target_lang│    │                      ┌─────┴──────┐
│ current_   │    │                      │            │
│ version_id │─┐  │                      ▼            ▼
└─────┬──────┘ │  │           ┌──────────────┐ ┌─────────────────┐
      │        │  │           │ variant_      │ │ variant_         │
      ▼        │  │           │ readings      │ │ comparisons      │
┌─────────────┐│  │           │──────────────│ │─────────────────│
│ translation_ ││  │           │ id (PK)       │ │ id (PK)          │
│ versions     ││  │           │ variant_id    │ │ variant_id       │
│─────────────││  │           │ manuscript_id │ │ manuscript_a_id  │
│ id (PK)      │◄─┘           │ reading_text  │ │ manuscript_b_id  │
│ translation_ │              └──────────────┘ │ similarity_score │
│ id (FK)      │                               │ diff_data        │
│ version_num  │                               └─────────────────┘
│ translated_  │
│ text         │
│ status       │
│ evidence_    │
│ record_id    │───► evidence_records
└──────┬───────┘
       │
       ▼
┌──────────────┐         ┌───────────────────┐
│   reviews     │         │  review_clusters   │
│──────────────│         │───────────────────│
│ id (PK)       │         │ id (PK)            │
│ translation_  │         │ translation_id     │◄── translations
│ version_id    │         │ cluster_summary    │
│ reviewer_id   │         │ consensus_direction│
│ rating        │         │ review_ids[]       │
│ critique      │         └───────────────────┘
│ status        │
└──────────────┘

┌─────────────────────┐
│  research_packages   │
│─────────────────────│
│ id (PK)              │
│ title                │
│ creator_id (FK)      │
│ citation_id (UNIQUE) │
│ package_data         │
│ export_formats[]     │
└─────────────────────┘
```

### Graph Traversal Examples

- **Manuscript → Translation**: `manuscripts` → `passages` → `translations` → `translation_versions`
- **Variant Analysis**: `variants` → `variant_readings` (per manuscript) → `variant_comparisons` (pairwise)
- **Lineage Tree**: Recursive traversal of `manuscript_lineage` via `parent_manuscript_id` / `child_manuscript_id`
- **Evidence Chain**: Any entity → `evidence_records` (via `entity_type` + `entity_id`) → `human_review_ids` → `reviews`
- **Audit Trail**: Any entity → `audit_log` (via `entity_type` + `entity_id`), ordered by `created_at`

---

## 4. Indexing Strategy

### Primary Key Indexes

Every table has an implicit unique B-tree index on its `id` primary key (created automatically by PostgreSQL).

### Foreign Key Indexes

Foreign key columns receive explicit indexes to accelerate joins and cascading lookups:

```sql
CREATE INDEX idx_manuscript_images_manuscript_id ON manuscript_images(manuscript_id);
CREATE INDEX idx_passages_manuscript_id ON passages(manuscript_id);
CREATE INDEX idx_translations_passage_id ON translations(passage_id);
CREATE INDEX idx_translation_versions_translation_id ON translation_versions(translation_id);
CREATE INDEX idx_variant_readings_variant_id ON variant_readings(variant_id);
CREATE INDEX idx_variant_readings_manuscript_id ON variant_readings(manuscript_id);
CREATE INDEX idx_variant_comparisons_variant_id ON variant_comparisons(variant_id);
CREATE INDEX idx_variant_comparisons_manuscript_a_id ON variant_comparisons(manuscript_a_id);
CREATE INDEX idx_variant_comparisons_manuscript_b_id ON variant_comparisons(manuscript_b_id);
CREATE INDEX idx_manuscript_lineage_parent_id ON manuscript_lineage(parent_manuscript_id);
CREATE INDEX idx_manuscript_lineage_child_id ON manuscript_lineage(child_manuscript_id);
CREATE INDEX idx_reviews_translation_version_id ON reviews(translation_version_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_review_clusters_translation_id ON review_clusters(translation_id);
CREATE INDEX idx_research_packages_creator_id ON research_packages(creator_id);
CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id);
```

### Full-Text Search Indexes

GIN indexes on `tsvector` for efficient text search over original passages and translations:

```sql
CREATE INDEX idx_passages_original_text_fts
  ON passages
  USING GIN (to_tsvector('simple', coalesce(original_text, '')));

CREATE INDEX idx_translation_versions_translated_text_fts
  ON translation_versions
  USING GIN (to_tsvector('english', coalesce(translated_text, '')));
```

### Domain-Specific Indexes

```sql
-- Canonical reference lookups (high cardinality, frequent queries)
CREATE INDEX idx_passages_reference ON passages(reference);

-- Language-based filtering
CREATE INDEX idx_manuscripts_original_language ON manuscripts(original_language);

-- Version ordering within a translation (supports "get latest version" queries)
CREATE UNIQUE INDEX idx_translation_versions_tid_vnum
  ON translation_versions(translation_id, version_number);

-- Polymorphic evidence lookups
CREATE INDEX idx_evidence_records_entity
  ON evidence_records(entity_type, entity_id);

-- Audit trail queries (entity history sorted by time)
CREATE INDEX idx_audit_log_entity_time
  ON audit_log(entity_type, entity_id, created_at);

-- Status filtering for translation versions
CREATE INDEX idx_translation_versions_status ON translation_versions(status);

-- Variant reference lookups
CREATE INDEX idx_variants_passage_reference ON variants(passage_reference);
```

### JSONB Indexes

GIN indexes on JSONB columns that are queried (filter or key-exists operations):

```sql
CREATE INDEX idx_manuscripts_metadata ON manuscripts USING GIN (metadata);
CREATE INDEX idx_passages_metadata ON passages USING GIN (metadata);
CREATE INDEX idx_manuscript_images_metadata ON manuscript_images USING GIN (metadata);
CREATE INDEX idx_evidence_records_metadata ON evidence_records USING GIN (metadata);
CREATE INDEX idx_evidence_records_scholarly_disputes ON evidence_records USING GIN (scholarly_disputes);
CREATE INDEX idx_reviews_structured_feedback ON reviews USING GIN (structured_feedback);
CREATE INDEX idx_research_packages_package_data ON research_packages USING GIN (package_data);
CREATE INDEX idx_audit_log_diff_data ON audit_log USING GIN (diff_data);
```

---

## 5. Row-Level Security Policies

RLS is enabled on every table. The authenticated user's role is read from the `users` table via `auth.uid()`.

### Helper Function

```sql
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### Policy Matrix

| Table | `reader` | `reviewer` | `scholar` | `editor` | `admin` |
|---|---|---|---|---|---|
| `manuscripts` | SELECT (non-archived) | SELECT | SELECT | SELECT, INSERT, UPDATE | ALL |
| `manuscript_images` | SELECT | SELECT | SELECT | SELECT, INSERT, UPDATE | ALL |
| `passages` | SELECT | SELECT | SELECT, INSERT | SELECT, INSERT, UPDATE | ALL |
| `translations` | SELECT (published) | SELECT | SELECT, INSERT | SELECT, INSERT, UPDATE | ALL |
| `translation_versions` | SELECT (published) | SELECT | SELECT, INSERT | SELECT, INSERT, UPDATE | ALL |
| `variants` | SELECT | SELECT | SELECT, INSERT | SELECT, INSERT, UPDATE | ALL |
| `variant_readings` | SELECT | SELECT | SELECT, INSERT | SELECT, INSERT, UPDATE | ALL |
| `variant_comparisons` | SELECT | SELECT | SELECT, INSERT | SELECT, INSERT, UPDATE | ALL |
| `manuscript_lineage` | SELECT | SELECT | SELECT, INSERT | SELECT, INSERT, UPDATE | ALL |
| `reviews` | SELECT | SELECT, INSERT | SELECT, INSERT | SELECT, INSERT, UPDATE | ALL |
| `review_clusters` | SELECT | SELECT | SELECT | SELECT, INSERT, UPDATE | ALL |
| `evidence_records` | SELECT | SELECT | SELECT, INSERT | SELECT, INSERT, UPDATE | ALL |
| `users` | SELECT (own) | SELECT (own + public) | SELECT (own + public) | SELECT | ALL |
| `research_packages` | SELECT | SELECT | SELECT, INSERT | SELECT, INSERT, UPDATE | ALL |
| `audit_log` | SELECT | SELECT | SELECT | SELECT | ALL |

### Policy Examples

```sql
-- Enable RLS on all tables
ALTER TABLE manuscripts ENABLE ROW LEVEL SECURITY;
-- (repeated for every table)

-- readers: can SELECT non-archived manuscripts
CREATE POLICY manuscripts_reader_select ON manuscripts
  FOR SELECT
  USING (
    archived_at IS NULL
    AND current_user_role() IN ('reader', 'reviewer', 'scholar', 'editor', 'admin')
  );

-- scholars: can INSERT translations
CREATE POLICY translations_scholar_insert ON translations
  FOR INSERT
  WITH CHECK (
    current_user_role() IN ('scholar', 'editor', 'admin')
    AND created_by = auth.uid()
  );

-- editors: can UPDATE most entities
CREATE POLICY manuscripts_editor_update ON manuscripts
  FOR UPDATE
  USING (current_user_role() IN ('editor', 'admin'));

-- admins: full access
CREATE POLICY manuscripts_admin_all ON manuscripts
  FOR ALL
  USING (current_user_role() = 'admin');

-- audit_log: all authenticated users can read
CREATE POLICY audit_log_select ON audit_log
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- audit_log: only system/triggers can insert (no direct user inserts)
CREATE POLICY audit_log_insert ON audit_log
  FOR INSERT
  WITH CHECK (false);  -- inserts via SECURITY DEFINER function only
```

> **Note:** The `audit_log` INSERT policy blocks direct inserts. Audit records are written by a `SECURITY DEFINER` trigger function that bypasses RLS, ensuring tamper-resistance.

---

## 6. Version History Model

### Mechanism

The `translation_versions` table is the sole versioning mechanism for translation content. Rather than updating rows in place, every edit creates a new immutable version row.

### Version Lifecycle

```
                ┌─────────┐
                │  draft   │
                └────┬─────┘
                     │ publish
                     ▼
                ┌──────────┐   new version published
                │ published │ ─────────────────────────┐
                └────┬─────┘                           │
                     │                                 ▼
                     │ dispute               ┌────────────────┐
                     ▼                       │   superseded    │
                ┌──────────┐                 └────────────────┘
                │ disputed  │
                └──────────┘
```

### Rules

1. **Creation**: A new `translation_versions` row is inserted with `status = 'draft'` and `version_number = max(version_number) + 1` for that `translation_id`.

2. **Publishing**: When a draft is published:
   - Its `status` is set to `'published'`.
   - The previous published version (if any) has its `status` set to `'superseded'`.
   - `translations.current_version_id` is updated to point to the newly published version.

3. **Superseding**: A version transitions to `'superseded'` only when a newer version is published. Superseded versions remain fully queryable.

4. **Disputing**: Any published version can be moved to `'disputed'` if a review or scholarly challenge requires it. This does not automatically promote another version — an editor must resolve the dispute.

5. **Immutability**: The `translated_text`, `version_number`, and `translation_method` fields on a version row are never updated after creation. All changes produce a new version.

6. **Querying history**: To retrieve the full version history of a translation:

   ```sql
   SELECT *
   FROM translation_versions
   WHERE translation_id = :id
   ORDER BY version_number ASC;
   ```

7. **Current version shortcut**: The `translations.current_version_id` pointer allows O(1) lookup of the latest accepted version without scanning version history.

---

## 7. Migration Strategy

### Location

All migrations live in `/scripts/migrations/` as sequential SQL files:

```
scripts/migrations/
├── 001_create_users.sql
├── 002_create_manuscripts.sql
├── 003_create_manuscript_images.sql
├── 004_create_passages.sql
├── 005_create_translations.sql
├── 006_create_translation_versions.sql
├── 007_create_variants.sql
├── 008_create_variant_readings.sql
├── 009_create_variant_comparisons.sql
├── 010_create_manuscript_lineage.sql
├── 011_create_reviews.sql
├── 012_create_review_clusters.sql
├── 013_create_evidence_records.sql
├── 014_create_research_packages.sql
├── 015_create_audit_log.sql
├── 016_create_indexes.sql
├── 017_create_rls_policies.sql
├── 018_create_triggers.sql
├── 019_create_agent_tasks.sql
├── 020_add_ai_transcription_methods.sql
├── 021_add_standard_edition_transcription_method.sql
├── 022_add_scholarly_transcription_method.sql
├── 023_create_manuscript_source_texts.sql
├── 025_add_iiif_transcription_method.sql
└── 026_add_registry_source_index.sql
```

### Principles

1. **Sequential and versioned**: Each migration has a numeric prefix. They are applied in order. Supabase CLI (`supabase db push` / `supabase migration up`) manages execution.

2. **Never destructive**: Migrations must not contain `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE`. Column removal follows a deprecation cycle:
   - Migration N: Add new column (if replacing). Mark old column as deprecated in comments.
   - Migration N+1 (minimum 2 release cycles later): Remove old column after confirming zero usage.

3. **Idempotent where possible**: Use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `DO $$ ... END $$` blocks for conditional logic.

4. **Logged**: Every migration application is recorded in `DEVELOPMENT_LOG.md` with date, migration number, description, and author.

5. **Reviewed**: Migration files are committed to version control and require code review before application to staging or production.

### Trigger Migrations

The trigger migration (`018_create_triggers.sql`) includes:

- **`updated_at` auto-update**: A trigger on tables with `updated_at` that sets the timestamp on every `UPDATE`.
- **Audit log writer**: A generic trigger function that inserts into `audit_log` on every `INSERT`, `UPDATE`, or soft-delete (`archived_at` set) across all tracked tables.
- **User sync**: A trigger on `auth.users` that creates/updates a corresponding `public.users` row on signup.

```sql
-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_manuscripts_updated_at
  BEFORE UPDATE ON manuscripts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- (repeated for passages, translations, reviews, users)
```
