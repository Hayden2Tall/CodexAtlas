#!/usr/bin/env node
/**
 * Populate manuscripts and passages from pre-loaded source registry data.
 *
 * Reads all unique (source, manuscript_name) groups from `manuscript_source_texts`,
 * looks up metadata from the Source Registry, then:
 *   1. Creates a `manuscripts` row if none exists with that title.
 *   2. Creates one `passages` row per book/chapter if it doesn't already exist.
 *
 * This is the bridge between running preprocess-*.mjs (which loads raw text into
 * manuscript_source_texts) and having importable passages in the main app.
 *
 * Prerequisites:
 *   - Run migrations 023, 025, 026 first
 *   - Run at least one preprocess-*.mjs script to populate manuscript_source_texts
 *   - Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 *
 * Usage:
 *   node scripts/populate-manuscripts.mjs [--source wlc] [--dry-run]
 *
 * Options:
 *   --source <id>   Only populate for this sourceId (e.g. wlc, sblgnt, etcbc_dss).
 *                   Default: all sources.
 *   --dry-run       Print what would be created without writing to DB.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, "../app/package.json"));
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
const filterSource = args.includes("--source")
  ? args[args.indexOf("--source") + 1]
  : null;
const dryRun = args.includes("--dry-run");

if (dryRun) {
  console.log("DRY RUN — no writes will be performed.\n");
}

// Source Registry metadata (mirrors app/src/lib/utils/source-registry.ts).
// Kept inline so this script has no TS import dependency.
const SOURCE_REGISTRY = {
  sinaiticus: {
    sourceId: "sinaiticus_project",
    displayName: "Codex Sinaiticus",
    language: "grc",
    transcriptionMethod: "scholarly_transcription",
    estimatedDateStart: 330,
    estimatedDateEnd: 360,
    originLocation: "Egypt or Caesarea Maritima",
  },
  dss: {
    sourceId: "etcbc_dss",
    displayName: "Dead Sea Scrolls (ETCBC)",
    language: "heb",
    transcriptionMethod: "scholarly_transcription",
    estimatedDateStart: -250,
    estimatedDateEnd: 68,
    originLocation: "Judean Desert, Israel",
  },
  wlc: {
    sourceId: "wlc",
    displayName: "Westminster Leningrad Codex",
    language: "heb",
    transcriptionMethod: "scholarly_transcription",
    estimatedDateStart: 1008,
    estimatedDateEnd: 1010,
    originLocation: "Cairo, Egypt",
  },
  sblgnt: {
    sourceId: "sblgnt",
    displayName: "SBL Greek New Testament",
    language: "grc",
    transcriptionMethod: "standard_edition",
    estimatedDateStart: 2010,
    estimatedDateEnd: 2010,
    originLocation: null,
  },
  thgnt: {
    sourceId: "thgnt",
    displayName: "Tyndale House Greek New Testament",
    language: "grc",
    transcriptionMethod: "standard_edition",
    estimatedDateStart: 2017,
    estimatedDateEnd: 2017,
    originLocation: null,
  },
  coptic: {
    sourceId: "coptic_scriptorium",
    displayName: "Coptic Scriptorium",
    language: "cop",
    transcriptionMethod: "scholarly_transcription",
    estimatedDateStart: null,
    estimatedDateEnd: null,
    originLocation: "Egypt",
  },
  oshb: {
    sourceId: "oshb",
    displayName: "Open Scriptures Hebrew Bible",
    language: "heb",
    transcriptionMethod: "standard_edition",
    estimatedDateStart: null,
    estimatedDateEnd: null,
    originLocation: null,
  },
  ogl: {
    sourceId: "first1k_greek",
    displayName: "OpenGreekAndLatin (First1KGreek)",
    language: "grc",
    transcriptionMethod: "scholarly_transcription",
    estimatedDateStart: null,
    estimatedDateEnd: null,
    originLocation: null,
  },
};

// Build lookup: sourceId → registry entry
const BY_SOURCE_ID = {};
for (const entry of Object.values(SOURCE_REGISTRY)) {
  BY_SOURCE_ID[entry.sourceId] = entry;
}

async function main() {
  // 1. Find all distinct (source, manuscript_name) pairs in manuscript_source_texts
  let query = supabase
    .from("manuscript_source_texts")
    .select("source, manuscript_name")
    .order("source");

  if (filterSource) {
    query = query.eq("source", filterSource);
  }

  const { data: allRows, error: fetchErr } = await query;
  if (fetchErr || !allRows) {
    console.error("Failed to fetch manuscript_source_texts:", fetchErr?.message);
    process.exit(1);
  }

  // Deduplicate
  const groups = new Map(); // "source|manuscript_name" → { source, manuscript_name }
  for (const row of allRows) {
    const key = `${row.source}|${row.manuscript_name}`;
    if (!groups.has(key)) groups.set(key, { source: row.source, manuscriptName: row.manuscript_name });
  }

  console.log(`Found ${groups.size} distinct (source, manuscript_name) group(s).\n`);

  let totalManuscriptsCreated = 0;
  let totalPassagesCreated = 0;
  let totalPassagesSkipped = 0;

  for (const { source, manuscriptName } of groups.values()) {
    const registryEntry = BY_SOURCE_ID[source];

    console.log(`--- Processing: "${manuscriptName}" (source=${source}) ---`);

    if (!registryEntry) {
      console.log(`  SKIP: no Source Registry entry for source="${source}"`);
      continue;
    }

    // 2. Find or create manuscript record
    const { data: existingMs } = await supabase
      .from("manuscripts")
      .select("id, title")
      .ilike("title", manuscriptName)
      .limit(1)
      .maybeSingle();

    let manuscriptId;

    if (existingMs) {
      manuscriptId = existingMs.id;
      console.log(`  Manuscript: already exists (id=${manuscriptId})`);
    } else {
      if (dryRun) {
        console.log(`  [DRY RUN] Would create manuscript: "${manuscriptName}"`);
        manuscriptId = `dry-run-${source}`;
        totalManuscriptsCreated++;
      } else {
        const { data: newMs, error: msErr } = await supabase
          .from("manuscripts")
          .insert({
            title: manuscriptName,
            original_language: registryEntry.language,
            estimated_date_start: registryEntry.estimatedDateStart,
            estimated_date_end: registryEntry.estimatedDateEnd,
            origin_location: registryEntry.originLocation,
            metadata: {
              source_registry_id: source,
              transcription_method_default: registryEntry.transcriptionMethod,
              auto_populated: true,
            },
          })
          .select("id")
          .single();

        if (msErr || !newMs) {
          console.error(`  ERROR creating manuscript:`, msErr?.message);
          continue;
        }
        manuscriptId = newMs.id;
        totalManuscriptsCreated++;
        console.log(`  Created manuscript: id=${manuscriptId}`);
      }
    }

    // 3. Fetch all chapters for this source + manuscript_name
    const { data: chapters, error: chErr } = await supabase
      .from("manuscript_source_texts")
      .select("book, chapter, text")
      .eq("source", source)
      .eq("manuscript_name", manuscriptName)
      .order("book")
      .order("chapter");

    if (chErr || !chapters) {
      console.error(`  ERROR fetching chapters:`, chErr?.message);
      continue;
    }

    console.log(`  Found ${chapters.length} chapters to populate.`);

    if (dryRun) {
      console.log(`  [DRY RUN] Would create up to ${chapters.length} passages.`);
      totalPassagesCreated += chapters.length;
      continue;
    }

    // 4. Fetch existing passages for this manuscript to avoid duplicates
    const { data: existingPassages } = await supabase
      .from("passages")
      .select("reference")
      .eq("manuscript_id", manuscriptId);

    const existingRefs = new Set(
      (existingPassages ?? []).map((p) => p.reference.toLowerCase().trim())
    );

    // 5. Upsert passages — one per book/chapter
    const BATCH_SIZE = 50;
    let created = 0;
    let skipped = 0;

    const toInsert = [];
    for (let i = 0; i < chapters.length; i++) {
      const { book, chapter, text } = chapters[i];
      const reference = `${book} ${chapter}`;
      if (existingRefs.has(reference.toLowerCase())) {
        skipped++;
        continue;
      }
      toInsert.push({
        manuscript_id: manuscriptId,
        reference,
        sequence_order: i + 1,
        original_text: text,
        transcription_method: registryEntry.transcriptionMethod,
        metadata: {
          ingested_by: source,
          transcription_source: registryEntry.displayName,
          auto_populated: true,
        },
      });
    }

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error: pErr } = await supabase.from("passages").insert(batch);
      if (pErr) {
        console.error(`  ERROR inserting passages batch:`, pErr.message);
      } else {
        created += batch.length;
      }
    }

    totalPassagesCreated += created;
    totalPassagesSkipped += skipped;
    console.log(`  Passages: ${created} created, ${skipped} already existed.`);
  }

  console.log(
    `\nDone. Manuscripts created: ${totalManuscriptsCreated}, ` +
    `Passages created: ${totalPassagesCreated}, ` +
    `Passages skipped (existing): ${totalPassagesSkipped}.`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
