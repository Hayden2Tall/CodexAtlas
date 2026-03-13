# CodexAtlas Ingestion System — Agent Context (2026-03)

> Compressed reference for agent task packets. Covers architecture, source IDs, key files, and chain behaviour after the Phase 3.9 rework (migrations 025–026).

---

## 3-Tier Architecture

| Tier | Source | Mechanism | Notes |
|---|---|---|---|
| 1 | **Source Registry** | DB lookup (`manuscript_source_texts`) | Pre-loaded by CLI scripts; covers 8 corpora |
| 2 | **NTVMR API** | Live HTTP to INTF server | NT manuscripts by GA number only |
| 3 | **no_source** | Returns `{ skipped: true }` | No AI, no bolls.life fallback |

---

## Section-Text Chain (`POST /api/agent/discover/section-text`)

**Key file:** `app/src/app/api/agent/discover/section-text/route.ts`

**Step 1 — Source Registry:**
- Call `findRegistrySource(manuscript_title, lang)` from `app/src/lib/utils/source-registry.ts`
- Query `manuscript_source_texts WHERE source = entry.sourceId AND book = parsedBook AND chapter = parsedChapter`
- For DSS: normalise book name via `normaliseDssBookName()` (handles abbreviations like "Isa" → "Isaiah")
- Pick row with most text via `.reduce()` (handles multiple scroll attestations)
- Sets `transcription_method = entry.transcriptionMethod` (scholarly vs standard)
- Source chain records `"registry"` as source

**Step 2 — NTVMR:**
- Only reached if Step 1 finds no registry entry for this manuscript
- NTVMR lookup is unchanged; GA number mapping required
- 15s timeout (`AbortSignal.timeout(15000)`)
- Returns `no_source` if NTVMR also has nothing — does NOT fall through to AI or bolls.life

**Step 3 — no_source:**
- `{ passage_id: null, skipped: true, reason: "no_authoritative_source", source_chain }`

**`force_reimport: true` flag:** Bypasses early-return for already-complete passages; allows re-import from passage detail page.

**Kept but not called:** `fetchFromBibleApi()`, `fetchFromAiModels()` (§5.1 no-deletion rule).

---

## Source Registry

**Config file:** `app/src/lib/utils/source-registry.ts`

| `sourceId` (DB `source` column) | Corpus | Language | Coverage | `transcriptionMethod` |
|---|---|---|---|---|
| `sinaiticus_project` | Codex Sinaiticus TEI XML | `grc` | Full Bible | `scholarly_transcription` |
| `etcbc_dss` | ETCBC Dead Sea Scrolls | `heb` | OT | `scholarly_transcription` |
| `wlc` | Westminster Leningrad Codex | `heb` | OT | `scholarly_transcription` |
| `sblgnt` | SBL Greek New Testament | `grc` | NT | `standard_edition` |
| `thgnt` | Tyndale House GNT | `grc` | NT | `standard_edition` |
| `coptic_scriptorium` | Coptic Scriptorium Sahidic NT | `cop` | Mixed | `scholarly_transcription` |
| `oshb` | Open Scriptures Hebrew Bible | `heb` | OT | `standard_edition` |
| `first1k_greek` | OpenGreekAndLatin First1KGreek | `grc` | Patristic | `scholarly_transcription` |

`first1k_greek`: `book` = work title (e.g., "Shepherd of Hermas"), `chapter` = section number.

**Key functions:**
- `findRegistrySource(title, language?)` — case-insensitive lookup by `manuscriptNames[]`
- `getRegistryEntry(sourceId)` — lookup by DB `source` value

---

## IIIF Harvest Pipeline

**Service:** `app/src/lib/services/iiif.ts`
- `fetchManifest(url)` — handles IIIF Presentation API v2 and v3
- `extractManuscriptMetadata(manifest, url)` — title, dates, archive fields, thumbnail, page count
- `listPages(manifest)` — per-page image URLs (v2: `sequences[0].canvases`; v3: `items`)
- `fetchCollection(url)` — returns array of manifest URLs

**Harvest API:** `POST /api/iiif/harvest`
- Body: `{ institution_id, limit (1–100), offset, dry_run?, force_update? }`
- Response: `{ created, updated, skipped, errors, has_more }`
- Creates `manuscripts` rows + stub `passages` with `transcription_method = 'iiif_metadata'`
- Deduplication by `metadata->>iiif_manifest_url`

**Institutions:** `e-codices` (~1700), `vatican` (~80000), `british-library` (~3000)

**OCR via IIIF:** `POST /api/agent/ocr` — pass `iiif_page_index` instead of `image_id`/`image_base64`. Route reads `metadata.iiif_manifest_url` from manuscript, calls `listPages()`, passes image URL to Claude Vision.

---

## Source Mismatch UI

**File:** `app/src/app/(main)/manuscripts/[id]/passages/[passageId]/translate/text-provenance.tsx`

- Amber warning when `transcription_method ∈ {standard_edition, ai_reconstructed, ai_imported}` AND manuscript is not in `KNOWN_EDITION_TITLES` (from `text-sources.ts`)
- Re-import button shown to `admin`/`editor` roles only; calls section-text with `force_reimport: true`
- Expanded panel shows source chain provenance with tier badges (manuscript / edition / ai)

---

## Admin Panels

| Panel | File | Tab |
|---|---|---|
| Source Registry status | `admin/source-registry-panel.tsx` | "Registry" |
| IIIF Harvest | `admin/iiif-harvest-panel.tsx` | "IIIF Harvest" |
| Full Import (NTVMR) | `admin/full-import-panel.tsx` | "Operations" |

**Registry status API:** `GET /api/agent/registry/status` — row counts per source, last import time, loaded/empty status.

**Adaptive rate limiting** in `full-import-panel.tsx`: 100ms delay for `registry` responses, 1500ms for `ntvmr`.

---

## Migrations Applied

| Number | File | Purpose |
|---|---|---|
| 023 | `023_create_manuscript_source_texts.sql` | `manuscript_source_texts` table + RLS |
| 025 | `025_add_iiif_transcription_method.sql` | Add `iiif_metadata` to `passages.transcription_method` CHECK constraint |
| 026 | `026_add_registry_source_index.sql` | Indexes on `(source)` and `(source, book)` |

---

## Key Utility Functions (`app/src/lib/utils/text-sources.ts`)

- `parseBookAndChapter(reference)` — parses `"Genesis 1"`, `"Gen 1:5"` etc.
- `normaliseDssBookName(name)` — maps abbreviations to canonical DB values
- `DSS_BOOK_ALIASES` — abbreviation map (e.g., `"Isa"` → `"Isaiah"`)
- `KNOWN_EDITION_TITLES` — Set of manuscript titles that ARE standard editions (no mismatch warning)
- `truncateToMaxChars(text, max)` — safety guard for large NTVMR responses
- `SOURCE_LABELS` — includes `"registry"` and `"no_source"` display strings

---

## Preprocessor Scripts

All in `scripts/`. Run from project root with Supabase env vars set:

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/preprocess-wlc.mjs
```

Each exports a pure parse function for unit testing (no network in tests).
Tests: `app/src/__tests__/preprocessors.test.ts`

OSHB reuses WLC cache and `parseOsisBook()` from `preprocess-wlc.mjs`.
OGL supports `OGL_MAX_WORKS` env var (default 200) and `GITHUB_TOKEN` for rate limiting.
