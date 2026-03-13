# CodexAtlas — Ingestion System Rework
**Plan:** stateless-forging-willow
**Date:** 2026-03-12
**Status:** Ready for execution
**Constitution refs:** §6.7/6.8 (agent roles), §8.1 (DEVELOPMENT_LOG), §8.2 (feature design doc requirement), §5.1 (no deletion), §9.5 (compressed summaries)

---

## Context

The current manuscript ingestion system is architecturally misleading and operationally fragile. When importing most manuscripts, the 6-step fallback chain silently falls through to standard critical editions (SBLGNT, bolls.life WLC/LXX) or AI-generated text — neither of which represents the specific manuscript being imported. DSS imports always fail due to a `.single()` bug. Timeouts are frequent. There is no passage-level re-import trigger.

This plan replaces the ceremony-heavy import flow with a clean three-tier system:
- **Tier 1:** Source Registry — pre-cataloged open-access corpora, bulk-imported by CLI scripts, no AI
- **Tier 2:** NTVMR API — the only remaining live API source (NT manuscripts by GA number)
- **Tier 3:** IIIF Metadata Harvest — manuscript records + image URLs from major institutions; OCR on demand

The discovery → AI TOC → section-by-section AI import flow is deprecated as the primary path. AI generation is removed from the import chain entirely. Existing mismatched data is flagged in the UI, not deleted.

---

## Architecture After This Plan

```
Source Registry (DB: manuscript_source_texts)
  ├─ Sinaiticus (TEI XML — already loaded)
  ├─ DSS/ETCBC (Text-Fabric — already loaded, bug fixed)
  ├─ WLC (OSIS XML — new)
  ├─ SBLGNT (plain text — preloaded, was live-fetched)
  ├─ THGNT (TSV — new)
  ├─ Coptic Scriptorium (TEI XML — new)
  ├─ Open Scriptures HB (OSIS XML — new)
  └─ OpenGreekAndLatin (TEI XML — new, patristic)

NTVMR API → manuscript-specific NT text (GA-mapped manuscripts only)

IIIF Institutions → manuscript records (metadata + image URLs)
  ├─ e-codices (~1,700 Swiss manuscripts)
  ├─ Vatican DigiVatLib (~80,000 codices)
  └─ British Library (limited, post-cyberattack recovery)
  → OCR pipeline on demand per manuscript
```

**Section-text chain (after rework):**
1. Source Registry DB lookup (covers all preprocessed corpora)
2. NTVMR API (NT manuscripts in GA mapping only)
3. `no_source` — no AI, no bolls.life fallback

---

## Phase A — Data Integrity
*Agent roles: Data Agent (A1), UI Agent (A2, A4), API Agent (A3)*
*Development loop step: OBSERVE → ANALYZE → IMPLEMENT → TEST*

### A1 — Audit Query (diagnostic, run in Supabase SQL editor)
**File:** `scripts/audit/audit-source-mismatch.sql` *(create — diagnostic only, not a migration)*

```sql
SELECT p.id, p.reference, p.transcription_method, m.title, p.created_at
FROM passages p
JOIN manuscripts m ON m.id = p.manuscript_id
WHERE p.transcription_method IN ('standard_edition', 'ai_reconstructed', 'ai_imported')
  AND LOWER(m.title) NOT IN (
    'sblgnt','westminster leningrad codex','codex leningradensis',
    'leningrad codex','firkovich b 19a','leningradensis',
    'lxx','septuagint','textus receptus','byzantine text'
  )
ORDER BY m.title, p.reference;
```
Run before all other work. Output quantifies the data integrity problem.

---

### A2 — Source Mismatch Warning Banner
**File:** `app/src/app/(main)/manuscripts/[id]/passages/[passageId]/translate/text-provenance.tsx` *(modify)*

- Add `manuscriptTitle: string` prop (passed from `translate/page.tsx`)
- Add `KNOWN_EDITION_TITLES` set (same pattern as `LENINGRAD_TITLES` in `text-sources.ts`)
- Render amber warning box when `transcription_method` is `standard_edition` or `ai_reconstructed` AND manuscript is not a known edition
- Warning text: *"This text came from a standard critical edition, not this specific manuscript's unique transcription. Use Re-import to fetch an authoritative source."*
- Render before the source chain display
- **Reuse:** `LENINGRAD_TITLES` pattern from `app/src/lib/utils/text-sources.ts`

---

### A3 — Fix DSS Book Name Lookup Bug
**File:** `app/src/app/api/agent/discover/section-text/route.ts` *(modify `fetchFromDss()` function)*

**Root cause confirmed:** The query uses `.single()` which throws when multiple scroll rows exist for the same `book`/`chapter` (different DSS scrolls both attest to e.g. Isaiah 1).

**Fix:**
- Replace `.single()` with `.order('text', { ascending: false }).limit(1)` — picks the row with most text (most complete scroll attestation)
- Alternatively: fetch all rows, pick `rows.sort((a,b) => b.text.length - a.text.length)[0]`
- Add book name normalization: before querying, run the parsed book name through `parseBookAndChapter()` then map to canonical display name via `BOOK_NUMBERS` → display name lookup
- Add `DSS_BOOK_ALIASES` map to `text-sources.ts` for any abbreviation mismatches (cross-reference `preprocess-dss.mjs` BOOK_DISPLAY map vs stored `book` values)

**Reuse:** `parseBookAndChapter()` from `app/src/lib/utils/text-sources.ts:line ~50`

---

### A4 — Re-import Button on Passage Detail Page
**Files:**
- `app/src/app/(main)/manuscripts/[id]/passages/[passageId]/translate/text-provenance.tsx` *(modify)*
- `app/src/app/(main)/manuscripts/[id]/passages/[passageId]/translate/page.tsx` *(modify — pass `userRole` prop)*
- `app/src/app/api/agent/discover/section-text/route.ts` *(modify — add `force_reimport` flag)*

**API change:** Add `force_reimport?: boolean` to POST body. When `true`, skip the "already complete" early-return check at lines 300-314.

**UI change in `text-provenance.tsx`:**
- Accept `userRole: string` prop
- Show "Re-import from authoritative source" button only when: `userRole` is `admin` or `editor` AND `transcription_method` is not `scholarly_transcription`
- Button calls `POST /api/agent/discover/section-text` with `{ manuscript_id, reference, force_reimport: true }`
- On success: call `router.refresh()` (from `useRouter`)
- Show loading state during request

---

## Phase B — Source Registry + Corpus Importers
*Agent roles: Architecture Agent (B1), External Knowledge Agent (B2a-f), API Agent (B3), UI Agent (B4), Data Agent (B5)*

### B1 — Source Registry Config
**File:** `app/src/lib/utils/source-registry.ts` *(create new)*

```typescript
export interface SourceRegistryEntry {
  id: string;
  displayName: string;
  license: string;
  language: string;           // ISO 639-3
  coverage: 'ot' | 'nt' | 'full' | 'patristic' | 'mixed';
  manuscriptNames: string[];  // values stored in manuscript_source_texts.manuscript_name
  downloadUrl: string;
  format: 'tei-xml' | 'osis-xml' | 'tsv' | 'txt' | 'json';
  preprocessorScript: string;
  sourceId: string;           // manuscript_source_texts.source column value
  transcriptionMethod: 'scholarly_transcription' | 'standard_edition';
}

export const SOURCE_REGISTRY: Record<string, SourceRegistryEntry>
export function findRegistrySource(manuscriptTitle: string, language: string): SourceRegistryEntry | null
export function getRegistryEntry(sourceId: string): SourceRegistryEntry | undefined
```

**Registry entries:**

| id | sourceId | manuscriptNames | language | coverage | transcriptionMethod |
|----|----------|----------------|----------|----------|---------------------|
| sinaiticus | sinaiticus_project | ["Codex Sinaiticus", "Sinaiticus"] | grc | full | scholarly_transcription |
| dss | etcbc_dss | ["Dead Sea Scrolls", "Dead Sea Scrolls (ETCBC)"] | heb | ot | scholarly_transcription |
| wlc | wlc | ["Westminster Leningrad Codex", "Leningrad Codex", "Codex Leningradensis"] | heb | ot | scholarly_transcription |
| sblgnt | sblgnt | ["SBLGNT", "SBL Greek New Testament"] | grc | nt | standard_edition |
| thgnt | thgnt | ["Tyndale House GNT", "THGNT"] | grc | nt | standard_edition |
| coptic | coptic_scriptorium | ["Coptic Scriptorium", "Sahidic NT"] | cop | mixed | scholarly_transcription |
| oshb | oshb | ["Open Scriptures Hebrew Bible", "OSHB"] | heb | ot | standard_edition |
| ogl | first1k_greek | ["OpenGreekAndLatin", "First1KGreek"] | grc | patristic | scholarly_transcription |

---

### B2 — New Preprocessor Scripts
*All follow the exact pattern of `scripts/preprocess-sinaiticus.mjs`: env check → download/cache → parse → batch upsert (50 rows) → print summary. Each exports pure parse functions for unit testing.*

#### B2a — `scripts/preprocess-wlc.mjs`
- **Source:** `https://github.com/openscriptures/morphhb/raw/master/wlc/{book}.xml` (39 book files, OSIS XML)
- **sourceId:** `wlc` | **manuscriptName:** `Westminster Leningrad Codex`
- **Parser:** OSIS XML — `<verse osisID="Gen.1.1">` elements → group by middle number (chapter)
- **Key:** Download all 39 books in parallel (Promise.all with rate limit), cache locally
- **Exported pure function:** `parseOsisBook(xml: string): { chapter: number, text: string }[]`
- **License:** Public domain (tanach.us UXLC)

#### B2b — `scripts/preprocess-sblgnt.mjs`
- **Source:** `https://raw.githubusercontent.com/LogosBible/SBLGNT/master/data/sblgnt/text/{book}.txt` (27 NT books)
- **sourceId:** `sblgnt` | **manuscriptName:** `SBLGNT`
- **Parser:** **Reuse `parseSblgntChapter()` from `app/src/lib/utils/text-sources.ts`** — iterate all chapters per book
- **Key:** After this runs, `section-text` queries DB instead of live GitHub fetch
- **License:** CC BY 4.0

#### B2c — `scripts/preprocess-thgnt.mjs`
- **Source:** `https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Transliterated%20OT%20and%20NT/THGNT%20-%20Tyndale%20House%20GNT.txt`
- **sourceId:** `thgnt` | **manuscriptName:** `Tyndale House GNT`
- **Parser:** TSV-style lines `JHN 1:1\t{Greek text}` → group by book abbreviation + chapter number
- **Exported pure function:** `parseThgntTsv(content: string): { book: string, chapter: number, text: string }[]`
- **License:** CC BY 4.0

#### B2d — `scripts/preprocess-coptic.mjs`
- **Source:** GitHub API to list files in `CopticScriptorium/corpora`, download TEI XML files for NT corpus
- **sourceId:** `coptic_scriptorium` | **manuscriptName:** `Coptic Scriptorium (Sahidic NT)` initially, expand to full corpus
- **Parser:** TEI XML — `<div type="textpart" subtype="chapter" n="N">` → extract text nodes/`<w>` elements
- **Key:** Large corpus (2.2M tokens) — stream/process one file at a time, not all in memory
- **Exported pure function:** `parseCopticTei(xml: string, defaultBook: string): { chapter: number, text: string }[]`
- **License:** CC BY 4.0 (primary)

#### B2e — `scripts/preprocess-oshb.mjs`
- **Source:** `https://github.com/openscriptures/morphhb/raw/master/wlc/{book}.xml` (same source as WLC but parse differently — include morphology tags stripped to plain text)
- **sourceId:** `oshb` | **manuscriptName:** `Open Scriptures Hebrew Bible`
- **Parser:** OSIS XML — same structure as WLC; **reuse `parseOsisBook()` from preprocess-wlc.mjs** (import it)
- **License:** CC BY 4.0

#### B2f — `scripts/preprocess-ogl.mjs`
- **Source:** `https://github.com/OpenGreekAndLatin/First1KGreek/tree/master/data` — list via GitHub API, download TEI XML per work
- **sourceId:** `first1k_greek` | **manuscriptName:** per-work (e.g., `Ignatius - To the Ephesians`, `Shepherd of Hermas`)
- **Parser:** TEI XML — `<div type="section" n="N">` or `<div type="chapter" n="N">` mapped to `chapter` column. For works without numbered divs: use sequential section numbering.
- **Key:** Non-biblical structure — `book` column stores work title, `chapter` = section number
- **License:** CC-BY or equivalent per work

---

### B3 — Refactor Section-Text Chain
**File:** `app/src/app/api/agent/discover/section-text/route.ts` *(major modify)*

**Changes:**
1. **Add Step 1 (Registry Lookup):** Before all existing steps, call `findRegistrySource(manuscriptTitle, language)`. If found, query `manuscript_source_texts WHERE source = entry.sourceId AND book = parsedBook AND chapter = parsedChapter`. This subsumes the existing Sinaiticus (Step 1) and DSS (Step 3) specific cases.
2. **Convert SBLGNT to DB lookup (Step 2):** After `preprocess-sblgnt.mjs` is run, query `manuscript_source_texts WHERE source = 'sblgnt'` instead of live GitHub fetch.
3. **Keep NTVMR as Step 2 (live API):** No change to NTVMR logic except: if NTVMR returns empty, return `no_source` — do NOT fall through to SBLGNT/bolls.life.
4. **Remove Step 5 (bolls.life):** Delete `fetchFromBibleApi()` call from chain. Keep the function in the file (§5.1 no deletion) but do not call it.
5. **Remove Step 6 (AI fallback):** Remove `fetchFromAiModels()` call from chain. Keep function in file but do not call it.
6. **Add Step 3 — `no_source` response:** If all sources return nothing, respond with `{ skipped: true, reason: "no_authoritative_source", source_chain }`.

**Updated `TextSource` union:**
```typescript
type TextSource = "registry" | "ntvmr" | "no_source";
```
(Keep old values in `SOURCE_LABELS` for backwards compat with existing metadata display)

**Transcription method for registry sources:** Use `entry.transcriptionMethod` from registry — not hardcoded.

---

### B4 — Source Registry Admin Panel
**Files:**
- `app/src/app/(main)/admin/source-registry-panel.tsx` *(create new)*
- `app/src/app/(main)/admin/admin-dashboard.tsx` *(modify — add Registry tab)*
- `app/src/app/api/agent/registry/status/route.ts` *(create new)*

**Status API (`GET /api/agent/registry/status`):**
- Auth: admin/editor only
- Query: `SELECT source, COUNT(*) as row_count, MAX(created_at) as last_imported FROM manuscript_source_texts GROUP BY source`
- Return: array of `{ sourceId, displayName, rowCount, lastImported, status: "loaded" | "empty" }`

**Registry Panel UI:**
- Table: Name | Language | Coverage | License | Rows in DB | Last Updated | Status
- For each source: shows CLI command to run (`node scripts/preprocess-{id}.mjs`) — preprocessors are CLI-only
- Refresh button to reload status
- Status badges: green "Loaded (N rows)" / amber "Not yet imported"
- Dashboard: add "Registry" tab to `admin-dashboard.tsx` tab list

---

### B5 — Migration: Add `iiif_metadata` Transcription Method + Index
**Files:**
- `scripts/migrations/025_add_iiif_transcription_method.sql` *(create)*
- `scripts/migrations/026_add_registry_source_index.sql` *(create)*

```sql
-- 025
ALTER TABLE public.passages DROP CONSTRAINT IF EXISTS passages_transcription_method_check;
ALTER TABLE public.passages ADD CONSTRAINT passages_transcription_method_check
  CHECK (transcription_method IN (
    'manual','ocr_auto','ocr_reviewed','ai_reconstructed','ai_imported',
    'standard_edition','scholarly_transcription','iiif_metadata'
  ));

-- 026
CREATE INDEX IF NOT EXISTS idx_mst_source_only ON public.manuscript_source_texts (source);
CREATE INDEX IF NOT EXISTS idx_mst_source_book ON public.manuscript_source_texts (source, book);
```

Also update `app/src/lib/types/index.ts` or equivalent — add `'iiif_metadata'` to `TranscriptionMethod` type.

---

## Phase C — IIIF Metadata Harvest
*Agent roles: Architecture Agent (C1), API Agent (C2, C4), UI Agent (C3)*

### C1 — IIIF Service
**File:** `app/src/lib/services/iiif.ts` *(create new — also creates `app/src/lib/services/` directory)*

```typescript
// Support IIIF Presentation API v2 and v3
export async function fetchManifest(url: string): Promise<IiifManifest>

export function extractManuscriptMetadata(manifest: IiifManifest): {
  title: string;
  description: string | null;
  estimatedDateStart: number | null;
  estimatedDateEnd: number | null;
  archiveLocation: string | null;
  archiveIdentifier: string | null;
  language: string | null;
  thumbnailUrl: string | null;
  pageCount: number;
  iiifManifestUrl: string;
}

export function listPages(manifest: IiifManifest): Array<{
  sequence: number;
  label: string;
  imageUrl: string;
  thumbnailUrl: string | null;
}>

export async function fetchCollection(collectionUrl: string): Promise<string[]>
```

**v2 image URL path:** `sequences[0].canvases[n].images[0].resource.@id`
**v3 image URL path:** `items[n].items[0].items[0].body.id`

**Institution Registry** (co-located in `iiif.ts`):
```typescript
export const IIIF_INSTITUTIONS = {
  "e-codices": {
    name: "e-codices (Virtual Manuscript Library of Switzerland)",
    collectionUrl: "https://www.e-codices.unifr.ch/metadata/iiif/collection.json",
    approximateCount: 1700,
  },
  "vatican": {
    name: "Vatican DigiVatLib",
    collectionUrl: "https://digi.vatlib.it/iiif/collection",
    approximateCount: 80000,
  },
  "british-library": {
    name: "British Library Digitised Manuscripts",
    collectionUrl: "https://api.bl.uk/metadata/iiif/index.json",
    approximateCount: 3000,
  },
}
```

---

### C2 — IIIF Harvest API Route
**File:** `app/src/app/api/iiif/harvest/route.ts` *(create new — also creates `app/src/app/api/iiif/` directory)*

**`POST /api/iiif/harvest`**
```typescript
// Request
{ institution_id: string; limit: number; offset: number; dry_run?: boolean; force_update?: boolean }

// Response
{ created: number; updated: number; skipped: number; errors: number; has_more: boolean }
```

**Logic:**
1. Auth: admin/editor only
2. Validate `institution_id` against `IIIF_INSTITUTIONS` keys
3. Fetch collection from `collectionUrl`, paginate with `limit`/`offset`
4. For each manifest URL: `fetchManifest()` → `extractManuscriptMetadata()`
5. Upsert `manuscripts` row: title, description, archive fields, `metadata: { iiif_manifest_url, iiif_institution, page_count, thumbnail_url }`
6. Upsert one stub `passages` row: `reference = "Full manuscript"`, `transcription_method = 'iiif_metadata'`, `original_text = null`
7. Return counts

**Note:** Vercel 60s timeout — UI must call in batches of 50 with incrementing offset.

**Input validation:** `limit` clamped to 1-100, `offset` ≥ 0, `institution_id` must be a key of `IIIF_INSTITUTIONS`.

---

### C3 — IIIF Harvest Admin Panel
**Files:**
- `app/src/app/(main)/admin/iiif-harvest-panel.tsx` *(create new)*
- `app/src/app/(main)/admin/admin-dashboard.tsx` *(modify — add IIIF Harvest tab)*

**Panel features:**
- Institution selector dropdown (from `IIIF_INSTITUTIONS`)
- Batch size: 50 (fixed — safe for Vercel timeout)
- Dry-run checkbox
- Start Harvest button → loops `POST /api/iiif/harvest` with incrementing offset until `has_more = false`
- Progress: `Created: N | Updated: N | Skipped: N | Errors: N`
- Cancel ref pattern (same as `full-import-panel.tsx`)
- Estimated total shown from `IIIF_INSTITUTIONS[id].approximateCount`

---

### C4 — Connect OCR Pipeline to IIIF
**File:** `app/src/app/api/agent/ocr/route.ts` *(modify)*

Add `iiif_page_index?: number` to POST request body. When neither `image_base64` nor `image_id` is provided but `iiif_page_index` is:
1. Load manuscript record, read `metadata.iiif_manifest_url`
2. Call `fetchManifest()` + `listPages()`
3. Get `pages[iiif_page_index].imageUrl`
4. Pass as URL image content to Claude Vision (already supports URL images at lines 134-187)

This closes the loop: IIIF harvest creates the record → user selects a page → OCR fetches the image from IIIF → saves `ocr_auto` passages.

---

## Phase D — Chunking + Reliability
*Agent roles: API Agent (D1, D2), UI Agent (D3)*

### D1 — Verse-Level Chunking Utility
**File:** `app/src/lib/utils/text-sources.ts` *(modify — add utilities)*

Add:
```typescript
export function splitIntoChunks(text: string, maxCharsPerChunk: number): string[]
export function truncateToMaxChars(text: string, max: number): string
```

**Primary application:** NTVMR responses can be large HTML pages. Add `truncateToMaxChars(text, 50000)` safety guard in `fetchFromNtvmr()` before storing. For registry sources (already per-chapter from DB), no chunking needed.

**Note:** Removing AI from the chain eliminates the primary timeout source. Monitor NTVMR timeout rates in production before implementing full verse-level splitting — defer if not needed.

---

### D2 — Partial Save + Timeout Handling
**File:** `app/src/app/api/agent/discover/section-text/route.ts` *(modify)*

If NTVMR returns partial data (fewer verses than expected), save with `metadata.partial: true`. The section-text response includes `partial: boolean` flag. The full-import-panel UI shows "Partial" badge on such imports (yellow, not red — it's not a failure).

NTVMR already has `AbortSignal.timeout(15000)`. Keep this. On abort, return partial data rather than error if any text was received.

---

### D3 — Adaptive Rate Limiting in Full Import Panel
**File:** `app/src/app/(main)/admin/full-import-panel.tsx` *(modify)*

Change hardcoded `1500ms` delay to be source-adaptive:
- Registry sources: `100ms` (fast DB lookups)
- NTVMR: `1500ms` (respect INTF server)

The section-text response already returns `source_used`. Use that to determine delay for the next request.

---

## Phase E — Tests, Docs, Dev Lifecycle
*Agent roles: Test Agent (E1-E3), Documentation Agent (E4-E6)*

### E1 — Preprocessor Unit Tests
**File:** `app/src/__tests__/preprocessors.test.ts` *(create new)*

Each preprocessor exports its pure parse function. Test with inline fixture strings (no network):
- `parseOsisBook(fixtureXml)` → correct `{ chapter, text }` array
- `parseSblgntChapter()` — **already tested** in `text-source-chain.test.ts`, verify reuse
- `parseThgntTsv(fixtureTsv)` → correct book/chapter/text output
- `parseCopticTei(fixtureXml)` → correct Coptic text extracted
- Edge cases: empty chapters, missing elements, malformed XML (graceful skip)

---

### E2 — IIIF Service Unit Tests
**File:** `app/src/__tests__/iiif-service.test.ts` *(create new)*

Inline fixture JSON (small mock manifests):
- `extractManuscriptMetadata(v2Fixture)` → correct field mapping
- `extractManuscriptMetadata(v3Fixture)` → correct field mapping (different path)
- `listPages(fixture)` → correct page count and URL extraction
- `listPages(emptyManifest)` → returns `[]`, no throw
- `fetchCollection()` with mocked `fetch` → returns array of manifest URLs

---

### E3 — Source Registry Unit Tests
**File:** `app/src/__tests__/source-registry.test.ts` *(create new)*

- `findRegistrySource("Westminster Leningrad Codex", "heb")` → WLC entry
- `findRegistrySource("Codex Sinaiticus", "grc")` → Sinaiticus entry
- `findRegistrySource("Unknown Papyrus X", "grc")` → `null`
- `findRegistrySource("SBLGNT", "grc")` → SBLGNT entry
- `findRegistrySource("Dead Sea Scrolls", "heb")` → DSS entry
- All `SOURCE_REGISTRY` entries have `id`, `sourceId`, `manuscriptNames`, `language`, `preprocessorScript` defined
- All `transcriptionMethod` values are valid enum members

---

### E4 — DSS Fix Unit Tests (add to existing test file)
**File:** `app/src/__tests__/text-source-chain.test.ts` *(modify)*

Add:
- `DSS_BOOK_ALIASES` lookup tests (normalized book names)
- Test that DSS lookup handles multiple scroll rows gracefully (mock `.limit(1)` result)

---

### E5 — Documentation Updates
**Files to update:**
- `docs/DATA_MODEL.md` — add new source IDs to `manuscript_source_texts.source` enum table; add IIIF fields (`iiif_manifest_url`, `iiif_institution`, `page_count`, `thumbnail_url`) to manuscripts.metadata JSONB docs; add `iiif_metadata` to transcription_method table
- `docs/ROADMAP.md` — mark Phase 3.5 items as complete (ISR, image optimization), add Phase 3.9 "Ingestion Rework" as new completed section
- `docs/DEVELOPMENT_LOG.md` — add entry: date, decision (remove AI fallback, add Source Registry, add IIIF harvest), rationale, files affected, migration numbers (025, 026)

---

### E6 — Compressed Agent Context Document
**File:** `docs/agent-context/ingestion-system-2026.md` *(create new — also creates `docs/agent-context/` directory)*

~400-token summary of the new ingestion architecture for use in future agent task packets (per §9.5). Covers: 3-tier system, source IDs, section-text chain steps, IIIF harvest pattern, key file paths, migration numbers applied.

---

## Critical Path (execution order)

```
B5 (migrations 025, 026) — run first, unblocks schema-dependent work
  │
  ├─ A1 (audit query) — run in parallel, diagnostic only
  ├─ A2 (mismatch banner) — UI work, independent
  ├─ A3 (DSS fix) — bug fix, independent
  ├─ A4 (re-import button) — depends on A2 (shared component)
  │
  └─ B1 (source-registry.ts) — foundation for B2, B3, B4
       │
       ├─ B2a-f (preprocessor scripts) — independent of each other, run in any order
       │   └─ RUN all preprocess scripts to populate DB before B3 goes live
       │
       ├─ B3 (section-text chain refactor) — depends on B1, B2 scripts having been run
       ├─ B4 (registry admin panel) — depends on B1
       │
       └─ C1 (iiif.ts service) — depends on B5 (schema)
            │
            ├─ C2 (harvest API) — depends on C1
            │    └─ C3 (harvest panel) — depends on C2
            │         └─ C4 (OCR + IIIF) — depends on C1, C2
            │
            └─ D1-D3 (reliability) — after B3
                 └─ E1-E6 (tests + docs) — after corresponding implementation
```

**Sprint sequence for solo execution:**
1. **Sprint 1:** B5 (migrations), A1, A2, A3, A4
2. **Sprint 2:** B1, B2a (WLC), B2b (SBLGNT), B3 (chain refactor)
3. **Sprint 3:** B2c (THGNT), B2d (Coptic), B2e (OSHB), B2f (OGL), B4 (registry panel)
4. **Sprint 4:** C1, C2, C3, C4
5. **Sprint 5:** D1-D3, E1-E6

---

## Key Files: Create vs. Modify

### Create New
| File | Phase | Purpose |
|------|-------|---------|
| `scripts/audit/audit-source-mismatch.sql` | A1 | Diagnostic query |
| `scripts/preprocess-wlc.mjs` | B2a | WLC corpus importer |
| `scripts/preprocess-sblgnt.mjs` | B2b | SBLGNT preloader |
| `scripts/preprocess-thgnt.mjs` | B2c | THGNT importer |
| `scripts/preprocess-coptic.mjs` | B2d | Coptic Scriptorium importer |
| `scripts/preprocess-oshb.mjs` | B2e | Open Scriptures HB importer |
| `scripts/preprocess-ogl.mjs` | B2f | OpenGreekAndLatin importer |
| `scripts/migrations/025_add_iiif_transcription_method.sql` | B5 | Schema: iiif_metadata method |
| `scripts/migrations/026_add_registry_source_index.sql` | B5 | Schema: performance indexes |
| `app/src/lib/utils/source-registry.ts` | B1 | Registry config + lookup fns |
| `app/src/lib/services/iiif.ts` | C1 | IIIF manifest service |
| `app/src/app/api/agent/registry/status/route.ts` | B4 | Registry status API |
| `app/src/app/api/iiif/harvest/route.ts` | C2 | IIIF harvest API |
| `app/src/app/(main)/admin/source-registry-panel.tsx` | B4 | Registry admin UI |
| `app/src/app/(main)/admin/iiif-harvest-panel.tsx` | C3 | IIIF harvest admin UI |
| `app/src/__tests__/preprocessors.test.ts` | E1 | Preprocessor parse fn tests |
| `app/src/__tests__/iiif-service.test.ts` | E2 | IIIF service tests |
| `app/src/__tests__/source-registry.test.ts` | E3 | Registry lookup tests |
| `docs/agent-context/ingestion-system-2026.md` | E6 | Compressed agent context |

### Modify Existing
| File | Phase | Change |
|------|-------|--------|
| `app/src/app/api/agent/discover/section-text/route.ts` | A3, B3, D2 | Registry step 1, remove bolls.life+AI, DSS fix, partial save |
| `app/src/app/api/agent/ocr/route.ts` | C4 | Add `iiif_page_index` param |
| `app/src/lib/utils/text-sources.ts` | A3, D1 | DSS_BOOK_ALIASES, chunking utils |
| `app/src/lib/types/index.ts` | B5 | Add `iiif_metadata` to TranscriptionMethod |
| `app/src/app/(main)/manuscripts/[id]/passages/[passageId]/translate/text-provenance.tsx` | A2, A4 | Mismatch banner + re-import button |
| `app/src/app/(main)/manuscripts/[id]/passages/[passageId]/translate/page.tsx` | A4 | Pass userRole to TextProvenance |
| `app/src/app/(main)/admin/admin-dashboard.tsx` | B4, C3 | Add Registry + IIIF Harvest tabs |
| `app/src/app/(main)/admin/full-import-panel.tsx` | D3 | Adaptive rate limiting |
| `app/src/__tests__/text-source-chain.test.ts` | E4 | DSS fix tests + remove AI tests |
| `docs/DATA_MODEL.md` | E5 | New sources, IIIF fields |
| `docs/ROADMAP.md` | E5 | Mark 3.5 complete, add 3.9 |
| `docs/DEVELOPMENT_LOG.md` | E5 | Architectural decision entry |

### Do NOT Delete (§5.1)
- `fetchFromAiModels()` in section-text — kept, not called
- `fetchFromBibleApi()` in section-text — kept, not called
- `discovery-panel.tsx` — kept as power-user escape hatch
- `full-import-panel.tsx` — kept (still needed for NTVMR chapter-by-chapter imports)

---

## Constitution Compliance

| Requirement | Implementation |
|-------------|----------------|
| §5.1 No deletion | AI/bolls.life functions kept in file, not removed |
| §5.2 Translation metadata | All new sources set transcription_method + ingested_by + transcription_source |
| §7.2 Input validation | IIIF harvest route validates institution_id, limit, offset at boundary |
| §7.4 RLS | manuscript_source_texts RLS from migration 023 covers all new source rows; new tables (none) would need RLS |
| §8.1 DEVELOPMENT_LOG | E5 task writes log entry before any code changes |
| §8.2 Feature design doc | This plan file is the feature design doc — save to `docs/design/ingestion-rework-2026.md` at start of Sprint 1 |
| §9.5 Compressed summaries | E6 creates agent context doc |
| §6.7 Agent assignments | Each task has responsible agent from constitution §6.7/6.8 roster |

---

## Verification / Testing

**After each sprint:**

**Sprint 1 (Data integrity):**
- Run `audit-source-mismatch.sql` in Supabase — note row counts
- Visit a passage with `standard_edition` on a non-edition manuscript → confirm amber banner appears
- Test DSS import of Isaiah 1 → should succeed (previously always failed)
- Click Re-import on a `standard_edition` passage → verify API called, page refreshes

**Sprint 2 (WLC, SBLGNT, chain refactor):**
- Run `node scripts/preprocess-wlc.mjs` → verify row count in `manuscript_source_texts`
- Run `node scripts/preprocess-sblgnt.mjs` → verify rows
- Import a Sinaiticus chapter → confirm `source_chain` shows `registry` step 1 success
- Import an NT chapter for an unknown manuscript → confirm response is `no_source` (not AI text)
- Run `npm test` → all tests pass (including updated section-text tests)

**Sprint 3 (Additional corpora):**
- Run each new preprocessor script → verify row counts
- `SELECT COUNT(*) FROM manuscript_source_texts GROUP BY source` — all 8 sources present
- Test Coptic import → passages created with `transcription_method = 'scholarly_transcription'`

**Sprint 4 (IIIF):**
- Run e-codices harvest with `dry_run: true` → verify 0 DB changes, N would-be-created shown
- Run harvest with limit=10 → verify 10 manuscript records created with IIIF metadata
- OCR trigger on IIIF manuscript with `iiif_page_index: 0` → verify image fetched from manifest URL

**Sprint 5 (Reliability + docs):**
- `npm test` → all new test files pass (E1, E2, E3, E4)
- Verify `DATA_MODEL.md` matches actual schema
- Verify `DEVELOPMENT_LOG.md` entry present and complete

**Full regression:**
- Existing Sinaiticus import still works
- Existing NTVMR-mapped manuscript (e.g., P52) import still works
- Batch translation still works
- Variant detection still works
- Evidence chain display still shows correct provenance
