/**
 * Unit tests for preprocessor pure parse functions.
 * These tests do NOT make network calls — they use inline fixture strings.
 */
import { describe, it, expect } from "vitest";

// The preprocessor scripts are .mjs files outside the app/src tree.
// We inline the pure functions here to avoid import issues in the test runner.
// When modifying parse functions in the scripts, keep these tests in sync.

// ---------------------------------------------------------------------------
// parseOsisBook (from preprocess-wlc.mjs / preprocess-oshb.mjs)
// ---------------------------------------------------------------------------
function parseOsisBook(xml: string): { chapter: number; text: string }[] {
  const chapterMap = new Map<number, string[]>();

  const verseRe = /osisID="[^.]+\.(\d+)\.\d+"/g;
  const versePositions: { pos: number; chapter: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = verseRe.exec(xml)) !== null) {
    versePositions.push({ pos: m.index, chapter: parseInt(m[1], 10) });
  }

  if (versePositions.length === 0) return [];

  for (let vi = 0; vi < versePositions.length; vi++) {
    const { pos, chapter } = versePositions[vi];
    const end =
      vi + 1 < versePositions.length
        ? versePositions[vi + 1].pos
        : Math.min(pos + 2000, xml.length);
    const slice = xml.slice(pos, end);

    const words: string[] = [];
    const wRe = /<w\b[^>]*>([^<]+)<\/w>/g;
    let wm: RegExpExecArray | null;
    while ((wm = wRe.exec(slice)) !== null) {
      const t = wm[1].trim();
      if (t) words.push(t);
    }
    if (words.length === 0) continue;
    if (!chapterMap.has(chapter)) chapterMap.set(chapter, []);
    const arr = chapterMap.get(chapter)!;
    for (const w of words) arr.push(w);
  }

  return Array.from(chapterMap.entries())
    .map(([chapter, words]) => ({ chapter, text: words.join(" ") }))
    .sort((a, b) => a.chapter - b.chapter);
}

const OSIS_FIXTURE = `
<osis>
  <div type="book">
    <verse osisID="Gen.1.1"><w lemma="c/b/r">בְּרֵאשִׁית</w><w lemma="a">בָּרָא</w></verse>
    <verse osisID="Gen.1.2"><w lemma="x">הָאָרֶץ</w></verse>
    <verse osisID="Gen.2.1"><w lemma="y">וַיְכֻלּוּ</w></verse>
  </div>
</osis>
`;

describe("parseOsisBook", () => {
  it("extracts chapters and words from OSIS XML", () => {
    const result = parseOsisBook(OSIS_FIXTURE);
    expect(result.length).toBe(2);
    expect(result[0].chapter).toBe(1);
    expect(result[0].text).toContain("בְּרֵאשִׁית");
    expect(result[0].text).toContain("הָאָרֶץ");
    expect(result[1].chapter).toBe(2);
    expect(result[1].text).toContain("וַיְכֻלּוּ");
  });

  it("returns empty array for XML with no verse osisIDs", () => {
    expect(parseOsisBook("<osis><verse>no id</verse></osis>")).toEqual([]);
  });

  it("handles single-chapter books", () => {
    const xml = `<x><verse osisID="Obad.1.1"><w>word</w></verse></x>`;
    const result = parseOsisBook(xml);
    expect(result).toHaveLength(1);
    expect(result[0].chapter).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// parseSblgntChapter (from preprocess-sblgnt.mjs)
// ---------------------------------------------------------------------------
function parseSblgntChapter(
  fullText: string,
  sblBook: string,
  chapter: number
): string {
  const prefix = `${sblBook} ${chapter}:`;
  return fullText
    .split("\n")
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.replace(/^\S+\s+\d+:\d+\s+/, "").trim())
    .filter(Boolean)
    .join(" ");
}

const SBLGNT_FIXTURE = `
Matt 1:1 Βίβλος γενέσεως Ἰησοῦ Χριστοῦ
Matt 1:2 Ἀβραὰμ ἐγέννησεν τὸν Ἰσαάκ
Matt 2:1 Τοῦ δὲ Ἰησοῦ γεννηθέντος
`.trim();

describe("parseSblgntChapter", () => {
  it("extracts verses for a given chapter", () => {
    const text = parseSblgntChapter(SBLGNT_FIXTURE, "Matt", 1);
    expect(text).toContain("Βίβλος");
    expect(text).toContain("Ἀβραὰμ");
    expect(text).not.toContain("Τοῦ");
  });

  it("extracts another chapter correctly", () => {
    const text = parseSblgntChapter(SBLGNT_FIXTURE, "Matt", 2);
    expect(text).toContain("Τοῦ");
    expect(text).not.toContain("Βίβλος");
  });

  it("returns empty string for missing chapter", () => {
    const text = parseSblgntChapter(SBLGNT_FIXTURE, "Matt", 99);
    expect(text).toBe("");
  });
});

// ---------------------------------------------------------------------------
// parseCopticTei (logic from preprocess-coptic.mjs)
// ---------------------------------------------------------------------------
function parseCopticTei(
  xml: string,
  _defaultBook: string
): { chapter: number; text: string }[] {
  const chapterMap = new Map<number, string[]>();

  const divRe = /<div\b[^>]*subtype="chapter"[^>]*n="(\d+)"[^>]*>/g;
  const positions: { pos: number; chapter: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = divRe.exec(xml)) !== null) {
    positions.push({ pos: m.index, chapter: parseInt(m[1], 10) });
  }

  if (positions.length === 0) {
    const words: string[] = [];
    const wRe = /<w\b[^>]*>([^<]+)<\/w>/g;
    while ((m = wRe.exec(xml)) !== null) {
      const t = m[1].trim();
      if (t) words.push(t);
    }
    if (words.length > 0) chapterMap.set(1, words);
  } else {
    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].pos;
      const end = i + 1 < positions.length ? positions[i + 1].pos : xml.length;
      const chapter = positions[i].chapter;
      if (chapter <= 0) continue;

      const slice = xml.slice(start, end);
      const words: string[] = [];
      const wRe = /<w\b[^>]*>([^<]+)<\/w>/g;
      while ((m = wRe.exec(slice)) !== null) {
        const t = m[1].trim();
        if (t) words.push(t);
      }
      if (words.length === 0) continue;
      if (!chapterMap.has(chapter)) chapterMap.set(chapter, []);
      const arr = chapterMap.get(chapter)!;
      for (const w of words) arr.push(w);
    }
  }

  return Array.from(chapterMap.entries())
    .map(([chapter, words]) => ({ chapter, text: words.join(" ") }))
    .sort((a, b) => a.chapter - b.chapter);
}

const COPTIC_FIXTURE = `
<TEI>
  <div type="textpart" subtype="chapter" n="1">
    <w xml:lang="cop">ⲡⲉ</w>
    <w xml:lang="cop">ϫⲉ</w>
  </div>
  <div type="textpart" subtype="chapter" n="2">
    <w xml:lang="cop">ⲛⲧⲉ</w>
  </div>
</TEI>
`;

describe("parseCopticTei", () => {
  it("extracts chapters from TEI chapter divs", () => {
    const result = parseCopticTei(COPTIC_FIXTURE, "Matthew");
    expect(result.length).toBe(2);
    expect(result[0].chapter).toBe(1);
    expect(result[0].text).toContain("ⲡⲉ");
    expect(result[1].chapter).toBe(2);
  });

  it("falls back to chapter 1 for XML without chapter divs", () => {
    const xml = `<TEI><w>ⲡⲉ</w><w>ϫⲉ</w></TEI>`;
    const result = parseCopticTei(xml, "Matthew");
    expect(result.length).toBe(1);
    expect(result[0].chapter).toBe(1);
  });

  it("returns empty for XML with no word elements", () => {
    const xml = `<TEI><div type="textpart" subtype="chapter" n="1"></div></TEI>`;
    const result = parseCopticTei(xml, "Matthew");
    expect(result).toHaveLength(0);
  });
});
