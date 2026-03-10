/**
 * Preprocess ETCBC Dead Sea Scrolls data into Supabase.
 *
 * Downloads the ETCBC/dss Text-Fabric feature files from GitHub,
 * extracts Hebrew text per biblical book and chapter, and upserts
 * rows into the `manuscript_source_texts` table.
 *
 * Prerequisites:
 *   Run migration 023 first.
 *   Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and
 *   SUPABASE_SERVICE_ROLE_KEY in environment.
 *
 * Usage:
 *   node scripts/preprocess-dss.mjs
 *
 * License: The ETCBC/dss data is CC BY-NC 4.0.
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
  console.error(
    "Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TF_BASE =
  "https://raw.githubusercontent.com/ETCBC/dss/master/tf/1.8.1";

const ETCBC_TO_HEBREW = {
  ">": "\u05D0", // alef
  B: "\u05D1",   // bet
  G: "\u05D2",   // gimel
  D: "\u05D3",   // dalet
  H: "\u05D4",   // he
  W: "\u05D5",   // vav
  Z: "\u05D6",   // zayin
  X: "\u05D7",   // chet
  V: "\u05D8",   // tet
  J: "\u05D9",   // yod
  K: "\u05DB",   // kaf
  L: "\u05DC",   // lamed
  M: "\u05DE",   // mem
  N: "\u05E0",   // nun
  S: "\u05E1",   // samekh
  "<": "\u05E2",  // ayin
  P: "\u05E4",   // pe
  Y: "\u05E6",   // tsade
  Q: "\u05E7",   // qof
  R: "\u05E8",   // resh
  F: "\u05E9",   // sin (ש)
  C: "\u05E9",   // shin (ש) — same base letter
  T: "\u05EA",   // tav
};

function translitToHebrew(etcbc) {
  if (!etcbc || !etcbc.trim()) return "";
  let result = "";
  for (let i = 0; i < etcbc.length; i++) {
    const ch = etcbc[i];
    if (ch === " ") {
      result += " ";
    } else if (ETCBC_TO_HEBREW[ch]) {
      result += ETCBC_TO_HEBREW[ch];
    }
    // Skip unknown chars (diacritics, markers, etc.)
  }
  return result;
}

const BOOK_DISPLAY = {
  Gen: "Genesis", Ex: "Exodus", Exod: "Exodus", Lev: "Leviticus",
  Num: "Numbers", Deut: "Deuteronomy", Josh: "Joshua", Judg: "Judges",
  Ruth: "Ruth", "1Sam": "1 Samuel", "2Sam": "2 Samuel",
  "1Kgs": "1 Kings", "2Kgs": "2 Kings",
  Is: "Isaiah", Isa: "Isaiah", Jer: "Jeremiah", Ezek: "Ezekiel",
  Hos: "Hosea", Joel: "Joel", Amos: "Amos", Obad: "Obadiah",
  Jonah: "Jonah", Mic: "Micah", Nah: "Nahum", Hab: "Habakkuk",
  Zeph: "Zephaniah", Hag: "Haggai", Zech: "Zechariah", Mal: "Malachi",
  Ps: "Psalms", Prov: "Proverbs", Job: "Job", Song: "Song of Solomon",
  Qoh: "Ecclesiastes", Eccl: "Ecclesiastes", Lam: "Lamentations",
  Dan: "Daniel", Esth: "Esther", Ezra: "Ezra", Neh: "Nehemiah",
  "1Chr": "1 Chronicles", "2Chr": "2 Chronicles",
  Genesis: "Genesis", Exodus: "Exodus", Leviticus: "Leviticus",
  Numbers: "Numbers", Deuteronomy: "Deuteronomy", Joshua: "Joshua",
  Judges: "Judges", Isaiah: "Isaiah", Jeremiah: "Jeremiah",
  Ezekiel: "Ezekiel", Hosea: "Hosea", Joel: "Joel", Amos: "Amos",
  Obadiah: "Obadiah", Jonah: "Jonah", Micah: "Micah", Nahum: "Nahum",
  Habakkuk: "Habakkuk", Zephaniah: "Zephaniah", Haggai: "Haggai",
  Zechariah: "Zechariah", Malachi: "Malachi", Psalms: "Psalms",
  Proverbs: "Proverbs", Daniel: "Daniel", Esther: "Esther",
  Nehemiah: "Nehemiah",
};

/**
 * Parse a Text-Fabric .tf feature file into a Map<nodeNumber, value>.
 *
 * TF format after the header (blank-line separated):
 *   - "1234 value"  → explicit node number + value
 *   - "value"       → next sequential node (previous + 1)
 *   - empty line    → next sequential node, empty value
 */
function parseTfFeature(raw) {
  const lines = raw.split("\n");
  const features = new Map();
  let inHeader = true;
  let currentNode = 0;

  for (const line of lines) {
    if (inHeader) {
      if (line === "") {
        inHeader = false;
      }
      continue;
    }

    if (line === "") {
      currentNode++;
      continue;
    }

    const spaceIdx = line.indexOf(" ");
    const firstToken = spaceIdx === -1 ? line : line.substring(0, spaceIdx);
    const asNum = Number(firstToken);

    if (!isNaN(asNum) && Number.isInteger(asNum) && asNum > 0 && spaceIdx !== -1) {
      currentNode = asNum;
      features.set(currentNode, line.substring(spaceIdx + 1));
    } else {
      currentNode++;
      features.set(currentNode, line);
    }
  }
  return features;
}

async function fetchTfFile(name) {
  const url = `${TF_BASE}/${name}`;
  console.log(`Fetching ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.status}`);
  return res.text();
}

async function main() {
  console.log("Downloading ETCBC/dss Text-Fabric feature files...");

  const [bookRaw, chapterRaw, gconsRaw] = await Promise.all([
    fetchTfFile("book.tf"),
    fetchTfFile("chapter.tf"),
    fetchTfFile("g_cons.tf"),
  ]);

  console.log("Parsing features...");
  const bookMap = parseTfFeature(bookRaw);
  const chapterMap = parseTfFeature(chapterRaw);
  const gconsMap = parseTfFeature(gconsRaw);

  console.log(
    `Parsed — book: ${bookMap.size} nodes, chapter: ${chapterMap.size} nodes, g_cons: ${gconsMap.size} nodes`
  );

  // Join by node number: only nodes present in all three maps
  const grouped = new Map(); // key: "book|chapter" → words[]

  for (const [node, cons] of gconsMap) {
    const book = bookMap.get(node);
    const chapter = chapterMap.get(node);
    if (!book || !chapter || !cons.trim()) continue;

    const key = `${book}|${chapter}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(cons);
  }

  console.log(`Grouped into ${grouped.size} book/chapter sections.`);

  const rows = [];
  for (const [key, words] of grouped) {
    const [bookAbbrev, chapterStr] = key.split("|");
    const chapterNum = parseInt(chapterStr, 10);
    if (isNaN(chapterNum)) continue;

    const rawText = words.join(" ");
    const hebrewText = translitToHebrew(rawText);
    if (hebrewText.replace(/\s/g, "").length < 5) continue;

    const bookDisplay = BOOK_DISPLAY[bookAbbrev];
    if (!bookDisplay) {
      // Skip scroll-specific identifiers (e.g. "1Q8") that aren't biblical books
      continue;
    }

    rows.push({
      source: "etcbc_dss",
      manuscript_name: "Dead Sea Scrolls (ETCBC)",
      book: bookDisplay,
      chapter: chapterNum,
      text: hebrewText,
      metadata: {
        book_abbrev: bookAbbrev,
        license: "CC BY-NC 4.0",
        corpus: "ETCBC/dss",
        transliteration_source: "g_cons",
      },
    });
  }

  console.log(`Prepared ${rows.length} rows for insertion.`);

  if (rows.length === 0) {
    console.error("No data extracted. The Text-Fabric data format may have changed.");
    process.exit(1);
  }

  const sample = rows[0];
  console.log(
    `Sample: ${sample.book} ${sample.chapter} — ${sample.text.substring(0, 80)}...`
  );

  const BATCH_SIZE = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await supabase
        .from("manuscript_source_texts")
        .upsert(batch, { onConflict: "source,manuscript_name,book,chapter" });
      if (error) throw error;
      inserted += batch.length;
    } catch (e) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, e.message || e);
      errors++;
    }
  }

  console.log(`Done. Inserted/updated ${inserted} rows, ${errors} batch errors.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
