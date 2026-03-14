import { describe, it, expect } from "vitest";
import {
  getLanguageBlock,
  getCorpusDescription,
  buildTranslationPrompt,
  parseTranslationResponse,
  validateParsed,
  TRANSLATION_SYSTEM_PROMPT,
} from "@/lib/utils/translation-prompts";

// ── getLanguageBlock ──────────────────────────────────────────────────────────

describe("getLanguageBlock", () => {
  it("heb block mentions waw-consecutive and יהוה", () => {
    const block = getLanguageBlock("heb");
    expect(block).toContain("Waw-consecutive");
    expect(block).toContain("יהוה");
  });

  it("heb block is case-insensitive for lang code", () => {
    expect(getLanguageBlock("HEB")).toBe(getLanguageBlock("heb"));
  });

  it("grc block (non-patristic) mentions aorist and LXX", () => {
    const block = getLanguageBlock("grc", false);
    expect(block.toLowerCase()).toContain("aorist");
    expect(block).toContain("LXX");
  });

  it("grc block (patristic) mentions Patristic and λόγος", () => {
    const block = getLanguageBlock("grc", true);
    expect(block.toLowerCase()).toContain("patristic");
    expect(block).toContain("λόγος");
  });

  it("grc default (no isPatristic flag) is non-patristic block", () => {
    expect(getLanguageBlock("grc")).toBe(getLanguageBlock("grc", false));
  });

  it("cop block mentions Sahidic", () => {
    expect(getLanguageBlock("cop")).toContain("Sahidic");
  });

  it("gez block mentions Ge'ez and Ethiopian", () => {
    const block = getLanguageBlock("gez");
    expect(block).toContain("Ge'ez");
    expect(block).toContain("Ethiopian");
  });

  it("syc block mentions Syriac", () => {
    expect(getLanguageBlock("syc")).toContain("Syriac");
  });

  it("unknown lang code returns non-empty default block", () => {
    const block = getLanguageBlock("xyz-unknown");
    expect(block.trim().length).toBeGreaterThan(0);
  });
});

// ── getCorpusDescription ──────────────────────────────────────────────────────

describe("getCorpusDescription", () => {
  it("wlc description mentions Leningrad and Masoretic", () => {
    const desc = getCorpusDescription("wlc");
    expect(desc).toContain("Leningrad");
    expect(desc).toContain("Masoretic");
  });

  it("etcbc_dss description mentions Dead Sea Scrolls and Qumran", () => {
    const desc = getCorpusDescription("etcbc_dss");
    expect(desc).toContain("Dead Sea Scrolls");
    expect(desc).toContain("Qumran");
  });

  it("first1k_greek description mentions patristic", () => {
    expect(getCorpusDescription("first1k_greek")).toContain("patristic");
  });

  it("undefined sourceId returns non-empty default string", () => {
    const desc = getCorpusDescription(undefined);
    expect(desc.trim().length).toBeGreaterThan(0);
  });

  it("unknown sourceId falls back gracefully", () => {
    const desc = getCorpusDescription("mystery_source");
    expect(desc.trim().length).toBeGreaterThan(0);
  });
});

// ── buildTranslationPrompt ────────────────────────────────────────────────────

const BASE_INPUT = {
  originalText: "בְּרֵאשִׁית בָּרָא אֱלֹהִים",
  originalLanguage: "heb",
  targetLanguage: "English",
  manuscriptTitle: "Westminster Leningrad Codex",
  dateStart: 1008,
  dateEnd: 1010,
  origin: "Cairo",
  transcriptionMethod: "standard_edition",
  sourceId: "wlc",
  parallelText: null,
};

describe("buildTranslationPrompt", () => {
  it("includes manuscript title", () => {
    const prompt = buildTranslationPrompt(BASE_INPUT);
    expect(prompt).toContain("Westminster Leningrad Codex");
  });

  it("includes both start and end date in range", () => {
    const prompt = buildTranslationPrompt(BASE_INPUT);
    expect(prompt).toContain("1008");
    expect(prompt).toContain("1010");
  });

  it("handles BCE dates correctly", () => {
    const prompt = buildTranslationPrompt({ ...BASE_INPUT, dateStart: -250, dateEnd: -68 });
    expect(prompt).toContain("BCE");
    expect(prompt).toContain("250");
    expect(prompt).toContain("68");
  });

  it("includes Hebrew language block content", () => {
    const prompt = buildTranslationPrompt(BASE_INPUT);
    expect(prompt).toContain("Waw-consecutive");
  });

  it("includes parallel text section when provided", () => {
    const prompt = buildTranslationPrompt({
      ...BASE_INPUT,
      parallelText: { sourceLabel: "Open Scriptures Hebrew Bible", text: "בְּרֵאשִׁית בָּרָא אֱלֹהִים X".repeat(5) },
    });
    expect(prompt).toContain("PARALLEL ATTESTATION");
    expect(prompt).toContain("Open Scriptures Hebrew Bible");
  });

  it("does not include parallel section when parallelText is null", () => {
    const prompt = buildTranslationPrompt({ ...BASE_INPUT, parallelText: null });
    expect(prompt).not.toContain("PARALLEL ATTESTATION");
  });

  it("does not include parallel section when text is too short (≤50 chars)", () => {
    const prompt = buildTranslationPrompt({
      ...BASE_INPUT,
      parallelText: { sourceLabel: "Some Source", text: "short" },
    });
    expect(prompt).not.toContain("PARALLEL ATTESTATION");
  });

  it("includes JSON response format instruction", () => {
    const prompt = buildTranslationPrompt(BASE_INPUT);
    expect(prompt).toContain("translated_text");
    expect(prompt).toContain("confidence_score");
    expect(prompt).toContain("translation_notes");
    expect(prompt).toContain("key_decisions");
  });

  it("includes the original text", () => {
    const prompt = buildTranslationPrompt(BASE_INPUT);
    expect(prompt).toContain("בְּרֵאשִׁית בָּרָא אֱלֹהִים");
  });

  it("uses patristic grc block for first1k_greek source", () => {
    const prompt = buildTranslationPrompt({
      ...BASE_INPUT,
      originalLanguage: "grc",
      sourceId: "first1k_greek",
    });
    expect(prompt).toContain("patristic");
  });
});

// ── TRANSLATION_SYSTEM_PROMPT ─────────────────────────────────────────────────

describe("TRANSLATION_SYSTEM_PROMPT", () => {
  it("is non-empty and mentions JSON output requirement", () => {
    expect(TRANSLATION_SYSTEM_PROMPT.trim().length).toBeGreaterThan(0);
    expect(TRANSLATION_SYSTEM_PROMPT).toContain("JSON");
  });
});

// ── parseTranslationResponse ──────────────────────────────────────────────────

describe("parseTranslationResponse", () => {
  const VALID_OBJ = {
    translated_text: "In the beginning God created",
    confidence_score: 0.92,
    translation_notes: "Standard rendering",
    key_decisions: ["Rendered אֱלֹהִים as God"],
  };

  it("parses a valid JSON string directly", () => {
    const result = parseTranslationResponse(JSON.stringify(VALID_OBJ));
    expect(result?.translated_text).toBe("In the beginning God created");
    expect(result?.confidence_score).toBe(0.92);
  });

  it("parses JSON wrapped in markdown code fence", () => {
    const fenced = "```json\n" + JSON.stringify(VALID_OBJ) + "\n```";
    const result = parseTranslationResponse(fenced);
    expect(result?.translated_text).toBe("In the beginning God created");
  });

  it("parses JSON embedded in surrounding text", () => {
    const wrapped = "Here is the result:\n" + JSON.stringify(VALID_OBJ) + "\nEnd.";
    const result = parseTranslationResponse(wrapped);
    expect(result?.translated_text).toBe("In the beginning God created");
  });

  it("returns null for garbage input", () => {
    expect(parseTranslationResponse("not json at all")).toBeNull();
  });

  it("returns null when translated_text is missing", () => {
    const obj = { confidence_score: 0.8, translation_notes: "ok", key_decisions: [] };
    expect(parseTranslationResponse(JSON.stringify(obj))).toBeNull();
  });

  it("returns null when translated_text is an empty string", () => {
    const obj = { ...VALID_OBJ, translated_text: "   " };
    expect(parseTranslationResponse(JSON.stringify(obj))).toBeNull();
  });
});

// ── validateParsed ────────────────────────────────────────────────────────────

describe("validateParsed", () => {
  it("clamps confidence_score above 1 to 1", () => {
    const result = validateParsed({ translated_text: "hello", confidence_score: 1.5 });
    expect(result?.confidence_score).toBe(1);
  });

  it("clamps confidence_score below 0 to 0", () => {
    const result = validateParsed({ translated_text: "hello", confidence_score: -0.1 });
    expect(result?.confidence_score).toBe(0);
  });

  it("defaults missing confidence_score to 0.5", () => {
    const result = validateParsed({ translated_text: "hello" });
    expect(result?.confidence_score).toBe(0.5);
  });

  it("defaults missing key_decisions to []", () => {
    const result = validateParsed({ translated_text: "hello" });
    expect(result?.key_decisions).toEqual([]);
  });

  it("defaults missing translation_notes to empty string", () => {
    const result = validateParsed({ translated_text: "hello" });
    expect(result?.translation_notes).toBe("");
  });

  it("converts non-string elements in key_decisions to strings", () => {
    const result = validateParsed({ translated_text: "hello", key_decisions: [1, true, "note"] });
    expect(result?.key_decisions).toEqual(["1", "true", "note"]);
  });
});
