#!/usr/bin/env node
/**
 * Preprocess Coptic Scriptorium (Sahidica NT) into Supabase.
 *
 * Downloads CoNLL-U files from CopticScriptorium/corpora on GitHub.
 * The actual data lives in:
 *   sahidica.nt/sahidica.nt_CONLLU/
 *
 * Files are named: {booknum}_{Book}_{chapter}.conllu
 * e.g., 40_Matthew_01.conllu, 41_Mark_01.conllu
 *
 * CoNLL-U format (tab-separated, 10 columns per word line):
 *   ID  FORM  LEMMA  UPOS  XPOS  FEATS  HEAD  DEPREL  DEPS  MISC
 * Column 1 (FORM) is the Coptic word token.
 * Lines starting with '#' are comments; blank lines separate sentences.
 *
 * Prerequisites:
 *   - Run migrations 023, 025, 026 first
 *   - Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 *   - Optional: GITHUB_TOKEN to avoid rate limiting
 *
 * Usage:
 *   node scripts/preprocess-coptic.mjs
 *
 * License: CC BY 4.0 (primary license for Coptic Scriptorium)
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "fs";

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
const CONLLU_DIR = "sahidica.nt/sahidica.nt_CONLLU";

const GITHUB_HEADERS = {
  Accept: "application/vnd.github.v3+json",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
    : {}),
};

/**
 * Parse a CoNLL-U file and return the word tokens as a single text string.
 * Column index 1 (FORM) is the Coptic word.
 *
 * @param {string} content - Raw CoNLL-U file content
 * @returns {string} - Space-joined word tokens
 */
export function parseConllu(content) {
  const words = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const cols = line.split("\t");
    if (cols.length < 2) continue;

    // Skip multi-word tokens (IDs like "1-2") and empty nodes (IDs like "1.1")
    const id = cols[0];
    if (id.includes("-") || id.includes(".")) continue;

    const form = cols[1].trim();
    if (form && form !== "_") words.push(form);
  }
  return words.join(" ");
}

/**
 * Parse filename like "40_Matthew_01.conllu" into { book, chapter }.
 * Returns null if the filename doesn't match the expected pattern.
 */
function parseFilename(name) {
  const m = name.match(/^\d+_(.+?)_(\d+)\.conllu$/);
  if (!m) return null;
  const book = m[1]; // e.g., "Matthew", "1Corinthians"
  // Normalise book names with numbers: "1Corinthians" → "1 Corinthians"
  const displayBook = book.replace(/^(\d)([A-Z])/, "$1 $2");
  const chapter = parseInt(m[2], 10);
  return { book: displayBook, chapter };
}

async function listConlluFiles() {
  const url = `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${CONLLU_DIR}`;
  const res = await fetch(url, { headers: GITHUB_HEADERS });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} — ${url}`);
  const items = await res.json();
  return items
    .filter((item) => item.type === "file" && item.name.endsWith(".conllu"))
    .map((item) => ({ name: item.name, downloadUrl: item.download_url }));
}

async function fetchText(url) {
  const res = await fetch(url, { headers: GITHUB_HEADERS });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.text();
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  console.log("Processing Coptic Scriptorium (Sahidica NT — CoNLL-U)...");
  console.log(
    process.env.GITHUB_TOKEN
      ? "  Using GITHUB_TOKEN for API requests."
      : "  No GITHUB_TOKEN — may hit rate limits."
  );

  let files;
  try {
    files = await listConlluFiles();
  } catch (err) {
    console.error("Failed to list CoNLL-U files:", err.message);
    process.exit(1);
  }

  console.log(`  Found ${files.length} chapter files.`);

  const allChapters = [];
  let fileErrors = 0;

  for (const { name, downloadUrl } of files) {
    const parsed = parseFilename(name);
    if (!parsed) {
      console.warn(`  SKIP ${name}: unrecognised filename pattern`);
      continue;
    }

    let content;
    try {
      content = await fetchText(downloadUrl);
    } catch (err) {
      console.warn(`  WARN ${name}: ${err.message}`);
      fileErrors++;
      continue;
    }

    const text = parseConllu(content);
    if (!text) {
      console.warn(`  WARN ${name}: no words extracted`);
      continue;
    }

    allChapters.push({ book: parsed.book, chapter: parsed.chapter, text });

    // Small courtesy delay
    await new Promise((r) => setTimeout(r, 100));
  }

  // Group chapters by book for summary
  const bookCounts = new Map();
  for (const { book } of allChapters) {
    bookCounts.set(book, (bookCounts.get(book) ?? 0) + 1);
  }
  for (const [book, count] of bookCounts) {
    console.log(`  ${book}: ${count} chapters`);
  }

  console.log(
    `\nExtracted ${allChapters.length} chapters (${fileErrors} file errors).`
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
        format: "CoNLL-U",
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
