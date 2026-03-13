#!/usr/bin/env node
/**
 * Preprocess SBL Greek New Testament (SBLGNT) into Supabase.
 *
 * Downloads plain-text book files from LogosBible/SBLGNT on GitHub,
 * groups verses by chapter, and upserts rows into `manuscript_source_texts`.
 * After this runs, the section-text chain queries the DB instead of live GitHub.
 *
 * Prerequisites:
 *   - Run migrations 023, 025, 026 first
 *   - Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 *
 * Usage:
 *   node scripts/preprocess-sblgnt.mjs
 *
 * License: CC BY 4.0 (LogosBible/SBLGNT)
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

const CACHE_DIR = join(__dirname, "cache", "sblgnt");
const BASE_URL =
  "https://raw.githubusercontent.com/LogosBible/SBLGNT/master/data/sblgnt/text/";

// NT books: { sblAbbr, display, chapters } — chapter counts for iteration
const NT_BOOKS = [
  { sbl: "Matt", display: "Matthew", chapters: 28 },
  { sbl: "Mark", display: "Mark", chapters: 16 },
  { sbl: "Luke", display: "Luke", chapters: 24 },
  { sbl: "John", display: "John", chapters: 21 },
  { sbl: "Acts", display: "Acts", chapters: 28 },
  { sbl: "Rom", display: "Romans", chapters: 16 },
  { sbl: "1Cor", display: "1 Corinthians", chapters: 16 },
  { sbl: "2Cor", display: "2 Corinthians", chapters: 13 },
  { sbl: "Gal", display: "Galatians", chapters: 6 },
  { sbl: "Eph", display: "Ephesians", chapters: 6 },
  { sbl: "Phil", display: "Philippians", chapters: 4 },
  { sbl: "Col", display: "Colossians", chapters: 4 },
  { sbl: "1Thess", display: "1 Thessalonians", chapters: 5 },
  { sbl: "2Thess", display: "2 Thessalonians", chapters: 3 },
  { sbl: "1Tim", display: "1 Timothy", chapters: 6 },
  { sbl: "2Tim", display: "2 Timothy", chapters: 4 },
  { sbl: "Titus", display: "Titus", chapters: 3 },
  { sbl: "Phlm", display: "Philemon", chapters: 1 },
  { sbl: "Heb", display: "Hebrews", chapters: 13 },
  { sbl: "Jas", display: "James", chapters: 5 },
  { sbl: "1Pet", display: "1 Peter", chapters: 5 },
  { sbl: "2Pet", display: "2 Peter", chapters: 3 },
  { sbl: "1John", display: "1 John", chapters: 5 },
  { sbl: "2John", display: "2 John", chapters: 1 },
  { sbl: "3John", display: "3 John", chapters: 1 },
  { sbl: "Jude", display: "Jude", chapters: 1 },
  { sbl: "Rev", display: "Revelation", chapters: 22 },
];

/**
 * Given full text of one SBLGNT book file and a chapter number,
 * extract all verses for that chapter as a single string.
 *
 * Lines look like: `Matt 1:1 Βίβλος γενέσεως ...`
 *
 * @param {string} fullText
 * @param {string} sblBook  SBL abbreviation, e.g. "Matt"
 * @param {number} chapter
 * @returns {string}
 */
export function parseSblgntChapter(fullText, sblBook, chapter) {
  const prefix = `${sblBook} ${chapter}:`;
  const verses = fullText
    .split("\n")
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.replace(/^\S+\s+\d+:\d+\s+/, "").trim())
    .filter(Boolean);
  return verses.join(" ");
}

async function downloadBook(sblAbbr) {
  const url = `${BASE_URL}${sblAbbr}.txt`;
  const cachePath = join(CACHE_DIR, `${sblAbbr}.txt`);
  if (existsSync(cachePath)) {
    return readFileSync(cachePath, "utf-8");
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed for ${sblAbbr}: ${res.status}`);
  const text = await res.text();
  writeFileSync(cachePath, text, "utf-8");
  return text;
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  console.log("Processing SBLGNT (27 NT books)...");

  const allChapters = [];
  let bookErrors = 0;

  for (const { sbl, display, chapters } of NT_BOOKS) {
    try {
      const text = await downloadBook(sbl);
      for (let ch = 1; ch <= chapters; ch++) {
        const chText = parseSblgntChapter(text, sbl, ch);
        if (chText.length > 0) {
          allChapters.push({ book: display, chapter: ch, text: chText });
        }
      }
      console.log(`  ${display}: ${chapters} chapters`);
    } catch (err) {
      console.error(`  ERROR downloading ${display}: ${err.message}`);
      bookErrors++;
    }
  }

  console.log(
    `\nExtracted ${allChapters.length} book/chapter sections (${bookErrors} book errors).`
  );

  if (allChapters.length === 0) {
    console.error("No chapters extracted.");
    process.exit(1);
  }

  let inserted = 0;
  let errors = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < allChapters.length; i += BATCH_SIZE) {
    const batch = allChapters.slice(i, i + BATCH_SIZE).map((ch) => ({
      source: "sblgnt",
      manuscript_name: "SBLGNT",
      book: ch.book,
      chapter: ch.chapter,
      text: ch.text,
      metadata: { license: "CC BY 4.0", repository: "LogosBible/SBLGNT" },
    }));

    const { error } = await supabase
      .from("manuscript_source_texts")
      .upsert(batch, { onConflict: "source,manuscript_name,book,chapter" });

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
      if (inserted % 200 === 0) {
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
