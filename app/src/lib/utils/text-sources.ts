/**
 * Pure functions and constants for the text source chain.
 *
 * Extracted from the section-text API route so they can be unit-tested
 * without network access. The route imports these; tests exercise them directly.
 */

// ---------------------------------------------------------------------------
// Book / Chapter parsing
// ---------------------------------------------------------------------------

/** Standard Bible book name → bolls.life API bookid (1-66 Protestant, 67+ LXX). */
export const BOOK_NUMBERS: Record<string, number> = {
  genesis: 1, exodus: 2, leviticus: 3, numbers: 4, deuteronomy: 5,
  joshua: 6, judges: 7, ruth: 8, "1 samuel": 9, "2 samuel": 10,
  "1 kings": 11, "2 kings": 12, "1 chronicles": 13, "2 chronicles": 14,
  ezra: 15, nehemiah: 16, esther: 17, job: 18, psalms: 19, psalm: 19,
  proverbs: 20, ecclesiastes: 21, "song of solomon": 22, "song of songs": 22,
  canticles: 22, isaiah: 23, jeremiah: 24, lamentations: 25, ezekiel: 26,
  daniel: 27, hosea: 28, joel: 29, amos: 30, obadiah: 31, jonah: 32,
  micah: 33, nahum: 34, habakkuk: 35, zephaniah: 36, haggai: 37,
  zechariah: 38, malachi: 39,
  matthew: 40, mark: 41, luke: 42, john: 43, acts: 44, romans: 45,
  "1 corinthians": 46, "2 corinthians": 47, galatians: 48, ephesians: 49,
  philippians: 50, colossians: 51, "1 thessalonians": 52, "2 thessalonians": 53,
  "1 timothy": 54, "2 timothy": 55, titus: 56, philemon: 57, hebrews: 58,
  james: 59, "1 peter": 60, "2 peter": 61, "1 john": 62, "2 john": 63,
  "3 john": 64, jude: 65, revelation: 66,
  "1 esdras": 67, "3 ezra": 67, "esdras a": 67,
  tobit: 68,
  judith: 69,
  wisdom: 70, "wisdom of solomon": 70,
  sirach: 71, ecclesiasticus: 71, "wisdom of sirach": 71, "ben sira": 71,
  baruch: 73, "letter of jeremiah": 73, "epistle of jeremiah": 73,
  "1 maccabees": 74, "2 maccabees": 75, "3 maccabees": 76, "4 maccabees": 80,
  susanna: 78, "bel and the dragon": 79,
  "psalms of solomon": 85, odes: 86, "odæs": 86, ode: 86,
};

/** Gregory-Aland manuscript name → NTVMR docID. */
export const NTVMR_MANUSCRIPTS: Record<string, number> = {
  "codex sinaiticus": 20001,
  sinaiticus: 20001,
  "codex vaticanus": 20003,
  vaticanus: 20003,
  "codex alexandrinus": 20002,
  alexandrinus: 20002,
  "codex ephraemi": 20004,
  "codex ephraemi rescriptus": 20004,
  ephraemi: 20004,
  "codex bezae": 20005,
  bezae: 20005,
  "codex claromontanus": 20006,
  claromontanus: 20006,
  "codex washingtonianus": 20032,
  washingtonianus: 20032,
  "codex regius": 20019,
  p46: 10046,
  p66: 10066,
  p75: 10075,
  p45: 10045,
  p47: 10047,
  p72: 10072,
};

/** Book name → SBL abbreviation (NT books only; shared by NTVMR + SBLGNT). */
export const NT_SBL_BOOKS: Record<string, string> = {
  matthew: "Matt", mark: "Mark", luke: "Luke", john: "John",
  acts: "Acts", romans: "Rom",
  "1 corinthians": "1Cor", "2 corinthians": "2Cor",
  galatians: "Gal", ephesians: "Eph", philippians: "Phil",
  colossians: "Col", "1 thessalonians": "1Thess", "2 thessalonians": "2Thess",
  "1 timothy": "1Tim", "2 timothy": "2Tim", titus: "Titus",
  philemon: "Phlm", hebrews: "Heb", james: "Jas",
  "1 peter": "1Pet", "2 peter": "2Pet",
  "1 john": "1John", "2 john": "2John", "3 john": "3John",
  jude: "Jude", revelation: "Rev",
};

/** Manuscript titles that map to the Leningrad Codex (WLC source). */
export const LENINGRAD_TITLES = new Set([
  "leningrad codex",
  "codex leningradensis",
  "firkovich b 19a",
  "leningradensis",
]);

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a reference like "Matthew 1" or "1 Corinthians 3" into
 * a bolls.life book number + chapter number.
 */
export function parseBookAndChapter(
  reference: string
): { bookNum: number; chapter: number } | null {
  const match = reference.match(/^(.+?)\s+(\d+)$/);
  if (!match) return null;
  const bookName = match[1].toLowerCase().trim();
  const chapter = parseInt(match[2], 10);
  const bookNum = BOOK_NUMBERS[bookName];
  if (!bookNum || isNaN(chapter)) return null;
  return { bookNum, chapter };
}

/**
 * Returns true when at least 15 % of the text is in the expected script
 * (Greek or Hebrew). Used to reject AI refusals and wrong-language text.
 */
export function textHasCorrectScript(
  text: string,
  lang: string
): boolean {
  const grc = (text.match(/[\u0370-\u03FF\u1F00-\u1FFF]/g) || []).length;
  const heb = (text.match(/[\u0590-\u05FF]/g) || []).length;
  if (lang === "grc") return grc > text.length * 0.15;
  if (lang === "heb") return heb > text.length * 0.15;
  return true;
}

// ---------------------------------------------------------------------------
// NTVMR HTML → plain Greek text
// ---------------------------------------------------------------------------

/**
 * Strip NTVMR HTML transcript output down to raw Greek text.
 * Removes correction tables, folio/page headers, line numbers,
 * HTML tags, structural markers, copyright footers, and normalises whitespace.
 */
export function parseNtvmrHtml(html: string): string {
  let text = html;
  text = text.replace(/<table[\s\S]*?<\/table>/gi, " ");
  text = text.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ");
  text = text.replace(/\b(Folio|Page|Col)\s+\d+\w?\b/gi, " ");
  text = text.replace(/⸆/g, " ");
  text = text.replace(/(?<=\s)\d{1,3}(?=\s)/g, " ");
  text = text.replace(/^\d{1,3}\s+/gm, "");
  text = text.replace(/\b\w+\s+inscriptio\b/gi, " ");
  text = text.replace(/Korrektor[^.]*\./gi, " ");
  text = text.replace(/\(C\)\s*\d{4}[\s\S]*/i, "");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

// ---------------------------------------------------------------------------
// SBLGNT verse parsing
// ---------------------------------------------------------------------------

/**
 * Given the full text of an SBLGNT book file and a chapter number,
 * extract only the verses belonging to that chapter.
 * Lines look like: `Matt 1:1 Βίβλος γενέσεως Ἰησοῦ Χριστοῦ ...`
 */
export function parseSblgntChapter(
  fullText: string,
  sblBook: string,
  chapter: string
): string[] {
  const prefix = `${sblBook} ${chapter}:`;
  return fullText
    .split("\n")
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.replace(/^\S+\s+\d+:\d+\s+/, "").trim())
    .filter(Boolean);
}
