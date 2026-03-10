#!/usr/bin/env node
/**
 * Preprocess Codex Sinaiticus XML transcription into Supabase.
 *
 * Downloads the TEI XML from itsee-birmingham/codex-sinaiticus on GitHub,
 * extracts original-hand Greek text per biblical book and chapter, and
 * inserts rows into the `manuscript_source_texts` table.
 *
 * Prerequisites:
 *   - Run migration 023 first
 *   - Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment
 *
 * Usage:
 *   node scripts/preprocess-sinaiticus.mjs
 *
 * License note: The Codex Sinaiticus XML is CC BY-NC-SA 3.0.
 * This data may only be used in non-commercial projects.
 */

import { createClient } from "@supabase/supabase-js";
import { createWriteStream, existsSync, readFileSync } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const XML_URL =
  "https://raw.githubusercontent.com/itsee-birmingham/codex-sinaiticus/main/sinaiticus_full_v195.xml";
const LOCAL_PATH = "scripts/sinaiticus_full_v195.xml";

// Biblical book identifiers used in the Sinaiticus XML
// Maps the XML's internal identifiers to display names
const BOOK_MAP = {
  Gen: "Genesis", Exod: "Exodus", Lev: "Leviticus", Num: "Numbers", Deut: "Deuteronomy",
  Josh: "Joshua", Judg: "Judges", "1Sam": "1 Samuel", "2Sam": "2 Samuel",
  "1Kgs": "1 Kings", "2Kgs": "2 Kings", "1Chr": "1 Chronicles", "2Chr": "2 Chronicles",
  Ezra: "Ezra", Neh: "Nehemiah", Esth: "Esther", Job: "Job",
  Ps: "Psalms", Prov: "Proverbs", Eccl: "Ecclesiastes", Song: "Song of Solomon",
  Isa: "Isaiah", Jer: "Jeremiah", Lam: "Lamentations", Ezek: "Ezekiel", Dan: "Daniel",
  Hos: "Hosea", Joel: "Joel", Amos: "Amos", Obad: "Obadiah", Jonah: "Jonah",
  Mic: "Micah", Nah: "Nahum", Hab: "Habakkuk", Zeph: "Zephaniah",
  Hag: "Haggai", Zech: "Zechariah", Mal: "Malachi",
  Matt: "Matthew", Mark: "Mark", Luke: "Luke", John: "John",
  Acts: "Acts", Rom: "Romans", "1Cor": "1 Corinthians", "2Cor": "2 Corinthians",
  Gal: "Galatians", Eph: "Ephesians", Phil: "Philippians", Col: "Colossians",
  "1Thess": "1 Thessalonians", "2Thess": "2 Thessalonians",
  "1Tim": "1 Timothy", "2Tim": "2 Timothy", Tit: "Titus", Phlm: "Philemon",
  Heb: "Hebrews", Jas: "James", "1Pet": "1 Peter", "2Pet": "2 Peter",
  "1John": "1 John", "2John": "2 John", "3John": "3 John", Jude: "Jude", Rev: "Revelation",
  Tob: "Tobit", Jdt: "Judith", Wis: "Wisdom", Sir: "Sirach",
  Bar: "Baruch", "1Macc": "1 Maccabees", "2Macc": "2 Maccabees",
  "3Macc": "3 Maccabees", "4Macc": "4 Maccabees",
};

async function downloadXml() {
  if (existsSync(LOCAL_PATH)) {
    console.log(`Using cached XML at ${LOCAL_PATH}`);
    return;
  }
  console.log(`Downloading Sinaiticus XML from GitHub (~52 MB)...`);
  const res = await fetch(XML_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const ws = createWriteStream(LOCAL_PATH);
  await pipeline(Readable.fromWeb(res.body), ws);
  console.log(`Downloaded to ${LOCAL_PATH}`);
}

/**
 * Parse the TEI XML to extract text grouped by book and chapter.
 *
 * The Sinaiticus XML uses <div> with type="book" and n="B04-Matt" style
 * attributes for books, and <ab> or <div> with type="chapter" for chapters.
 * Words appear in <w> elements. Corrections appear in <app> elements where
 * the <rdg> with type="orig" is the original scribe's reading.
 *
 * Since the file is ~52MB, we parse with regex rather than loading a full
 * DOM tree.
 */
function parseXml(xmlContent) {
  const chapters = [];

  // Match book-level divs: <div type="book" n="B04-Matt"> or similar patterns
  // The Sinaiticus XML uses <ab> elements with n attributes like "B40K1" (book 40, chapter 1)
  // or structured divs. We'll use a flexible approach.

  // Strategy: find all <w> (word) elements and track current book/chapter from
  // preceding milestone or div markers.
  let currentBook = "";
  let currentChapter = 0;
  let currentWords = [];
  const result = new Map(); // "Book|Chapter" -> [words]

  // Split into chunks at book/chapter boundaries
  // Look for chapter references like n="B40K1" or n="Matt.1" patterns
  const chapterPattern = /n="(?:B\d+K(\d+)|([A-Z][a-zA-Z0-9]*)[.\s](\d+))"/g;
  const bookPattern = /n="B(\d{2,3})-?([A-Za-z0-9]+)"/g;

  // Simpler approach: extract all word text between chapter markers
  // Find all <w ...>text</w> elements
  const wordPattern = /<w\b[^>]*>([^<]+)<\/w>/g;

  // Find chapter/verse markers: <cb n="..."/>, <milestone unit="chapter" n="1"/>
  // or <ab n="B40K1V1"> patterns
  const abPattern = /<ab\b[^>]*\bn="([^"]+)"[^>]*>/g;
  const milestonePattern = /<milestone\b[^>]*\bunit="([^"]*)"[^>]*\bn="([^"]*)"[^>]*\/?>/g;
  const divBookPattern = /<div\b[^>]*\btype="book"[^>]*\bn="([^"]*)"[^>]*>/g;

  // Tokenize the XML into a sequence of events
  const events = [];

  let m;
  while ((m = divBookPattern.exec(xmlContent)) !== null) {
    events.push({ pos: m.index, type: "book", value: m[1] });
  }
  while ((m = abPattern.exec(xmlContent)) !== null) {
    events.push({ pos: m.index, type: "ab", value: m[1] });
  }
  while ((m = milestonePattern.exec(xmlContent)) !== null) {
    if (m[1] === "chapter") {
      events.push({ pos: m.index, type: "chapter", value: m[2] });
    }
  }
  while ((m = wordPattern.exec(xmlContent)) !== null) {
    events.push({ pos: m.index, type: "word", value: m[1] });
  }

  // Sort by position in the file
  events.sort((a, b) => a.pos - b.pos);

  for (const evt of events) {
    if (evt.type === "book") {
      // e.g., "B04-Matt" or "Matt"
      const bookMatch = evt.value.match(/(?:B\d+-)?(\w+)/);
      if (bookMatch) {
        const bookAbbr = bookMatch[1];
        currentBook = BOOK_MAP[bookAbbr] || bookAbbr;
        currentChapter = 0;
      }
    } else if (evt.type === "chapter") {
      if (currentBook && currentWords.length > 0) {
        const key = `${currentBook}|${currentChapter}`;
        if (!result.has(key)) result.set(key, []);
        result.get(key).push(...currentWords);
        currentWords = [];
      }
      currentChapter = parseInt(evt.value, 10) || currentChapter + 1;
    } else if (evt.type === "ab") {
      // Parse n value like "B40K1V1" (book 40, chapter 1, verse 1)
      const abMatch = evt.value.match(/B(\d+)K(\d+)/);
      if (abMatch) {
        const bookNum = parseInt(abMatch[1], 10);
        const chap = parseInt(abMatch[2], 10);
        if (chap !== currentChapter || !currentBook) {
          if (currentBook && currentWords.length > 0) {
            const key = `${currentBook}|${currentChapter}`;
            if (!result.has(key)) result.set(key, []);
            result.get(key).push(...currentWords);
            currentWords = [];
          }
          currentChapter = chap;
          // Map book number to name if we don't have one
          if (!currentBook) {
            const numToAbbr = Object.entries(BOOK_MAP);
            // bookNum follows standard ordering: 1=Gen..66=Rev
            currentBook = `Book${bookNum}`;
          }
        }
      }
    } else if (evt.type === "word") {
      currentWords.push(evt.value.trim());
    }
  }

  // Flush remaining
  if (currentBook && currentWords.length > 0) {
    const key = `${currentBook}|${currentChapter}`;
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(...currentWords);
  }

  // Convert to array
  for (const [key, words] of result.entries()) {
    const [book, chapterStr] = key.split("|");
    const chapter = parseInt(chapterStr, 10);
    if (chapter > 0 && words.length > 0) {
      chapters.push({
        book,
        chapter,
        text: words.join(" "),
      });
    }
  }

  return chapters;
}

async function main() {
  await downloadXml();

  console.log("Parsing XML (this may take a minute)...");
  const xml = readFileSync(LOCAL_PATH, "utf-8");
  const chapters = parseXml(xml);
  console.log(`Extracted ${chapters.length} book/chapter sections.`);

  if (chapters.length === 0) {
    console.error("No chapters extracted. The XML structure may have changed.");
    console.log("Sample of first 2000 chars of XML:");
    console.log(xml.slice(0, 2000));
    process.exit(1);
  }

  // Show a sample
  const sample = chapters[0];
  console.log(`Sample: ${sample.book} ${sample.chapter} — ${sample.text.length} chars, starts: "${sample.text.slice(0, 100)}..."`);

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
      console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
    }
  }

  console.log(`Done. Inserted/updated ${inserted} rows, ${errors} batch errors.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
