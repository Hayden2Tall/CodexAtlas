#!/usr/bin/env node
/**
 * Debug script: inspect passages for a given book to diagnose visibility issues.
 * Usage: node scripts/debug-passages.mjs [book-name]
 * Example: node scripts/debug-passages.mjs psalms
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, "../app/package.json"));
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const bookArg = (process.argv[2] ?? "psalm").toLowerCase();

console.log(`\n=== Searching passages where reference ILIKE '%${bookArg}%' ===\n`);

// 1. All passages matching the book name (any format)
const { data: passages, error } = await supabase
  .from("passages")
  .select("id, reference, manuscript_id, original_text, transcription_method, created_at")
  .ilike("reference", `%${bookArg}%`)
  .order("reference");

if (error) {
  console.error("Query error:", error.message);
  process.exit(1);
}

if (!passages?.length) {
  console.log("NO PASSAGES FOUND matching that pattern.");
  process.exit(0);
}

console.log(`Found ${passages.length} passages:\n`);

// Group by manuscript_id
const byMs = new Map();
for (const p of passages) {
  if (!byMs.has(p.manuscript_id)) byMs.set(p.manuscript_id, []);
  byMs.get(p.manuscript_id).push(p);
}

// Look up manuscript titles
const msIds = [...byMs.keys()];
const { data: manuscripts } = await supabase
  .from("manuscripts")
  .select("id, title, archived_at")
  .in("id", msIds);

const msMap = Object.fromEntries((manuscripts ?? []).map((m) => [m.id, m]));

// Look up translations for these passage IDs
const passageIds = passages.map((p) => p.id);
const { data: translations } = await supabase
  .from("translations")
  .select("passage_id, target_language, current_version_id")
  .in("passage_id", passageIds);

const translationsByPassage = new Map();
for (const t of translations ?? []) {
  if (!translationsByPassage.has(t.passage_id)) translationsByPassage.set(t.passage_id, []);
  translationsByPassage.get(t.passage_id).push(t);
}

for (const [msId, msPassages] of byMs) {
  const ms = msMap[msId];
  console.log(`\nManuscript: ${ms?.title ?? msId} ${ms?.archived_at ? "[ARCHIVED]" : ""}`);
  console.log(`  ID: ${msId}`);

  for (const p of msPassages) {
    const textLen = p.original_text?.trim().length ?? 0;
    const hasText = textLen > 0;
    const textNull = p.original_text === null;
    const txls = translationsByPassage.get(p.id) ?? [];

    console.log(`\n  Reference : "${p.reference}"`);
    console.log(`  Passage ID: ${p.id}`);
    console.log(`  Text      : ${textNull ? "NULL" : hasText ? `${textLen} chars` : "EMPTY STRING"}`);
    console.log(`  Method    : ${p.transcription_method ?? "null"}`);
    console.log(`  Created   : ${p.created_at}`);
    console.log(`  Translations: ${txls.length > 0 ? txls.map(t => `${t.target_language} (version_id: ${t.current_version_id ?? "none"})`).join(", ") : "none"}`);

    // Simulate what loadChapterData ilike would match
    const refLower = p.reference.toLowerCase();
    const chapterMatch = refLower.match(/^(.+?)\s+(\d+)/);
    if (chapterMatch) {
      console.log(`  Parsed book: "${chapterMatch[1]}", chapter: ${chapterMatch[2]}`);
      console.log(`  Visible in read page: ${hasText && !textNull ? "YES (if route matches book alias)" : "NO (no text)"}`);
    }
  }
}

console.log("\n\n=== Summary ===");
console.log(`Total passages: ${passages.length}`);
console.log(`With non-null text: ${passages.filter(p => p.original_text !== null).length}`);
console.log(`With text > 0 chars: ${passages.filter(p => (p.original_text?.trim().length ?? 0) > 0).length}`);
console.log(`With text >= 100 chars (section-text threshold): ${passages.filter(p => (p.original_text?.trim().length ?? 0) >= 100).length}`);
console.log(`With translations: ${passages.filter(p => (translationsByPassage.get(p.id)?.length ?? 0) > 0).length}`);

// Check which chapters exist in the data
const chapters = new Set();
for (const p of passages) {
  const m = p.reference.match(/^.+?\s+(\d+)/);
  if (m) chapters.add(parseInt(m[1]));
}
console.log(`\nChapters found: ${[...chapters].sort((a,b) => a-b).join(", ")}`);
