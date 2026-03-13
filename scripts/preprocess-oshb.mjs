#!/usr/bin/env node
/**
 * Preprocess Open Scriptures Hebrew Bible (OSHB) into Supabase.
 *
 * Reuses the same OSIS XML source as preprocess-wlc.mjs (openscriptures/morphhb)
 * but stores rows under source="oshb" / manuscript_name="Open Scriptures Hebrew Bible".
 * This gives the OSHB its own addressable source ID separate from WLC.
 *
 * Prerequisites:
 *   - Run migrations 023, 025, 026 first
 *   - Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 *
 * Usage:
 *   node scripts/preprocess-oshb.mjs
 *
 * License: CC BY 4.0 (openscriptures/morphhb)
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { parseOsisBook } from "./preprocess-wlc.mjs";

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

// Reuse the WLC cache directory — same source files
const WLC_CACHE_DIR = join(__dirname, "cache", "wlc");
const CACHE_DIR = join(__dirname, "cache", "oshb");

const BASE_URL =
  "https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc/";

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

async function downloadBook(fileBase) {
  // Prefer WLC cache to avoid double-downloading the same files
  const wlcPath = join(WLC_CACHE_DIR, `${fileBase}.xml`);
  if (existsSync(wlcPath)) {
    return readFileSync(wlcPath, "utf-8");
  }
  const oshbPath = join(CACHE_DIR, `${fileBase}.xml`);
  if (existsSync(oshbPath)) {
    return readFileSync(oshbPath, "utf-8");
  }
  const url = `${BASE_URL}${fileBase}.xml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed for ${fileBase}: ${res.status}`);
  const text = await res.text();
  writeFileSync(oshbPath, text, "utf-8");
  return text;
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  console.log("Processing Open Scriptures Hebrew Bible (39 OT books)...");

  const allChapters = [];
  let bookErrors = 0;

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

  let inserted = 0;
  let errors = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < allChapters.length; i += BATCH_SIZE) {
    const batch = allChapters.slice(i, i + BATCH_SIZE).map((ch) => ({
      source: "oshb",
      manuscript_name: "Open Scriptures Hebrew Bible",
      book: ch.book,
      chapter: ch.chapter,
      text: ch.text,
      metadata: {
        license: "CC BY 4.0",
        repository: "openscriptures/morphhb",
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
