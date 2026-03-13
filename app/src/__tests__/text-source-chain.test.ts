import { describe, it, expect } from "vitest";
import {
  BOOK_NUMBERS,
  NTVMR_MANUSCRIPTS,
  NT_SBL_BOOKS,
  LENINGRAD_TITLES,
  SOURCE_LABELS,
  parseBookAndChapter,
  textHasCorrectScript,
  parseNtvmrHtml,
  parseSblgntChapter,
  DSS_BOOK_ALIASES,
  normaliseDssBookName,
  KNOWN_EDITION_TITLES,
} from "@/lib/utils/text-sources";

// ---------------------------------------------------------------------------
// parseBookAndChapter
// ---------------------------------------------------------------------------
describe("parseBookAndChapter", () => {
  it("parses simple book names", () => {
    expect(parseBookAndChapter("Matthew 1")).toEqual({ bookNum: 40, chapter: 1 });
    expect(parseBookAndChapter("Genesis 50")).toEqual({ bookNum: 1, chapter: 50 });
    expect(parseBookAndChapter("Revelation 22")).toEqual({ bookNum: 66, chapter: 22 });
  });

  it("parses numbered book names", () => {
    expect(parseBookAndChapter("1 Corinthians 3")).toEqual({ bookNum: 46, chapter: 3 });
    expect(parseBookAndChapter("2 Kings 12")).toEqual({ bookNum: 12, chapter: 12 });
    expect(parseBookAndChapter("3 John 1")).toEqual({ bookNum: 64, chapter: 1 });
  });

  it("parses case-insensitively", () => {
    expect(parseBookAndChapter("MATTHEW 5")).toEqual({ bookNum: 40, chapter: 5 });
    expect(parseBookAndChapter("psalms 23")).toEqual({ bookNum: 19, chapter: 23 });
    expect(parseBookAndChapter("Psalm 119")).toEqual({ bookNum: 19, chapter: 119 });
  });

  it("parses LXX deuterocanonical books", () => {
    expect(parseBookAndChapter("Tobit 3")).toEqual({ bookNum: 68, chapter: 3 });
    expect(parseBookAndChapter("Wisdom of Solomon 7")).toEqual({ bookNum: 70, chapter: 7 });
    expect(parseBookAndChapter("Sirach 1")).toEqual({ bookNum: 71, chapter: 1 });
    expect(parseBookAndChapter("1 Maccabees 4")).toEqual({ bookNum: 74, chapter: 4 });
  });

  it("parses alternate names", () => {
    expect(parseBookAndChapter("Song of Songs 2")).toEqual({ bookNum: 22, chapter: 2 });
    expect(parseBookAndChapter("Song of Solomon 2")).toEqual({ bookNum: 22, chapter: 2 });
    expect(parseBookAndChapter("Canticles 1")).toEqual({ bookNum: 22, chapter: 1 });
    expect(parseBookAndChapter("Ecclesiasticus 5")).toEqual({ bookNum: 71, chapter: 5 });
  });

  it("returns null for invalid input", () => {
    expect(parseBookAndChapter("")).toBeNull();
    expect(parseBookAndChapter("Matthew")).toBeNull();
    expect(parseBookAndChapter("UnknownBook 1")).toBeNull();
    expect(parseBookAndChapter("42")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// textHasCorrectScript
// ---------------------------------------------------------------------------
describe("textHasCorrectScript", () => {
  const greekText = "Ἐν ἀρχῇ ἦν ὁ λόγος, καὶ ὁ λόγος ἦν πρὸς τὸν θεόν";
  const hebrewText = "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ";
  const englishText = "In the beginning was the Word, and the Word was with God";

  it("accepts Greek text for Greek language", () => {
    expect(textHasCorrectScript(greekText, "grc")).toBe(true);
  });

  it("rejects English text for Greek language", () => {
    expect(textHasCorrectScript(englishText, "grc")).toBe(false);
  });

  it("accepts Hebrew text for Hebrew language", () => {
    expect(textHasCorrectScript(hebrewText, "heb")).toBe(true);
  });

  it("rejects English text for Hebrew language", () => {
    expect(textHasCorrectScript(englishText, "heb")).toBe(false);
  });

  it("rejects Greek text for Hebrew language", () => {
    expect(textHasCorrectScript(greekText, "heb")).toBe(false);
  });

  it("accepts anything for unknown languages", () => {
    expect(textHasCorrectScript(englishText, "lat")).toBe(true);
    expect(textHasCorrectScript("", "xyz")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseNtvmrHtml
// ---------------------------------------------------------------------------
describe("parseNtvmrHtml", () => {
  it("strips HTML tags", () => {
    expect(parseNtvmrHtml("<p>Ἐν ἀρχῇ</p>")).toBe("Ἐν ἀρχῇ");
  });

  it("removes table blocks (correction apparatus)", () => {
    const html = "text before <table><tr><td>correction data</td></tr></table> text after";
    expect(parseNtvmrHtml(html)).toBe("text before text after");
  });

  it("removes heading blocks", () => {
    const html = '<h2>Folio 1r</h2><span>Ἐν ἀρχῇ</span>';
    expect(parseNtvmrHtml(html)).toBe("Ἐν ἀρχῇ");
  });

  it("decodes HTML entities", () => {
    expect(parseNtvmrHtml("&amp; &lt; &gt; &nbsp;")).toBe("& < >");
  });

  it("removes structural markers", () => {
    expect(parseNtvmrHtml("Folio 12r text")).toBe("text");
    expect(parseNtvmrHtml("Page 5 more text")).toBe("more text");
    expect(parseNtvmrHtml("Col 2a words")).toBe("words");
  });

  it("removes insertion marker ⸆", () => {
    expect(parseNtvmrHtml("word⸆another")).toBe("word another");
  });

  it("removes leading line numbers", () => {
    expect(parseNtvmrHtml("12 Ἐν ἀρχῇ")).toBe("Ἐν ἀρχῇ");
  });

  it("removes inscriptio markers", () => {
    expect(parseNtvmrHtml("Matt inscriptio Ἐν ἀρχῇ")).toBe("Ἐν ἀρχῇ");
  });

  it("removes Korrektor notes", () => {
    expect(parseNtvmrHtml("text Korrektor changed something here. more text")).toBe("text more text");
  });

  it("removes copyright footer", () => {
    expect(parseNtvmrHtml("Greek text (C) 2023 INTF")).toBe("Greek text");
  });

  it("normalizes whitespace", () => {
    expect(parseNtvmrHtml("  word1   word2    word3  ")).toBe("word1 word2 word3");
  });
});

// ---------------------------------------------------------------------------
// parseSblgntChapter
// ---------------------------------------------------------------------------
describe("parseSblgntChapter", () => {
  const sampleText = [
    "Matt 1:1 Βίβλος γενέσεως Ἰησοῦ Χριστοῦ υἱοῦ Δαυὶδ υἱοῦ Ἀβραάμ.",
    "Matt 1:2 Ἀβραὰμ ἐγέννησεν τὸν Ἰσαάκ,",
    "Matt 2:1 Τοῦ δὲ Ἰησοῦ γεννηθέντος ἐν Βηθλέεμ",
    "Matt 2:2 λέγοντες· Ποῦ ἐστιν ὁ τεχθεὶς βασιλεὺς τῶν Ἰουδαίων;",
  ].join("\n");

  it("extracts correct chapter verses", () => {
    const result = parseSblgntChapter(sampleText, "Matt", "1");
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("Βίβλος γενέσεως");
    expect(result[1]).toContain("Ἀβραὰμ ἐγέννησεν");
  });

  it("does not include other chapters", () => {
    const result = parseSblgntChapter(sampleText, "Matt", "1");
    expect(result.join(" ")).not.toContain("Βηθλέεμ");
  });

  it("returns empty array for non-existent chapter", () => {
    expect(parseSblgntChapter(sampleText, "Matt", "99")).toEqual([]);
  });

  it("returns empty array for wrong book", () => {
    expect(parseSblgntChapter(sampleText, "Mark", "1")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// BOOK_NUMBERS mapping
// ---------------------------------------------------------------------------
describe("BOOK_NUMBERS", () => {
  it("covers all 66 Protestant canon books", () => {
    const numbers = new Set(
      Object.values(BOOK_NUMBERS).filter((n) => n >= 1 && n <= 66)
    );
    expect(numbers.size).toBe(66);
  });

  it("includes LXX deuterocanonical entries", () => {
    expect(BOOK_NUMBERS["tobit"]).toBe(68);
    expect(BOOK_NUMBERS["wisdom"]).toBe(70);
    expect(BOOK_NUMBERS["sirach"]).toBe(71);
    expect(BOOK_NUMBERS["1 maccabees"]).toBe(74);
  });

  it("maps alternate names to the same number", () => {
    expect(BOOK_NUMBERS["psalms"]).toBe(BOOK_NUMBERS["psalm"]);
    expect(BOOK_NUMBERS["song of solomon"]).toBe(BOOK_NUMBERS["song of songs"]);
    expect(BOOK_NUMBERS["wisdom"]).toBe(BOOK_NUMBERS["wisdom of solomon"]);
  });
});

// ---------------------------------------------------------------------------
// NTVMR_MANUSCRIPTS mapping
// ---------------------------------------------------------------------------
describe("NTVMR_MANUSCRIPTS", () => {
  it("maps major uncials to correct docIDs", () => {
    expect(NTVMR_MANUSCRIPTS["codex sinaiticus"]).toBe(20001);
    expect(NTVMR_MANUSCRIPTS["codex vaticanus"]).toBe(20003);
    expect(NTVMR_MANUSCRIPTS["codex alexandrinus"]).toBe(20002);
  });

  it("maps short names as aliases", () => {
    expect(NTVMR_MANUSCRIPTS["sinaiticus"]).toBe(NTVMR_MANUSCRIPTS["codex sinaiticus"]);
    expect(NTVMR_MANUSCRIPTS["vaticanus"]).toBe(NTVMR_MANUSCRIPTS["codex vaticanus"]);
  });

  it("maps papyri with 10000-series IDs", () => {
    expect(NTVMR_MANUSCRIPTS["p46"]).toBe(10046);
    expect(NTVMR_MANUSCRIPTS["p66"]).toBe(10066);
    expect(NTVMR_MANUSCRIPTS["p75"]).toBe(10075);
  });
});

// ---------------------------------------------------------------------------
// NT_SBL_BOOKS mapping
// ---------------------------------------------------------------------------
describe("NT_SBL_BOOKS", () => {
  it("covers all 27 NT books", () => {
    expect(Object.keys(NT_SBL_BOOKS)).toHaveLength(27);
  });

  it("uses standard SBL abbreviations", () => {
    expect(NT_SBL_BOOKS["matthew"]).toBe("Matt");
    expect(NT_SBL_BOOKS["1 corinthians"]).toBe("1Cor");
    expect(NT_SBL_BOOKS["revelation"]).toBe("Rev");
    expect(NT_SBL_BOOKS["philemon"]).toBe("Phlm");
  });
});

// ---------------------------------------------------------------------------
// LENINGRAD_TITLES
// ---------------------------------------------------------------------------
describe("LENINGRAD_TITLES", () => {
  it("matches known Leningrad Codex titles", () => {
    expect(LENINGRAD_TITLES.has("leningrad codex")).toBe(true);
    expect(LENINGRAD_TITLES.has("codex leningradensis")).toBe(true);
    expect(LENINGRAD_TITLES.has("firkovich b 19a")).toBe(true);
    expect(LENINGRAD_TITLES.has("leningradensis")).toBe(true);
  });

  it("does not match unrelated titles", () => {
    expect(LENINGRAD_TITLES.has("codex sinaiticus")).toBe(false);
    expect(LENINGRAD_TITLES.has("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SOURCE_LABELS
// ---------------------------------------------------------------------------
describe("SOURCE_LABELS", () => {
  it("has labels for all source types", () => {
    const expectedSources = [
      "sinaiticus-project", "ntvmr", "dss", "sblgnt",
      "bible-api", "leningrad-wlc", "ai",
    ];
    for (const source of expectedSources) {
      expect(SOURCE_LABELS[source]).toBeDefined();
      expect(SOURCE_LABELS[source].length).toBeGreaterThan(10);
    }
  });

  it("distinguishes manuscript-specific from edition sources", () => {
    expect(SOURCE_LABELS["ntvmr"]).toContain("manuscript-specific");
    expect(SOURCE_LABELS["sinaiticus-project"]).toContain("manuscript-specific");
    expect(SOURCE_LABELS["bible-api"]).toContain("standard edition");
    expect(SOURCE_LABELS["ai"]).toContain("AI");
  });

  it("includes new registry and no_source labels", () => {
    expect(SOURCE_LABELS["registry"]).toBeDefined();
    expect(SOURCE_LABELS["no_source"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// DSS_BOOK_ALIASES and normaliseDssBookName (E4)
// ---------------------------------------------------------------------------
describe("DSS_BOOK_ALIASES", () => {
  it("maps common Hebrew book abbreviations to canonical names", () => {
    expect(DSS_BOOK_ALIASES["isa"]).toBe("Isaiah");
    expect(DSS_BOOK_ALIASES["gen"]).toBe("Genesis");
    expect(DSS_BOOK_ALIASES["ps"]).toBe("Psalms");
    expect(DSS_BOOK_ALIASES["psa"]).toBe("Psalms");
    expect(DSS_BOOK_ALIASES["psalm"]).toBe("Psalms");
    expect(DSS_BOOK_ALIASES["psalms"]).toBe("Psalms");
    expect(DSS_BOOK_ALIASES["isaiah"]).toBe("Isaiah");
    expect(DSS_BOOK_ALIASES["genesis"]).toBe("Genesis");
  });
});

describe("normaliseDssBookName", () => {
  it("normalises abbreviations to canonical display names", () => {
    expect(normaliseDssBookName("Isa")).toBe("Isaiah");
    expect(normaliseDssBookName("ISA")).toBe("Isaiah");
    expect(normaliseDssBookName("isa")).toBe("Isaiah");
    expect(normaliseDssBookName("Gen")).toBe("Genesis");
    expect(normaliseDssBookName("Ps")).toBe("Psalms");
    expect(normaliseDssBookName("Psa")).toBe("Psalms");
  });

  it("returns full names unchanged (idempotent)", () => {
    expect(normaliseDssBookName("Isaiah")).toBe("Isaiah");
    expect(normaliseDssBookName("Genesis")).toBe("Genesis");
    expect(normaliseDssBookName("Psalms")).toBe("Psalms");
  });

  it("passes through unknown names unchanged", () => {
    expect(normaliseDssBookName("UnknownBook")).toBe("UnknownBook");
  });

  it("trims whitespace", () => {
    expect(normaliseDssBookName("  isa  ")).toBe("Isaiah");
  });
});

// ---------------------------------------------------------------------------
// KNOWN_EDITION_TITLES
// ---------------------------------------------------------------------------
describe("KNOWN_EDITION_TITLES", () => {
  it("contains all expected standard edition titles", () => {
    expect(KNOWN_EDITION_TITLES.has("sblgnt")).toBe(true);
    expect(KNOWN_EDITION_TITLES.has("sbl greek new testament")).toBe(true);
    expect(KNOWN_EDITION_TITLES.has("westminster leningrad codex")).toBe(true);
    expect(KNOWN_EDITION_TITLES.has("lxx")).toBe(true);
    expect(KNOWN_EDITION_TITLES.has("septuagint")).toBe(true);
    expect(KNOWN_EDITION_TITLES.has("textus receptus")).toBe(true);
    expect(KNOWN_EDITION_TITLES.has("oshb")).toBe(true);
    expect(KNOWN_EDITION_TITLES.has("tyndale house gnt")).toBe(true);
    expect(KNOWN_EDITION_TITLES.has("thgnt")).toBe(true);
  });

  it("does not contain specific manuscript titles", () => {
    expect(KNOWN_EDITION_TITLES.has("codex sinaiticus")).toBe(false);
    expect(KNOWN_EDITION_TITLES.has("codex vaticanus")).toBe(false);
    expect(KNOWN_EDITION_TITLES.has("p46")).toBe(false);
  });
});
