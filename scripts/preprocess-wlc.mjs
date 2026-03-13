#!/usr/bin/env node
/**
 * Preprocess Westminster Leningrad Codex (WLC) into Supabase.
 *
 * Downloads OSIS XML book files from openscriptures/morphhb on GitHub,
 * extracts Hebrew text per chapter (stripping morphological tags), and
 * upserts rows into the `manuscript_source_texts` table.
 *
 * Prerequisites:
 *   - Run migrations 023, 025, 026 first
 *   - Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 *
 * Usage:
 *   node scripts/preprocess-wlc.mjs
 *
 * License: Public domain (tanach.us UXLC / openscriptures morphhb)
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

const CACHE_DIR = join(__dirname, "cache", "wlc");

// OSIS file names in the openscriptures/morphhb repository
const OT_BOOKS = [
  { file: "Gen", display: "Genesis" },
  { file: "Exod", display: "Exodus" },
  { file: "Lev", display: "Leviticus" },
  { file: "Num", display: "Numbers" },
  { file: "Deut", display: "Deuteronomy" },
  { file: "Josh", display: "Joshua" },
  { file: "Judg", display: "Judges" },
  { file: "Ruth", display: "Ruth" },
  { file: "1Sam", display: "1 Samuel" },
  { file: "2Sam", display: "2 Samuel" },
  { file: "1Kgs", display: "1 Kings" },
  { file: "2Kgs", display: "2 Kings" },
  { file: "1Chr", display: "1 Chronicles" },
  { file: "2Chr", display: "2 Chronicles" },
  { file: "Ezra", display: "Ezra" },
  { file: "Neh", display: "Nehemiah" },
  { file: "Esth", display: "Esther" },
  { file: "Job", display: "Job" },
  { file: "Ps", display: "Psalms" },
  { file: "Prov", display: "Proverbs" },
  { file: "Eccl", display: "Ecclesiastes" },
  { file: "Song", display: "Song of Solomon" },
  { file: "Isa", display: "Isaiah" },
  { file: "Jer", display: "Jeremiah" },
  { file: "Lam", display: "Lamentations" },
  { file: "Ezek", display: "Ezekiel" },
  { file: "Dan", display: "Daniel" },
  { file: "Hos", display: "Hosea" },
  { file: "Joel", display: "Joel" },
  { file: "Amos", display: "Amos" },
  { file: "Obad", display: "Obadiah" },
  { file: "Jonah", display: "Jonah" },
  { file: "Mic", display: "Micah" },
  { file: "Nah", display: "Nahum" },
  { file: "Hab", display: "Habakkuk" },
  { file: "Zeph", display: "Zephaniah" },
  { file: "Hag", display: "Haggai" },
  { file: "Zech", display: "Zechariah" },
  { file: "Mal", display: "Malachi" },
];

const BASE_URL =
  "https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc/";

/**
 * Parse an OSIS XML file for a single WLC book.
 * Returns an array of { chapter: number, text: string }.
 *
 * OSIS verse IDs look like: Gen.1.1, Gen.1.2 …
 * We group by chapter number extracted from the middle segment.
 *
 * @param {string} xml - Raw OSIS XML string
 * @returns {{ chapter: number, text: string }[]}
 */
export function parseOsisBook(xml) {
  const chapterMap = new Map(); // chapter number -> string[]

  // Match <verse osisID="Book.chap.verse">…</verse>
  // The OSIS files may use <verse sID="..."/> (milestone) and <verse eID="..."/>
  // OR <verse osisID="...">content</verse> (container). Handle both.

  // Strategy: collect all w/seg/divineName elements per verse, group by chapter.
  // Each word is in a <w lemma="..." morph="...">HEBREW</w> or <seg>HEBREW</seg>
  const verseRe = /osisID="[^.]+\.(\d+)\.\d+"/g;
  let m;

  // Collect verse start positions with chapter numbers
  const versePositions = [];
  while ((m = verseRe.exec(xml)) !== null) {
    const chapter = parseInt(m[1], 10);
    versePositions.push({ pos: m.index, chapter });
  }

  if (versePositions.length === 0) return [];

  // For each verse, extract Hebrew text from its vicinity
  for (let vi = 0; vi < versePositions.length; vi++) {
    const { pos, chapter } = versePositions[vi];
    // Slice from this verse marker to the next (or 2000 chars forward)
    const end =
      vi + 1 < versePositions.length
        ? versePositions[vi + 1].pos
        : Math.min(pos + 2000, xml.length);
    const slice = xml.slice(pos, end);

    const words = extractHebrew(slice);
    if (words.length === 0) continue;

    if (!chapterMap.has(chapter)) chapterMap.set(chapter, []);
    const arr = chapterMap.get(chapter);
    for (const w of words) arr.push(w);
  }

  const result = [];
  for (const [chapter, words] of chapterMap) {
    if (words.length > 0) {
      result.push({ chapter, text: words.join(" ") });
    }
  }
  return result.sort((a, b) => a.chapter - b.chapter);
}

/** Extract Hebrew word tokens from an XML fragment (w elements and seg/note-free text). */
function extractHebrew(fragment) {
  const words = [];
  // <w lemma="..." morph="...">WORD</w>  (most common)
  const wRe = /<w\b[^>]*>([^<]+)<\/w>/g;
  let m;
  while ((m = wRe.exec(fragment)) !== null) {
    const t = m[1].trim();
    if (t) words.push(t);
  }
  // Some OSIS files use <seg type="x-maqqef">-</seg>
  const segRe = /<seg\b[^>]*>([^<]+)<\/seg>/g;
  while ((m = segRe.exec(fragment)) !== null) {
    const t = m[1].trim();
    if (t && t !== "-") words.push(t);
  }
  return words;
}

async function downloadBook(fileBase) {
  const url = `${BASE_URL}${fileBase}.xml`;
  const cachePath = join(CACHE_DIR, `${fileBase}.xml`);
  if (existsSync(cachePath)) {
    return readFileSync(cachePath, "utf-8");
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed for ${fileBase}: ${res.status}`);
  const text = await res.text();
  writeFileSync(cachePath, text, "utf-8");
  return text;
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  console.log("Processing Westminster Leningrad Codex (39 OT books)...");

  const allChapters = [];
  let bookErrors = 0;

  // Download all books with concurrency limit of 5
  const CONCURRENCY = 5;
  for (let i = 0; i < OT_BOOKS.length; i += CONCURRENCY) {
    const batch = OT_BOOKS.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ({ file, display }) => {
        try {
          const xml = await downloadBook(file);
          const chapters = parseOsisBook(xml);
          for (const ch of chapters) {
            allChapters.push({ book: display, chapter: ch.chapter, text: ch.text });
          }
          console.log(`  ${display}: ${chapters.length} chapters`);
        } catch (err) {
          console.error(`  ERROR downloading ${display}: ${err.message}`);
          bookErrors++;
        }
      })
    );
  }

  console.log(
    `\nExtracted ${allChapters.length} book/chapter sections (${bookErrors} book errors).`
  );

  if (allChapters.length === 0) {
    console.error("No chapters extracted.");
    process.exit(1);
  }

  // Upsert into Supabase
  let inserted = 0;
  let errors = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < allChapters.length; i += BATCH_SIZE) {
    const batch = allChapters.slice(i, i + BATCH_SIZE).map((ch) => ({
      source: "wlc",
      manuscript_name: "Westminster Leningrad Codex",
      book: ch.book,
      chapter: ch.chapter,
      text: ch.text,
      metadata: { license: "Public domain", repository: "openscriptures/morphhb" },
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

// Only run when executed directly, not when imported by preprocess-oshb.mjs
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
