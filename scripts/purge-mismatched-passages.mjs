#!/usr/bin/env node
/**
 * Purge mismatched passages from the database.
 *
 * Finds passages with transcription_method in
 * ('standard_edition', 'ai_reconstructed', 'ai_imported', 'ai')
 * on manuscripts that are NOT known standard editions. These passages
 * contain text from a fallback source that doesn't represent the specific
 * manuscript, and should be removed so clean data can be re-imported.
 *
 * Also deletes all associated translations and translation_versions first
 * (FK constraint order).
 *
 * Prerequisites:
 *   - Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 *
 * Usage:
 *   node scripts/purge-mismatched-passages.mjs [--dry-run] [--manuscript-id <id>]
 *
 * Options:
 *   --dry-run              List what would be deleted without executing. (DEFAULT)
 *   --confirm              Actually delete. Required to write to DB.
 *   --manuscript-id <id>   Limit to one manuscript.
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
const dryRun = !args.includes("--confirm");
const msIdFilter = args.includes("--manuscript-id")
  ? args[args.indexOf("--manuscript-id") + 1]
  : null;

// Known standard-edition manuscript titles — passages on THESE manuscripts
// with standard_edition transcription_method are correct and should NOT be purged.
const KNOWN_EDITION_TITLES = new Set([
  "sblgnt",
  "sbl greek new testament",
  "westminster leningrad codex",
  "codex leningradensis",
  "leningrad codex",
  "firkovich b 19a",
  "leningradensis",
  "lxx",
  "septuagint",
  "textus receptus",
  "byzantine text",
  "open scriptures hebrew bible",
  "oshb",
  "tyndale house gnt",
  "thgnt",
  "tyndale house greek new testament",
]);

const MISMATCH_METHODS = [
  "standard_edition",
  "ai_reconstructed",
  "ai_imported",
  "ai",
];

if (dryRun) {
  console.log("DRY RUN — run with --confirm to actually delete.\n");
}

async function main() {
  // 1. Fetch all manuscripts
  let msQuery = supabase.from("manuscripts").select("id, title");
  if (msIdFilter) msQuery = msQuery.eq("id", msIdFilter);

  const { data: manuscripts, error: msErr } = await msQuery;
  if (msErr || !manuscripts) {
    console.error("Failed to fetch manuscripts:", msErr?.message);
    process.exit(1);
  }

  // Split into known editions vs non-editions
  const nonEditionMsIds = manuscripts
    .filter((m) => !KNOWN_EDITION_TITLES.has(m.title.toLowerCase().trim()))
    .map((m) => m.id);

  console.log(
    `Total manuscripts: ${manuscripts.length}, ` +
    `non-editions (candidates for purge): ${nonEditionMsIds.length}`
  );

  if (nonEditionMsIds.length === 0) {
    console.log("No non-edition manuscripts found — nothing to do.");
    return;
  }

  // 2. Fetch mismatched passages on non-edition manuscripts
  const CHUNK = 200; // avoid URL too long for large IN() clauses
  const mismatchedPassages = [];

  for (let i = 0; i < nonEditionMsIds.length; i += CHUNK) {
    const chunk = nonEditionMsIds.slice(i, i + CHUNK);
    const { data: passages, error: pErr } = await supabase
      .from("passages")
      .select("id, manuscript_id, reference, transcription_method")
      .in("manuscript_id", chunk)
      .in("transcription_method", MISMATCH_METHODS);

    if (pErr) {
      console.error("Error fetching passages:", pErr.message);
      process.exit(1);
    }
    if (passages) mismatchedPassages.push(...passages);
  }

  console.log(`\nMismatched passages found: ${mismatchedPassages.length}`);

  if (mismatchedPassages.length === 0) {
    console.log("Nothing to purge.");
    return;
  }

  // Print summary grouped by manuscript
  const byMs = new Map();
  for (const p of mismatchedPassages) {
    if (!byMs.has(p.manuscript_id)) byMs.set(p.manuscript_id, []);
    byMs.get(p.manuscript_id).push(p);
  }

  const msLookup = Object.fromEntries(manuscripts.map((m) => [m.id, m.title]));

  for (const [msId, passages] of byMs.entries()) {
    const counts = {};
    for (const p of passages) {
      counts[p.transcription_method] = (counts[p.transcription_method] ?? 0) + 1;
    }
    const summary = Object.entries(counts)
      .map(([m, n]) => `${n}x ${m}`)
      .join(", ");
    console.log(`  ${msLookup[msId] ?? msId}: ${passages.length} passages (${summary})`);
  }

  if (dryRun) {
    console.log(
      `\n[DRY RUN] Would delete ${mismatchedPassages.length} passages and their translations.`
    );
    console.log("Re-run with --confirm to execute.");
    return;
  }

  // 3. Collect passage IDs
  const passageIds = mismatchedPassages.map((p) => p.id);

  // 4. Delete in FK order: translation_versions → translations → passages
  let totalTvDeleted = 0;
  let totalTDeleted = 0;
  let totalPDeleted = 0;

  const BATCH = 200;

  for (let i = 0; i < passageIds.length; i += BATCH) {
    const batch = passageIds.slice(i, i + BATCH);

    // Get translation IDs for this batch of passages
    const { data: translations } = await supabase
      .from("translations")
      .select("id")
      .in("passage_id", batch);

    const translationIds = (translations ?? []).map((t) => t.id);

    // Delete translation_versions
    if (translationIds.length > 0) {
      const { error: tvErr, count: tvCount } = await supabase
        .from("translation_versions")
        .delete({ count: "exact" })
        .in("translation_id", translationIds);
      if (tvErr) console.error("Error deleting translation_versions:", tvErr.message);
      else totalTvDeleted += tvCount ?? 0;
    }

    // Delete translations
    const { error: tErr, count: tCount } = await supabase
      .from("translations")
      .delete({ count: "exact" })
      .in("passage_id", batch);
    if (tErr) console.error("Error deleting translations:", tErr.message);
    else totalTDeleted += tCount ?? 0;

    // Delete passages
    const { error: pErr, count: pCount } = await supabase
      .from("passages")
      .delete({ count: "exact" })
      .in("id", batch);
    if (pErr) console.error("Error deleting passages:", pErr.message);
    else totalPDeleted += pCount ?? 0;

    console.log(
      `  Batch ${Math.ceil((i + 1) / BATCH)}: deleted ${pCount ?? 0} passages, ` +
      `${tCount ?? 0} translations, ${tvCount ?? 0} translation_versions`
    );
  }

  console.log(
    `\nDone. Deleted ${totalPDeleted} passages, ` +
    `${totalTDeleted} translations, ${totalTvDeleted} translation_versions.`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
