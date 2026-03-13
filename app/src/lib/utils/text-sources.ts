/**
 * Pure functions and constants for the text source chain.
 *
 * Extracted from the section-text API route so they can be unit-tested
 * without network access. The route imports these; tests exercise them directly.
 */

// ---------------------------------------------------------------------------
// Source chain reasoning
// ---------------------------------------------------------------------------

export interface SourceChainStep {
  step: number;
  source: string;
  attempted: boolean;
  result: "success" | "skipped" | "no_data" | "wrong_script" | "not_applicable";
  reason: string;
  durationMs?: number;
}

export const SOURCE_LABELS: Record<string, string> = {
  // New unified registry source (replaces sinaiticus-project, dss, leningrad-wlc, sblgnt individual steps)
  registry: "Source Registry (pre-cataloged open-access corpus)",
  "no_source": "No authoritative source found",
  // Legacy labels — kept for backwards compat with existing passage metadata
  "sinaiticus-project": "Codex Sinaiticus Project (manuscript-specific XML transcription)",
  ntvmr: "INTF NTVMR (manuscript-specific scholarly transcription, NT only)",
  dss: "ETCBC Dead Sea Scrolls (manuscript-specific OT fragments)",
  sblgnt: "SBLGNT (NT Greek critical edition from GitHub)",
  "bible-api": "bolls.life (standard edition: LXX / TR / WLC)",
  "leningrad-wlc": "Westminster Leningrad Codex (standard edition recognized as manuscript-specific)",
  ai: "AI Models (Claude Haiku → Sonnet)",
};

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
  p45: 10045,
  "papyrus 45": 10045, "papyrus 45 (p45)": 10045,
  p46: 10046,
  "papyrus 46": 10046, "papyrus 46 (p46)": 10046,
  p47: 10047,
  "papyrus 47": 10047, "papyrus 47 (p47)": 10047,
  p52: 10052,
  "papyrus 52": 10052, "papyrus 52 (p52)": 10052,
  p66: 10066,
  "papyrus 66": 10066, "papyrus 66 (p66)": 10066,
  p72: 10072,
  "papyrus 72": 10072, "papyrus 72 (p72)": 10072,
  p75: 10075,
  "papyrus 75": 10075, "papyrus 75 (p75)": 10075,
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

/**
 * Known standard-edition manuscript titles. Used by the mismatch warning UI
 * to suppress false positives when a manuscript IS a standard edition.
 */
export const KNOWN_EDITION_TITLES = new Set([
  "sblgnt",
  "sbl greek new testament",
  "westminster leningrad codex",
  "codex leningradensis",
  "leningrad codex",
  "firkovich b 19a",
  "leningradensis",
  "lxx",
  "septuagint",
  "textus receptus",
  "byzantine text",
  "open scriptures hebrew bible",
  "oshb",
  "tyndale house gnt",
  "thgnt",
]);

/**
 * Aliases for DSS book names to canonical display names stored in
 * manuscript_source_texts by preprocess-dss.mjs.
 * Maps lowercase query forms → exact stored book name.
 */
export const DSS_BOOK_ALIASES: Record<string, string> = {
  // Genesis
  gen: "Genesis", genesis: "Genesis",
  // Exodus
  exod: "Exodus", exodus: "Exodus",
  // Leviticus
  lev: "Leviticus", leviticus: "Leviticus",
  // Numbers
  num: "Numbers", numbers: "Numbers",
  // Deuteronomy
  deut: "Deuteronomy", deuteronomy: "Deuteronomy",
  // Joshua
  josh: "Joshua", joshua: "Joshua",
  // Judges
  judg: "Judges", judges: "Judges",
  // Ruth
  ruth: "Ruth",
  // Samuel
  "1 sam": "1 Samuel", "1 samuel": "1 Samuel", "1sam": "1 Samuel",
  "2 sam": "2 Samuel", "2 samuel": "2 Samuel", "2sam": "2 Samuel",
  // Kings
  "1 kgs": "1 Kings", "1 kings": "1 Kings", "1kgs": "1 Kings",
  "2 kgs": "2 Kings", "2 kings": "2 Kings", "2kgs": "2 Kings",
  // Chronicles
  "1 chr": "1 Chronicles", "1 chronicles": "1 Chronicles", "1chr": "1 Chronicles",
  "2 chr": "2 Chronicles", "2 chronicles": "2 Chronicles", "2chr": "2 Chronicles",
  // Ezra / Nehemiah
  ezra: "Ezra", neh: "Nehemiah", nehemiah: "Nehemiah",
  // Esther
  esth: "Esther", esther: "Esther",
  // Job
  job: "Job",
  // Psalms
  ps: "Psalms", psa: "Psalms", psalm: "Psalms", psalms: "Psalms",
  // Proverbs
  prov: "Proverbs", proverbs: "Proverbs",
  // Ecclesiastes
  eccl: "Ecclesiastes", ecclesiastes: "Ecclesiastes", qoh: "Ecclesiastes",
  // Song of Solomon
  song: "Song of Solomon", "song of songs": "Song of Solomon",
  "song of solomon": "Song of Solomon", cant: "Song of Solomon",
  // Isaiah
  isa: "Isaiah", isaiah: "Isaiah",
  // Jeremiah
  jer: "Jeremiah", jeremiah: "Jeremiah",
  // Lamentations
  lam: "Lamentations", lamentations: "Lamentations",
  // Ezekiel
  ezek: "Ezekiel", ezekiel: "Ezekiel",
  // Daniel
  dan: "Daniel", daniel: "Daniel",
  // Minor prophets
  hos: "Hosea", hosea: "Hosea",
  joel: "Joel",
  amos: "Amos",
  obad: "Obadiah", obadiah: "Obadiah",
  jonah: "Jonah", jon: "Jonah",
  mic: "Micah", micah: "Micah",
  nah: "Nahum", nahum: "Nahum",
  hab: "Habakkuk", habakkuk: "Habakkuk",
  zeph: "Zephaniah", zephaniah: "Zephaniah",
  hag: "Haggai", haggai: "Haggai",
  zech: "Zechariah", zechariah: "Zechariah",
  mal: "Malachi", malachi: "Malachi",
};

/**
 * Normalise a book name from a passage reference to the canonical display name
 * stored in manuscript_source_texts by preprocess-dss.mjs.
 * Returns the canonical name, or the original (title-cased) if not found.
 */
export function normaliseDssBookName(rawBook: string): string {
  const key = rawBook.toLowerCase().trim();
  return DSS_BOOK_ALIASES[key] ?? rawBook.trim();
}

// ---------------------------------------------------------------------------
// Chunking / truncation utilities
// ---------------------------------------------------------------------------

/**
 * Truncate text to at most maxChars characters, preserving whole words where
 * possible. Used to guard against oversized NTVMR responses before storage.
 */
export function truncateToMaxChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > maxChars * 0.8 ? truncated.slice(0, lastSpace) : truncated;
}

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
 * Script-detection patterns keyed by ISO 639-3 language code.
 * Each regex matches characters from the expected script.
 */
const SCRIPT_PATTERNS: Record<string, RegExp> = {
  grc: /[\u0370-\u03FF\u1F00-\u1FFF]/g,         // Greek
  heb: /[\u0590-\u05FF]/g,                        // Hebrew
  lat: /[a-zA-ZÀ-ÖØ-öø-ÿ]/g,                     // Latin
  syc: /[\u0700-\u074F]/g,                         // Syriac
  cop: /[\u2C80-\u2CFF]/g,                         // Coptic
  gez: /[\u1200-\u137F]/g,                         // Ethiopic (Ge'ez)
  arm: /[\u0530-\u058F]/g,                         // Armenian
  geo: /[\u10A0-\u10FF]/g,                         // Georgian
  ara: /[\u0600-\u06FF]/g,                         // Arabic
};

/**
 * Returns true when at least 15 % of the text is in the expected script.
 * Used to reject AI refusals and wrong-language text.
 * For unknown languages, returns true (benefit of the doubt).
 */
export function textHasCorrectScript(
  text: string,
  lang: string
): boolean {
  const pattern = SCRIPT_PATTERNS[lang];
  if (!pattern) return true;
  const matches = (text.match(pattern) || []).length;
  return matches > text.length * 0.15;
}

/** Languages supported by the bolls.life API (Greek + Hebrew editions only). */
export const BOLLS_LIFE_LANGUAGES = new Set(["grc", "heb"]);

/** Human-readable language names. */
export const LANGUAGE_NAMES: Record<string, string> = {
  grc: "Koine Greek",
  heb: "Biblical Hebrew",
  lat: "Latin",
  syc: "Syriac",
  cop: "Coptic",
  gez: "Ge'ez (Ethiopic)",
  arm: "Armenian",
  geo: "Georgian",
  ara: "Arabic",
};

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
