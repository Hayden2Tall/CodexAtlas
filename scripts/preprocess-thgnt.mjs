#!/usr/bin/env node
/**
 * Preprocess Translators Amalgamated Greek NT (TAGNT) into Supabase.
 *
 * Downloads TAGNT from STEPBible/STEPBible-Data on GitHub (two files:
 * Mat-Jhn and Act-Rev), extracts the Greek word text per chapter, and
 * upserts rows into `manuscript_source_texts` with source='thgnt'.
 *
 * TAGNT includes text from THGNT (Tyndale House GNT), NA27/28, SBL, TR,
 * WH, Treg, and Byz editions. It is the closest publicly available
 * verse-aligned Greek NT dataset from STEPBible.
 *
 * Data format (tab-separated, one word per line):
 *   Mat.1.1#01=NKO  Βίβλος (Biblos)  [The] book  G0976=N-NSF  ...
 *
 * Prerequisites:
 *   - Run migrations 023, 025, 026 first
 *   - Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 *
 * Usage:
 *   node scripts/preprocess-thgnt.mjs
 *
 * License: CC BY 4.0 (STEPBible.org / Tyndale House)
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

const BASE =
  "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/";

const DATA_FILES = [
  {
    filename: "tagnt-mat-jhn.txt",
    url: BASE + "TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt",
  },
  {
    filename: "tagnt-act-rev.txt",
    url: BASE + "TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt",
  },
];

// TAGNT book abbreviation → display name
const BOOK_DISPLAY = {
  Mat: "Matthew", Mrk: "Mark", Luk: "Luke", Jhn: "John",
  Act: "Acts", Rom: "Romans",
  "1Co": "1 Corinthians", "2Co": "2 Corinthians",
  Gal: "Galatians", Eph: "Ephesians", Php: "Philippians",
  Col: "Colossians", "1Th": "1 Thessalonians", "2Th": "2 Thessalonians",
  "1Ti": "1 Timothy", "2Ti": "2 Timothy",
  Tit: "Titus", Phm: "Philemon", Heb: "Hebrews",
  Jas: "James", "1Pe": "1 Peter", "2Pe": "2 Peter",
  "1Jn": "1 John", "2Jn": "2 John", "3Jn": "3 John",
  Jud: "Jude", Rev: "Revelation",
};

/**
 * Parse TAGNT file content.
 * Data lines (not header/comment lines) look like:
 *   Mat.1.1#01=NKO\tΒίβλος (Biblos)\t[The] book\tG0976=N-NSF\t...
 *
 * Reference format: Book.chapter.verse#wordnum=editions
 * Greek word (col 1): may include transliteration in parens — strip it.
 *
 * @param {string} content - Raw file text
 * @returns {{ book: string, chapter: number, text: string }[]}
 */
export function parseTagnt(content) {
  const chapterMap = new Map(); // "BOOK|ch" → string[]

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip BOM, header lines, and comment lines (no tab before a reference-like token)
    const tabIdx = line.indexOf("\t");
    if (tabIdx === -1) continue;

    const refCol = line.slice(0, tabIdx).trim();
    // Reference must match: Book.chapter.verse#... (e.g., Mat.1.1#01=NKO)
    const refMatch = refCol.match(/^([A-Z][a-z0-9]{1,2})\.(\d+)\.\d+#/);
    if (!refMatch) continue;

    const [, bookAbbr, chapStr] = refMatch;
    const chapter = parseInt(chapStr, 10);
    const display = BOOK_DISPLAY[bookAbbr];
    if (!display) continue;

    // Greek word is the second column
    const rest = line.slice(tabIdx + 1);
    const secondTabIdx = rest.indexOf("\t");
    const greekCol = (secondTabIdx === -1 ? rest : rest.slice(0, secondTabIdx)).trim();

    // Strip transliteration in parentheses: "Βίβλος (Biblos)" → "Βίβλος"
    const greek = greekCol.replace(/\s*\([^)]+\)$/, "").trim();
    if (!greek || !/[\u0370-\u03FF\u1F00-\u1FFF]/.test(greek)) continue;

    const key = `${display}|${chapter}`;
    if (!chapterMap.has(key)) chapterMap.set(key, []);
    chapterMap.get(key).push(greek);
  }

  const result = [];
  for (const [key, words] of chapterMap) {
    const [book, chapStr] = key.split("|");
    result.push({ book, chapter: parseInt(chapStr, 10), text: words.join(" ") });
  }
  return result.sort((a, b) => {
    if (a.book !== b.book) return a.book.localeCompare(b.book);
    return a.chapter - b.chapter;
  });
}

async function downloadFile({ filename, url }) {
  const cachePath = join(CACHE_DIR, filename);
  if (existsSync(cachePath)) {
    console.log(`  Using cached ${filename}`);
    return readFileSync(cachePath, "utf-8");
  }
  console.log(`  Downloading ${filename}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const text = await res.text();
  writeFileSync(cachePath, text, "utf-8");
  return text;
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  console.log("Processing TAGNT (Translators Amalgamated Greek NT, 2 files)...");

  const allChapters = [];

  for (const fileInfo of DATA_FILES) {
    let content;
    try {
      content = await downloadFile(fileInfo);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      process.exit(1);
    }
    const chapters = parseTagnt(content);
    console.log(`  ${fileInfo.filename}: ${chapters.length} chapters`);
    allChapters.push(...chapters);
  }

  console.log(`\nExtracted ${allChapters.length} total chapters.`);

  if (allChapters.length === 0) {
    console.error("No chapters extracted. File format may have changed.");
    process.exit(1);
  }

  const sample = allChapters[0];
  console.log(`Sample: ${sample.book} ${sample.chapter} — ${sample.text.length} chars`);

  let inserted = 0;
  let errors = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < allChapters.length; i += BATCH_SIZE) {
    const batch = allChapters.slice(i, i + BATCH_SIZE).map((ch) => ({
      source: "thgnt",
      manuscript_name: "Tyndale House GNT",
      book: ch.book,
      chapter: ch.chapter,
      text: ch.text,
      metadata: {
        license: "CC BY 4.0",
        repository: "STEPBible/STEPBible-Data",
        actual_source: "TAGNT (Translators Amalgamated Greek NT, includes THGNT)",
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

  console.log(`\nDone. Inserted/updated ${inserted} rows, ${errors} batch errors.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
