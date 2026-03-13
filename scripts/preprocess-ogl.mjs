#!/usr/bin/env node
/**
 * Preprocess OpenGreekAndLatin / First1KGreek corpus into Supabase.
 *
 * Lists TEI XML files from the First1KGreek GitHub repository,
 * downloads and parses each work, and upserts rows into `manuscript_source_texts`.
 * Non-biblical works use work title as `book` and section number as `chapter`.
 *
 * Prerequisites:
 *   - Run migrations 023, 025, 026 first
 *   - Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env
 *   - Optional: GITHUB_TOKEN to avoid rate limiting
 *
 * Usage:
 *   node scripts/preprocess-ogl.mjs
 *
 * License: CC-BY or equivalent per work (see First1KGreek repository)
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

const CACHE_DIR = join(__dirname, "cache", "ogl");
const GITHUB_API = "https://api.github.com";
const OWNER = "OpenGreekAndLatin";
const REPO = "First1KGreek";
const DATA_PATH = "data";

// Limit to avoid an extremely long run. Increase or remove to import everything.
const MAX_WORKS = parseInt(process.env.OGL_MAX_WORKS ?? "200", 10);

const GITHUB_HEADERS = {
  Accept: "application/vnd.github.v3+json",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
    : {}),
};

/**
 * Parse a First1KGreek TEI XML file.
 *
 * The typical structure has divs at multiple levels. We look for:
 *   <div type="chapter" n="N">  or  <div type="section" n="N">
 * falling back to sequential section numbering for works without n= attributes.
 *
 * @param {string} xml
 * @param {string} workTitle  Used for logging only; book value is set by caller
 * @returns {{ chapter: number, text: string }[]}
 */
export function parseOglTei(xml, workTitle) {
  const sectionMap = new Map(); // section number → string[]

  // Try typed divs with n= attribute first
  const divRe = /<div\b[^>]*type="(?:chapter|section|book|textpart)"[^>]*n="(\d+)"[^>]*>/g;
  const positions = [];
  let m;
  while ((m = divRe.exec(xml)) !== null) {
    positions.push({ pos: m.index, section: parseInt(m[1], 10) });
  }

  if (positions.length === 0) {
    // No numbered divs — treat the whole work as section 1
    const words = extractGreekText(xml);
    if (words.length > 0) sectionMap.set(1, words);
  } else {
    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].pos;
      const end =
        i + 1 < positions.length ? positions[i + 1].pos : xml.length;
      const section = positions[i].section;
      if (section <= 0) continue;

      const slice = xml.slice(start, end);
      const words = extractGreekText(slice);
      if (words.length === 0) continue;

      if (!sectionMap.has(section)) sectionMap.set(section, []);
      const arr = sectionMap.get(section);
      for (const w of words) arr.push(w);
    }
  }

  const result = [];
  for (const [section, words] of sectionMap) {
    if (words.length > 0) {
      result.push({ chapter: section, text: words.join(" ") });
    }
  }
  return result.sort((a, b) => a.chapter - b.chapter);
}

/** Extract Greek text from arbitrary TEI XML fragment. */
function extractGreekText(fragment) {
  // Remove all XML tags; whatever remains is the text content.
  // Then filter to tokens that contain Greek Unicode characters.
  const noTags = fragment.replace(/<[^>]+>/g, " ");
  const tokens = noTags.split(/\s+/).filter((t) => t.length > 0);
  const greekTokens = tokens.filter((t) =>
    /[\u0370-\u03FF\u1F00-\u1FFF]/.test(t)
  );
  return greekTokens;
}

/** Extract a work title from a TEI XML header, falling back to filename. */
function extractTitle(xml, fallback) {
  const titleMatch = xml.match(/<title\b[^>]*>([^<]{3,100})<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].replace(/\s+/g, " ").trim();
  }
  return fallback;
}

async function listWorkDirs() {
  const url = `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${DATA_PATH}`;
  const res = await fetch(url, { headers: GITHUB_HEADERS });
  if (!res.ok) throw new Error(`GitHub API error listing data/: ${res.status}`);
  const items = await res.json();
  return items
    .filter((item) => item.type === "dir")
    .map((item) => item.name)
    .slice(0, MAX_WORKS);
}

async function listXmlFiles(dir) {
  const url = `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${DATA_PATH}/${dir}`;
  const res = await fetch(url, { headers: GITHUB_HEADERS });
  if (!res.ok) return [];
  const items = await res.json();

  const xmlFiles = items
    .filter((item) => item.type === "file" && item.name.endsWith(".xml"))
    .map((item) => ({ name: item.name, downloadUrl: item.download_url }));

  // OGL data has TWO levels of nesting: data/{work_dir}/{sub_dir}/{file}.xml
  // Recurse into any subdirectories found at the first level.
  const subdirs = items.filter((item) => item.type === "dir");
  for (const subdir of subdirs) {
    const subUrl = `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${DATA_PATH}/${dir}/${subdir.name}`;
    const subRes = await fetch(subUrl, { headers: GITHUB_HEADERS });
    if (!subRes.ok) continue;
    const subItems = await subRes.json();
    const subXmls = subItems
      .filter((item) => item.type === "file" && item.name.endsWith(".xml"))
      .map((item) => ({ name: item.name, downloadUrl: item.download_url }));
    xmlFiles.push(...subXmls);
  }

  return xmlFiles;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: GITHUB_HEADERS });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.text();
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  console.log(
    `Processing OpenGreekAndLatin First1KGreek (up to ${MAX_WORKS} works)...`
  );
  if (!process.env.GITHUB_TOKEN) {
    console.log("  No GITHUB_TOKEN set — may hit rate limits.");
  }

  let workDirs;
  try {
    workDirs = await listWorkDirs();
  } catch (err) {
    console.error("Failed to list work directories:", err.message);
    process.exit(1);
  }

  console.log(`Found ${workDirs.length} work directories.`);

  const allRows = [];
  let workErrors = 0;

  for (let wi = 0; wi < workDirs.length; wi++) {
    const dir = workDirs[wi];
    process.stdout.write(`\r  [${wi + 1}/${workDirs.length}] ${dir.padEnd(30)} rows so far: ${allRows.length}`);
    try {
      const files = await listXmlFiles(dir);
      if (files.length === 0) continue;

      for (const { name, downloadUrl } of files) {
        let xml;
        try {
          xml = await fetchText(downloadUrl);
        } catch (err) {
          console.warn(`  WARN ${dir}/${name}: ${err.message}`);
          continue;
        }

        const workTitle = extractTitle(xml, dir);
        const sections = parseOglTei(xml, workTitle);
        if (sections.length === 0) continue;

        for (const { chapter, text } of sections) {
          allRows.push({
            source: "first1k_greek",
            manuscript_name: workTitle,
            book: workTitle,
            chapter,
            text,
            metadata: {
              license: "CC-BY or equivalent",
              repository: "OpenGreekAndLatin/First1KGreek",
              dir,
              file: name,
            },
          });
        }
      }

      // Courtesy delay for GitHub API
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.error(`  ERROR ${dir}: ${err.message}`);
      workErrors++;
    }
  }

  console.log(
    `\n\nExtracted ${allRows.length} section rows (${workErrors} work errors).`
  );

  if (allRows.length === 0) {
    console.warn("No rows extracted. Check GitHub API access.");
    process.exit(0);
  }

  // Deduplicate by (source, manuscript_name, book, chapter) — keep longest text.
  // Some OGL works have multiple XML files that produce the same section numbers.
  const deduped = new Map();
  for (const row of allRows) {
    const key = `${row.source}|${row.manuscript_name}|${row.book}|${row.chapter}`;
    const existing = deduped.get(key);
    if (!existing || row.text.length > existing.text.length) {
      deduped.set(key, row);
    }
  }
  const dedupedRows = Array.from(deduped.values());
  if (dedupedRows.length < allRows.length) {
    console.log(`Deduplicated to ${dedupedRows.length} rows (removed ${allRows.length - dedupedRows.length} duplicates).`);
  }

  let inserted = 0;
  let errors = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < dedupedRows.length; i += BATCH_SIZE) {
    const batch = dedupedRows.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from("manuscript_source_texts")
      .upsert(batch, { onConflict: "source,manuscript_name,book,chapter" });

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
      if (inserted % 500 === 0) {
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
