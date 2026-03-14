/**
 * Browser category for the read page corpus filter.
 * Widens the old "ot"|"nt"|"deuterocanonical"|"other" union to include patristic and Ethiopian.
 */
export type BrowserCategory = "ot" | "nt" | "deuterocanonical" | "ethiopian" | "patristic" | "other";

/**
 * Maps source registry IDs (manuscript_source_texts.source) to browser categories.
 * Used for passages whose book name is not in BOOK_ORDER (e.g. patristic OGL works).
 * Sources not listed here default to "other".
 */
export const SOURCE_TO_CATEGORY: Record<string, BrowserCategory> = {
  first1k_greek: "patristic",
  coptic_scriptorium: "patristic",
};

/**
 * Canonical book ordering for sorting passage references across the platform.
 * Covers Protestant canon, Deuterocanonical/Apocrypha, Ethiopian canon, and other ancient texts.
 * Keys are lowercase; values define sort position.
 */
export const BOOK_ORDER: Record<string, number> = {
  // Hebrew Bible / Old Testament (1–39)
  genesis: 1, exodus: 2, leviticus: 3, numbers: 4, deuteronomy: 5,
  joshua: 6, judges: 7, ruth: 8, "1 samuel": 9, "2 samuel": 10,
  "1 kings": 11, "2 kings": 12, "1 chronicles": 13, "2 chronicles": 14,
  ezra: 15, nehemiah: 16, esther: 17, job: 18, psalms: 19, psalm: 19,
  proverbs: 20, ecclesiastes: 21, "song of solomon": 22, "song of songs": 22, canticles: 22, isaiah: 23,
  jeremiah: 24, lamentations: 25, ezekiel: 26, daniel: 27, hosea: 28,
  joel: 29, amos: 30, obadiah: 31, jonah: 32, micah: 33, nahum: 34,
  habakkuk: 35, zephaniah: 36, haggai: 37, zechariah: 38, malachi: 39,
  // New Testament (40–66)
  matthew: 40, mark: 41, luke: 42, john: 43, acts: 44, romans: 45,
  "1 corinthians": 46, "2 corinthians": 47, galatians: 48, ephesians: 49,
  philippians: 50, colossians: 51, "1 thessalonians": 52, "2 thessalonians": 53,
  "1 timothy": 54, "2 timothy": 55, titus: 56, philemon: 57, hebrews: 58,
  james: 59, "1 peter": 60, "2 peter": 61, "1 john": 62, "2 john": 63,
  "3 john": 64, jude: 65, revelation: 66,
  // Deuterocanonical / Apocrypha (67+)
  "1 esdras": 67, "3 ezra": 67, "esdras a": 67,
  tobit: 68,
  judith: 69,
  wisdom: 70, "wisdom of solomon": 70,
  sirach: 71, ecclesiasticus: 71, "wisdom of sirach": 71, "ben sira": 71,
  baruch: 73, "letter of jeremiah": 73, "epistle of jeremiah": 73,
  "1 maccabees": 74, "2 maccabees": 75, "3 maccabees": 76, "4 maccabees": 80,
  susanna: 78, "bel and the dragon": 79, "prayer of azariah": 77, "song of the three young men": 77,
  "psalms of solomon": 85, "odæs": 86, odes: 86, "ode": 86,
  // Ethiopian canon (100+)
  "1 enoch": 100, enoch: 100,
  jubilees: 101,
  "1 meqabyan": 102, "2 meqabyan": 103, "3 meqabyan": 104,
  "rest of words of baruch": 105, "4 baruch": 105,
  "4 ezra": 106, "2 esdras": 106, "2 esdras (latin)": 106,
  // Other ancient texts (150+)
  "prayer of manasseh": 150, "prayer of manasses": 150,
};

/**
 * Canonical display names for books (title case).
 * Maps order number to the preferred display name.
 */
export const BOOK_DISPLAY_NAMES: Record<number, string> = {
  1: "Genesis", 2: "Exodus", 3: "Leviticus", 4: "Numbers", 5: "Deuteronomy",
  6: "Joshua", 7: "Judges", 8: "Ruth", 9: "1 Samuel", 10: "2 Samuel",
  11: "1 Kings", 12: "2 Kings", 13: "1 Chronicles", 14: "2 Chronicles",
  15: "Ezra", 16: "Nehemiah", 17: "Esther", 18: "Job", 19: "Psalms",
  20: "Proverbs", 21: "Ecclesiastes", 22: "Song of Solomon", 23: "Isaiah",
  24: "Jeremiah", 25: "Lamentations", 26: "Ezekiel", 27: "Daniel", 28: "Hosea",
  29: "Joel", 30: "Amos", 31: "Obadiah", 32: "Jonah", 33: "Micah", 34: "Nahum",
  35: "Habakkuk", 36: "Zephaniah", 37: "Haggai", 38: "Zechariah", 39: "Malachi",
  40: "Matthew", 41: "Mark", 42: "Luke", 43: "John", 44: "Acts", 45: "Romans",
  46: "1 Corinthians", 47: "2 Corinthians", 48: "Galatians", 49: "Ephesians",
  50: "Philippians", 51: "Colossians", 52: "1 Thessalonians", 53: "2 Thessalonians",
  54: "1 Timothy", 55: "2 Timothy", 56: "Titus", 57: "Philemon", 58: "Hebrews",
  59: "James", 60: "1 Peter", 61: "2 Peter", 62: "1 John", 63: "2 John",
  64: "3 John", 65: "Jude", 66: "Revelation",
  67: "1 Esdras", 68: "Tobit", 69: "Judith", 70: "Wisdom of Solomon",
  71: "Sirach", 73: "Baruch", 74: "1 Maccabees", 75: "2 Maccabees",
  76: "3 Maccabees", 77: "Prayer of Azariah", 78: "Susanna",
  79: "Bel and the Dragon", 80: "4 Maccabees",
  85: "Psalms of Solomon", 86: "Odes",
  100: "1 Enoch", 101: "Jubilees", 102: "1 Meqabyan", 103: "2 Meqabyan",
  104: "3 Meqabyan", 105: "4 Baruch", 106: "4 Ezra",
  150: "Prayer of Manasseh",
};

/** OT books: order 1–39 */
export const OT_RANGE: [number, number] = [1, 39];
/** NT books: order 40–66 */
export const NT_RANGE: [number, number] = [40, 66];

/**
 * Parse a passage reference like "Genesis 12" into [bookOrder, chapter].
 * Returns [999, 0] for unparseable references.
 */
export function parseReference(ref: string): [number, number] {
  const match = ref.match(/^(.+?)\s+(\d+)/);
  if (!match) return [999, 0];
  const book = BOOK_ORDER[match[1].toLowerCase().trim()] ?? 999;
  return [book, parseInt(match[2], 10)];
}

/**
 * Extract the book name (title case) from a reference string.
 * "Genesis 12" → "Genesis", "1 Corinthians 3" → "1 Corinthians"
 */
export function extractBookName(ref: string): string | null {
  const match = ref.match(/^(.+?)\s+\d+/);
  return match ? match[1].trim() : null;
}

/**
 * Get the canonical display name for a book.
 * Looks up by lowercase key → order → display name.
 */
export function getBookDisplayName(bookKey: string): string {
  const order = BOOK_ORDER[bookKey.toLowerCase().trim()];
  if (order && BOOK_DISPLAY_NAMES[order]) return BOOK_DISPLAY_NAMES[order];
  return bookKey.charAt(0).toUpperCase() + bookKey.slice(1);
}

/**
 * Classify a book order number into a browser category.
 */
export function getTestamentSection(order: number): BrowserCategory {
  if (order >= OT_RANGE[0] && order <= OT_RANGE[1]) return "ot";
  if (order >= NT_RANGE[0] && order <= NT_RANGE[1]) return "nt";
  if (order >= 67 && order <= 86) return "deuterocanonical";
  if (order >= 100 && order <= 106) return "ethiopian";
  return "other";
}
