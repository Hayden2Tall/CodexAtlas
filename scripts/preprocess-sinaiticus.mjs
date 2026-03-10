#!/usr/bin/env node
/**
 * Preprocess Codex Sinaiticus XML transcription into Supabase.
 *
 * Downloads the TEI XML from itsee-birmingham/codex-sinaiticus on GitHub,
 * extracts original-hand Greek text per biblical book and chapter, and
 * upserts rows into the `manuscript_source_texts` table.
 *
 * Prerequisites:
 *   - Run migration 023 first
 *   - Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 *
 * Usage:
 *   node scripts/preprocess-sinaiticus.mjs
 *
 * License note: The Codex Sinaiticus XML is CC BY-NC-SA 3.0.
 * This data may only be used in non-commercial projects.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createWriteStream, existsSync, readFileSync } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

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

const XML_URL =
  "https://raw.githubusercontent.com/itsee-birmingham/codex-sinaiticus/main/sinaiticus_full_v195.xml";
const LOCAL_PATH = join(__dirname, "sinaiticus_full_v195.xml");

// Map the 4-letter abbreviation from xml:id (e.g. "GEN", "MATT") to display name.
// The XML uses ids like B-B1-01-GEN, B-B33-33-MATT, etc.
const ABBR_MAP = {
  FRAG: null, // skip fragments
  GEN: "Genesis",
  LEV: "Leviticus",
  NUM: "Numbers",
  DEUT: "Deuteronomy",
  JOSH: "Joshua",
  JUDG: "Judges",
  "1SAM": "1 Samuel",
  "2SAM": "2 Samuel",
  "1KGS": "1 Kings",
  "2KGS": "2 Kings",
  "1CHR": "1 Chronicles",
  "2CHR": "2 Chronicles",
  "2ESD": "2 Esdras",
  EST: "Esther",
  TOB: "Tobit",
  JDT: "Judith",
  "1MACC": "1 Maccabees",
  "4MACC": "4 Maccabees",
  ISA: "Isaiah",
  JER: "Jeremiah",
  LAM: "Lamentations",
  JOEL: "Joel",
  OBAD: "Obadiah",
  JONAH: "Jonah",
  NAH: "Nahum",
  HAB: "Habakkuk",
  ZEPH: "Zephaniah",
  HAG: "Haggai",
  ZECH: "Zechariah",
  MAL: "Malachi",
  PS: "Psalms",
  PROV: "Proverbs",
  ECCL: "Ecclesiastes",
  CANT: "Song of Solomon",
  WIS: "Wisdom",
  SIR: "Sirach",
  JOB: "Job",
  MATT: "Matthew",
  MARK: "Mark",
  LUKE: "Luke",
  JOHN: "John",
  ROM: "Romans",
  "1COR": "1 Corinthians",
  "2COR": "2 Corinthians",
  GAL: "Galatians",
  EPH: "Ephesians",
  PHIL: "Philippians",
  COL: "Colossians",
  "1THESS": "1 Thessalonians",
  "2THESS": "2 Thessalonians",
  HEB: "Hebrews",
  "1TIM": "1 Timothy",
  "2TIM": "2 Timothy",
  TITUS: "Titus",
  PHLM: "Philemon",
  ACTS: "Acts",
  JAS: "James",
  "1PET": "1 Peter",
  "2PET": "2 Peter",
  "1JOHN": "1 John",
  "2JOHN": "2 John",
  "3JOHN": "3 John",
  JUDE: "Jude",
  REV: "Revelation",
  BARN: "Epistle of Barnabas",
  HERM: "Shepherd of Hermas",
};

async function downloadXml() {
  if (existsSync(LOCAL_PATH)) {
    console.log(`Using cached XML at ${LOCAL_PATH}`);
    return;
  }
  console.log("Downloading Sinaiticus XML from GitHub (~52 MB)...");
  const res = await fetch(XML_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const ws = createWriteStream(LOCAL_PATH);
  await pipeline(Readable.fromWeb(res.body), ws);
  console.log(`Downloaded to ${LOCAL_PATH}`);
}

/**
 * Parse the TEI XML using structural div boundaries.
 *
 * Structure discovered in v1.95:
 *   <div type="book" xml:id="B-B{n}-{nn}-{ABBR}" n="{n}" title="...">
 *     <div type="chapter" xml:id="K-B{bookN}K{chapN}V{verseN}-{nn}-{ABBR}" n="{chapN}">
 *       <ab ...><w ...>word</w> ...</ab>
 *     </div>
 *   </div>
 *
 * We split at book boundaries, then chapter boundaries, then extract <w> text.
 */
function parseXml(xml) {
  const results = new Map(); // "BookName|chapter" -> string[]

  // Split into book sections at <div type="book" ...> boundaries
  const bookDivRegex = /<div\b[^>]*type="book"[^>]*>/g;
  const bookPositions = [];
  let m;
  while ((m = bookDivRegex.exec(xml)) !== null) {
    const tag = m[0];
    const idMatch = tag.match(/xml:id="B-B\d+-\d+-([A-Z0-9]+)"/);
    const abbr = idMatch ? idMatch[1] : null;
    bookPositions.push({ pos: m.index, abbr });
  }

  console.log(`Found ${bookPositions.length} book sections in XML.`);

  for (let bi = 0; bi < bookPositions.length; bi++) {
    const { pos: bookStart, abbr } = bookPositions[bi];
    const bookEnd =
      bi + 1 < bookPositions.length ? bookPositions[bi + 1].pos : xml.length;

    const bookName = abbr ? ABBR_MAP[abbr] : null;
    if (bookName === null || bookName === undefined) {
      if (abbr) console.log(`  Skipping unmapped book abbreviation: ${abbr}`);
      continue;
    }

    const bookSlice = xml.slice(bookStart, bookEnd);

    // Find chapter boundaries within this book section
    const chapDivRegex = /<div\b[^>]*type="chapter"[^>]*>/g;
    const chapPositions = [];
    let cm;
    while ((cm = chapDivRegex.exec(bookSlice)) !== null) {
      const chapTag = cm[0];
      const nMatch = chapTag.match(/\bn="(\d+)"/);
      const chapNum = nMatch ? parseInt(nMatch[1], 10) : 0;
      chapPositions.push({ pos: cm.index, chapter: chapNum });
    }

    if (chapPositions.length === 0) {
      // No chapter subdivisions; treat entire book as chapter 1
      const words = extractWords(bookSlice);
      if (words.length > 0) {
        const key = `${bookName}|1`;
        if (!results.has(key)) results.set(key, []);
        const arr = results.get(key);
        for (const w of words) arr.push(w);
      }
      continue;
    }

    for (let ci = 0; ci < chapPositions.length; ci++) {
      const chapStart = chapPositions[ci].pos;
      const chapEnd =
        ci + 1 < chapPositions.length
          ? chapPositions[ci + 1].pos
          : bookSlice.length;
      const chapNum = chapPositions[ci].chapter;
      if (chapNum <= 0) continue;

      const chapSlice = bookSlice.slice(chapStart, chapEnd);
      const words = extractWords(chapSlice);
      if (words.length === 0) continue;

      const key = `${bookName}|${chapNum}`;
      if (!results.has(key)) results.set(key, []);
      const arr = results.get(key);
      for (const w of words) arr.push(w);
    }
  }

  // Convert to output array
  const chapters = [];
  for (const [key, words] of results) {
    const [book, chapStr] = key.split("|");
    const chapter = parseInt(chapStr, 10);
    if (chapter > 0 && words.length > 0) {
      chapters.push({ book, chapter, text: words.join(" ") });
    }
  }

  return chapters;
}

/** Extract all word text from <w ...>text</w> elements in an XML fragment. */
function extractWords(xmlFragment) {
  const words = [];
  const re = /<w\b[^>]*>([^<]+)<\/w>/g;
  let m;
  while ((m = re.exec(xmlFragment)) !== null) {
    const t = m[1].trim();
    if (t) words.push(t);
  }
  return words;
}

async function main() {
  await downloadXml();

  console.log("Parsing XML (this may take a minute)...");
  const xml = readFileSync(LOCAL_PATH, "utf-8");
  const chapters = parseXml(xml);
  console.log(`Extracted ${chapters.length} book/chapter sections.`);

  if (chapters.length === 0) {
    console.error("No chapters extracted. The XML structure may have changed.");
    process.exit(1);
  }

  const sample = chapters[0];
  console.log(
    `Sample: ${sample.book} ${sample.chapter} — ${sample.text.length} chars, starts: "${sample.text.slice(0, 80)}..."`
  );

  // Upsert into Supabase
  let inserted = 0;
  let errors = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < chapters.length; i += BATCH_SIZE) {
    const batch = chapters.slice(i, i + BATCH_SIZE).map((ch) => ({
      source: "sinaiticus_project",
      manuscript_name: "Codex Sinaiticus",
      book: ch.book,
      chapter: ch.chapter,
      text: ch.text,
      metadata: { version: "v195", license: "CC BY-NC-SA 3.0" },
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
