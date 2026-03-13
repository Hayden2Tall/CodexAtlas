#!/usr/bin/env node
/**
 * Preprocess Coptic Scriptorium corpora into Supabase.
 *
 * Downloads TEI XML files from CopticScriptorium/corpora on GitHub,
 * extracts Coptic text per chapter/section, and upserts rows into
 * `manuscript_source_texts`.
 *
 * Processes one file at a time to avoid OOM issues (large corpus ~2.2M tokens).
 *
 * Prerequisites:
 *   - Run migrations 023, 025, 026 first
 *   - Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 *   - Optional: GITHUB_TOKEN to avoid rate limiting on the GitHub API
 *
 * Usage:
 *   node scripts/preprocess-coptic.mjs
 *
 * License: CC BY 4.0 (primary license for Coptic Scriptorium)
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync } from "fs";

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

const CACHE_DIR = join(__dirname, "cache", "coptic");
const GITHUB_API = "https://api.github.com";
const OWNER = "CopticScriptorium";
const REPO = "corpora";

// NT corpus directories to target (Sahidic New Testament)
// These directory names are stable in the CopticScriptorium/corpora repo
const TARGET_DIRS = [
  "sahidic-nt-matthew",
  "sahidic-nt-mark",
  "sahidic-nt-luke",
  "sahidic-nt-john",
  "sahidic-nt-acts",
  "sahidic-nt-romans",
  "sahidic-nt-1corinthians",
  "sahidic-nt-2corinthians",
  "sahidic-nt-galatians",
  "sahidic-nt-ephesians",
  "sahidic-nt-philippians",
  "sahidic-nt-colossians",
  "sahidic-nt-1thessalonians",
  "sahidic-nt-2thessalonians",
  "sahidic-nt-1timothy",
  "sahidic-nt-2timothy",
  "sahidic-nt-titus",
  "sahidic-nt-philemon",
  "sahidic-nt-hebrews",
  "sahidic-nt-james",
  "sahidic-nt-1peter",
  "sahidic-nt-2peter",
  "sahidic-nt-1john",
  "sahidic-nt-2john",
  "sahidic-nt-3john",
  "sahidic-nt-jude",
  "sahidic-nt-revelation",
];

// Dir name suffix → display name
const DIR_TO_BOOK = {
  matthew: "Matthew", mark: "Mark", luke: "Luke", john: "John",
  acts: "Acts", romans: "Romans",
  "1corinthians": "1 Corinthians", "2corinthians": "2 Corinthians",
  galatians: "Galatians", ephesians: "Ephesians", philippians: "Philippians",
  colossians: "Colossians",
  "1thessalonians": "1 Thessalonians", "2thessalonians": "2 Thessalonians",
  "1timothy": "1 Timothy", "2timothy": "2 Timothy",
  titus: "Titus", philemon: "Philemon", hebrews: "Hebrews",
  james: "James", "1peter": "1 Peter", "2peter": "2 Peter",
  "1john": "1 John", "2john": "2 John", "3john": "3 John",
  jude: "Jude", revelation: "Revelation",
};

function bookFromDir(dir) {
  // e.g. "sahidic-nt-matthew" → "matthew"
  const suffix = dir.replace("sahidic-nt-", "");
  return DIR_TO_BOOK[suffix] ?? suffix;
}

const GITHUB_HEADERS = {
  Accept: "application/vnd.github.v3+json",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
    : {}),
};

/**
 * Parse a Coptic Scriptorium TEI XML file.
 * Extracts text per chapter/section div.
 *
 * TEI structure (typical):
 *   <div type="textpart" subtype="chapter" n="1">
 *     <w xml:lang="cop">...Coptic word...</w>
 *   </div>
 *
 * @param {string} xml
 * @param {string} defaultBook
 * @returns {{ chapter: number, text: string }[]}
 */
export function parseCopticTei(xml, defaultBook) {
  const chapterMap = new Map(); // chapter number → string[]

  // Find chapter divs
  const divRe = /<div\b[^>]*subtype="chapter"[^>]*n="(\d+)"[^>]*>/g;
  const divPositions = [];
  let m;
  while ((m = divRe.exec(xml)) !== null) {
    divPositions.push({ pos: m.index, chapter: parseInt(m[1], 10) });
  }

  if (divPositions.length === 0) {
    // No chapter divs — try section divs
    const secRe = /<div\b[^>]*type="(?:textpart|section)"[^>]*n="(\d+)"[^>]*>/g;
    while ((m = secRe.exec(xml)) !== null) {
      divPositions.push({ pos: m.index, chapter: parseInt(m[1], 10) });
    }
  }

  if (divPositions.length === 0) {
    // Treat entire file as chapter 1
    const words = extractCopticWords(xml);
    if (words.length > 0) {
      chapterMap.set(1, words);
    }
  } else {
    for (let i = 0; i < divPositions.length; i++) {
      const start = divPositions[i].pos;
      const end =
        i + 1 < divPositions.length ? divPositions[i + 1].pos : xml.length;
      const chapter = divPositions[i].chapter;
      if (chapter <= 0) continue;

      const slice = xml.slice(start, end);
      const words = extractCopticWords(slice);
      if (words.length === 0) continue;

      if (!chapterMap.has(chapter)) chapterMap.set(chapter, []);
      const arr = chapterMap.get(chapter);
      for (const w of words) arr.push(w);
    }
  }

  const result = [];
  for (const [chapter, words] of chapterMap) {
    result.push({ chapter, text: words.join(" ") });
  }
  return result.sort((a, b) => a.chapter - b.chapter);
}

/** Extract Coptic word tokens from <w> and <orig>/<reg> elements. */
function extractCopticWords(fragment) {
  const words = [];
  // <w xml:lang="cop">WORD</w> or <w>WORD</w>
  const wRe = /<w\b[^>]*>([^<]+)<\/w>/g;
  let m;
  while ((m = wRe.exec(fragment)) !== null) {
    const t = m[1].trim();
    if (t) words.push(t);
  }
  // Fallback: <reg>WORD</reg> or <orig>WORD</orig>
  if (words.length === 0) {
    const regRe = /<(?:reg|orig)\b[^>]*>([^<]+)<\/(?:reg|orig)>/g;
    while ((m = regRe.exec(fragment)) !== null) {
      const t = m[1].trim();
      if (t) words.push(t);
    }
  }
  return words;
}

async function listXmlFiles(dir) {
  const url = `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${dir}`;
  const res = await fetch(url, { headers: GITHUB_HEADERS });
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`GitHub API error for ${dir}: ${res.status}`);
  }
  const items = await res.json();
  return items
    .filter((item) => item.type === "file" && item.name.endsWith(".xml"))
    .map((item) => ({ name: item.name, downloadUrl: item.download_url }));
}

async function fetchXml(downloadUrl) {
  const res = await fetch(downloadUrl, { headers: GITHUB_HEADERS });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.text();
}

async function processDir(dir) {
  const bookName = bookFromDir(dir);
  const allChapters = [];

  let files;
  try {
    files = await listXmlFiles(dir);
  } catch (err) {
    console.warn(`  SKIP ${dir}: ${err.message}`);
    return [];
  }

  if (files.length === 0) {
    console.log(`  ${bookName}: no XML files found`);
    return [];
  }

  for (const { name, downloadUrl } of files) {
    try {
      const xml = await fetchXml(downloadUrl);
      const chapters = parseCopticTei(xml, bookName);
      for (const ch of chapters) {
        allChapters.push({ book: bookName, chapter: ch.chapter, text: ch.text });
      }
    } catch (err) {
      console.warn(`    WARN ${name}: ${err.message}`);
    }
  }

  // Merge chapters from multiple files (some books split by chapter file)
  const merged = new Map();
  for (const { book, chapter, text } of allChapters) {
    const key = chapter;
    if (merged.has(key)) {
      merged.set(key, merged.get(key) + " " + text);
    } else {
      merged.set(key, text);
    }
  }

  const result = [];
  for (const [chapter, text] of merged) {
    result.push({ book: bookName, chapter, text });
  }
  console.log(`  ${bookName}: ${result.length} chapters from ${files.length} files`);
  return result;
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  console.log("Processing Coptic Scriptorium (Sahidic NT)...");
  console.log(
    process.env.GITHUB_TOKEN
      ? "  Using GITHUB_TOKEN for API requests."
      : "  No GITHUB_TOKEN set — may hit rate limits."
  );

  const allChapters = [];
  let dirErrors = 0;

  for (const dir of TARGET_DIRS) {
    try {
      const chapters = await processDir(dir);
      allChapters.push(...chapters);
      // Small delay to be courteous to GitHub API
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`  ERROR ${dir}: ${err.message}`);
      dirErrors++;
    }
  }

  console.log(
    `\nExtracted ${allChapters.length} book/chapter sections (${dirErrors} directory errors).`
  );

  if (allChapters.length === 0) {
    console.warn("No chapters extracted. Check GitHub API access.");
    process.exit(0);
  }

  let inserted = 0;
  let errors = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < allChapters.length; i += BATCH_SIZE) {
    const batch = allChapters.slice(i, i + BATCH_SIZE).map((ch) => ({
      source: "coptic_scriptorium",
      manuscript_name: "Coptic Scriptorium (Sahidic NT)",
      book: ch.book,
      chapter: ch.chapter,
      text: ch.text,
      metadata: {
        license: "CC BY 4.0",
        repository: "CopticScriptorium/corpora",
        dialect: "Sahidic",
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
