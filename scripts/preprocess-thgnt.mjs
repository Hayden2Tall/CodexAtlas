#!/usr/bin/env node
/**
 * Preprocess Tyndale House Greek New Testament (THGNT) into Supabase.
 *
 * Downloads the THGNT TSV file from STEPBible/STEPBible-Data on GitHub,
 * groups verses by book and chapter, and upserts rows into `manuscript_source_texts`.
 *
 * Prerequisites:
 *   - Run migrations 023, 025, 026 first
 *   - Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 *
 * Usage:
 *   node scripts/preprocess-thgnt.mjs
 *
 * License: CC BY 4.0 (Tyndale House / STEPBible)
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

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

const CACHE_DIR = join(__dirname, "cache", "thgnt");
// Note: URL-encode the space in the path
const DATA_URL =
  "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Transliterated%20OT%20and%20NT/THGNT%20-%20Tyndale%20House%20GNT.txt";

// SBL abbreviation → display name (NT only)
const SBL_TO_DISPLAY = {
  Matt: "Matthew", Mrk: "Mark", Luk: "Luke", Jhn: "John",
  Act: "Acts", Rom: "Romans",
  "1Co": "1 Corinthians", "2Co": "2 Corinthians",
  Gal: "Galatians", Eph: "Ephesians", Php: "Philippians",
  Col: "Colossians", "1Th": "1 Thessalonians", "2Th": "2 Thessalonians",
  "1Ti": "1 Timothy", "2Ti": "2 Timothy", Tit: "Titus",
  Phm: "Philemon", Heb: "Hebrews", Jas: "James",
  "1Pe": "1 Peter", "2Pe": "2 Peter",
  "1Jn": "1 John", "2Jn": "2 John", "3Jn": "3 John",
  Jud: "Jude", Rev: "Revelation",
  // Alternative abbreviation styles sometimes used in STEPBible data
  Mark: "Mark", Luke: "Luke", John: "John", Acts: "Acts",
  Romans: "Romans", Galatians: "Galatians", Ephesians: "Ephesians",
  Philippians: "Philippians", Colossians: "Colossians",
  Philemon: "Philemon", Hebrews: "Hebrews", James: "James",
  Jude: "Jude", Revelation: "Revelation",
};

/**
 * Parse THGNT TSV content into book/chapter/text records.
 *
 * Lines (after header) look like:
 *   JHN 1:1\t{Greek text}
 * or sometimes tab-separated columns where col[0] = "MAT 1:1" and later cols have text.
 *
 * @param {string} content - Raw file content
 * @returns {{ book: string, chapter: number, text: string }[]}
 */
export function parseThgntTsv(content) {
  const chapterMap = new Map(); // "BOOK|chapter" → string[]

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    // Expect: "ABC 1:2\tGreek text" or tab-delimited with ref in first column
    const tabIdx = line.indexOf("\t");
    if (tabIdx === -1) continue;

    const ref = line.slice(0, tabIdx).trim();
    // ref looks like "MAT 1:1" or "JHN 3:16"
    const refMatch = ref.match(/^([A-Z0-9]{2,5})\s+(\d+):(\d+)$/);
    if (!refMatch) continue;

    const [, bookAbbr, chapStr] = refMatch;
    const chapter = parseInt(chapStr, 10);

    // Remaining columns after the first tab — join as text (skip Strong/morph cols if present)
    const rest = line.slice(tabIdx + 1).trim();
    // Extract only Greek text: skip columns that look like Strong numbers (G1234) or morph codes
    const greekText = extractGreekFromTsvRow(rest);
    if (!greekText) continue;

    const key = `${bookAbbr}|${chapter}`;
    if (!chapterMap.has(key)) chapterMap.set(key, []);
    chapterMap.get(key).push(greekText);
  }

  const result = [];
  for (const [key, verses] of chapterMap) {
    const [bookAbbr, chapStr] = key.split("|");
    const display = SBL_TO_DISPLAY[bookAbbr] ?? bookAbbr;
    const chapter = parseInt(chapStr, 10);
    result.push({ book: display, chapter, text: verses.join(" ") });
  }

  return result.sort((a, b) => a.chapter - b.chapter);
}

/**
 * From a TSV row's remaining columns, extract the Greek text portion.
 * Some STEPBible files interleave Strong numbers and morphology codes.
 * We collect tokens that contain Greek Unicode characters.
 */
function extractGreekFromTsvRow(rest) {
  // If only one column (plain Greek), return it
  if (!rest.includes("\t")) {
    const clean = rest.replace(/[^\u0370-\u03FF\u1F00-\u1FFF\s]/g, "").trim();
    return clean || rest.trim();
  }

  const cols = rest.split("\t");
  const greekTokens = [];
  for (const col of cols) {
    const t = col.trim();
    // Is this column primarily Greek script?
    const greekChars = (t.match(/[\u0370-\u03FF\u1F00-\u1FFF]/g) ?? []).length;
    if (greekChars > t.length * 0.3) {
      greekTokens.push(t);
    }
  }
  return greekTokens.join(" ").trim();
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  const cachePath = join(CACHE_DIR, "thgnt.txt");
  let content;

  if (existsSync(cachePath)) {
    console.log("Using cached THGNT file.");
    content = readFileSync(cachePath, "utf-8");
  } else {
    console.log("Downloading THGNT from STEPBible-Data (~5 MB)...");
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    content = await res.text();
    writeFileSync(cachePath, content, "utf-8");
    console.log("Downloaded.");
  }

  console.log("Parsing THGNT...");
  const chapters = parseThgntTsv(content);
  console.log(`Extracted ${chapters.length} book/chapter sections.`);

  if (chapters.length === 0) {
    console.error("No chapters extracted. File format may have changed.");
    process.exit(1);
  }

  const sample = chapters[0];
  console.log(
    `Sample: ${sample.book} ${sample.chapter} — ${sample.text.length} chars`
  );

  let inserted = 0;
  let errors = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < chapters.length; i += BATCH_SIZE) {
    const batch = chapters.slice(i, i + BATCH_SIZE).map((ch) => ({
      source: "thgnt",
      manuscript_name: "Tyndale House GNT",
      book: ch.book,
      chapter: ch.chapter,
      text: ch.text,
      metadata: {
        license: "CC BY 4.0",
        repository: "STEPBible/STEPBible-Data",
      },
    }));

    const { error } = await supabase
      .from("manuscript_source_texts")
      .upsert(batch, { onConflict: "source,manuscript_name,book,chapter" });

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
      if (inserted % 100 === 0) {
        console.log(`  Upserted ${inserted} rows so far...`);
      }
    }
  }

  console.log(
    `\nDone. Inserted/updated ${inserted} rows, ${errors} batch errors.`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
