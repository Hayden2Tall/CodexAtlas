# CodexAtlas — Data Model Summary

> Compressed context for agents working with the database. Source of truth: `/docs/`

## Database Conventions

- **Engine**: Supabase Postgres
- **Primary keys**: UUIDs (`gen_random_uuid()`)
- **Metadata**: JSONB columns for flexible/extensible fields
- **Timestamps**: All UTC, `created_at` / `updated_at` on every table
- **Soft deletes**: `archived_at` timestamp (no hard deletes)

## Core Tables

### Manuscripts & Content

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `manuscripts` | id, title, origin, date_range, language, metadata, archived_at | Root entity for a physical manuscript |
| `manuscript_images` | id, manuscript_id (FK), storage_path, page_number, ocr_status | Scanned page images linked to manuscripts |
| `passages` | id, manuscript_id (FK), reference, content, position, metadata | Discrete text segments within a manuscript |

### Translations & Versioning

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `translations` | id, passage_id (FK), language, status, current_version_id | Container for a passage translation in a given language |
| `translation_versions` | id, translation_id (FK), version_number, content, translator_id, evidence_record_id | Immutable version snapshot; version_number increments only |
| `evidence_records` | id, translation_version_id (FK), sources, methodology, confidence, notes | Required backing evidence for every translation version |

### Variant Analysis

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `variants` | id, passage_id (FK), description, status | A known textual variation point in a passage |
| `variant_readings` | id, variant_id (FK), manuscript_id, reading_text, support_level | Individual witness readings for a variant |
| `variant_comparisons` | id, variant_id (FK), methodology, result, created_by | Comparative analysis results across readings |

### Lineage & Relationships

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `manuscript_lineage` | id, ancestor_id (FK), descendant_id (FK), relationship_type, confidence | Stemmatic/genealogical links between manuscripts |

### Review & Quality

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `reviews` | id, target_type, target_id, reviewer_id, status, score, comments | Review of any reviewable entity |
| `review_clusters` | id, review_ids[], consensus_status, summary | Aggregated review consensus |

### Users & Audit

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `users` | id, email, role, display_name, institution, created_at | User accounts with role assignment |
| `research_packages` | id, creator_id (FK), title, description, contents[], visibility | Bundled research for sharing/export |
| `audit_log` | id, actor_id, actor_type, action, target_table, target_id, diff, timestamp | Immutable log of every mutation |

## Key Relationships

```
manuscripts → passages → translations → translation_versions
                      ↘ variants → variant_readings
translation_versions → evidence_records
translation_versions → reviews → review_clusters
ALL mutations → audit_log
```

## Roles & Permissions

| Role | Permissions |
|------|------------|
| `reader` | View published content |
| `reviewer` | + Submit reviews |
| `scholar` | + Create translations, variants, evidence records |
| `editor` | + Manage/edit content, moderate reviews |
| `admin` | Full access (manage users, roles, system config) |

## Invariants

- No hard deletes — use `archived_at` for soft delete
- Every `translation_version` must reference an `evidence_record`
- `version_number` on `translation_versions` is monotonically increasing per translation
- All mutations are logged in `audit_log` with actor, action, target, and diff
- RLS policies enforce role-based access on every table
