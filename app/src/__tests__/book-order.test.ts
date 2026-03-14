import { describe, it, expect } from "vitest";
import {
  getTestamentSection,
  parseReference,
  extractBookName,
  SOURCE_TO_CATEGORY,
  BOOK_ORDER,
  BOOK_DISPLAY_NAMES,
} from "@/lib/utils/book-order";

describe("getTestamentSection", () => {
  it("returns ot for OT range (1-39)", () => {
    expect(getTestamentSection(1)).toBe("ot");   // Genesis
    expect(getTestamentSection(39)).toBe("ot");  // Malachi
  });

  it("returns nt for NT range (40-66)", () => {
    expect(getTestamentSection(40)).toBe("nt");  // Matthew
    expect(getTestamentSection(66)).toBe("nt");  // Revelation
  });

  it("returns deuterocanonical for range 67-86", () => {
    expect(getTestamentSection(67)).toBe("deuterocanonical"); // 1 Esdras
    expect(getTestamentSection(86)).toBe("deuterocanonical"); // Odes
  });

  it("returns ethiopian for range 100-106 (was previously returning other)", () => {
    expect(getTestamentSection(100)).toBe("ethiopian"); // 1 Enoch
    expect(getTestamentSection(101)).toBe("ethiopian"); // Jubilees
    expect(getTestamentSection(106)).toBe("ethiopian"); // 4 Ezra
  });

  it("returns other for values outside all defined ranges", () => {
    expect(getTestamentSection(107)).toBe("other");
    expect(getTestamentSection(150)).toBe("other"); // Prayer of Manasseh
    expect(getTestamentSection(999)).toBe("other");
  });
});

describe("SOURCE_TO_CATEGORY", () => {
  it("maps first1k_greek to patristic", () => {
    expect(SOURCE_TO_CATEGORY["first1k_greek"]).toBe("patristic");
  });

  it("maps coptic_scriptorium to patristic", () => {
    expect(SOURCE_TO_CATEGORY["coptic_scriptorium"]).toBe("patristic");
  });

  it("does not map biblical sources (they fall back to other at call site)", () => {
    expect(SOURCE_TO_CATEGORY["wlc"]).toBeUndefined();
    expect(SOURCE_TO_CATEGORY["sblgnt"]).toBeUndefined();
    expect(SOURCE_TO_CATEGORY["etcbc_dss"]).toBeUndefined();
    expect(SOURCE_TO_CATEGORY["sinaiticus_project"]).toBeUndefined();
  });
});

describe("parseReference", () => {
  it("parses canonical book references", () => {
    expect(parseReference("Genesis 1")).toEqual([1, 1]);
    expect(parseReference("Matthew 5")).toEqual([40, 5]);
    expect(parseReference("1 Corinthians 13")).toEqual([46, 13]);
    expect(parseReference("Revelation 22")).toEqual([66, 22]);
  });

  it("returns [999, chapter] for unknown (patristic) book names", () => {
    expect(parseReference("Basil of Caesarea Letters 1")).toEqual([999, 1]);
    expect(parseReference("Ignatius to the Ephesians 3")).toEqual([999, 3]);
    expect(parseReference("Shepherd of Hermas 12")).toEqual([999, 12]);
  });

  it("returns [999, 0] for completely unparseable references", () => {
    expect(parseReference("no number here")).toEqual([999, 0]);
    expect(parseReference("")).toEqual([999, 0]);
  });
});

describe("extractBookName", () => {
  it("extracts book name from standard references", () => {
    expect(extractBookName("Genesis 1")).toBe("Genesis");
    expect(extractBookName("Matthew 5")).toBe("Matthew");
    expect(extractBookName("1 Corinthians 13")).toBe("1 Corinthians");
  });

  it("extracts full title from patristic/OGL references", () => {
    expect(extractBookName("Basil of Caesarea Letters 1")).toBe("Basil of Caesarea Letters");
    expect(extractBookName("Ignatius to the Ephesians 3")).toBe("Ignatius to the Ephesians");
    expect(extractBookName("Shepherd of Hermas 12")).toBe("Shepherd of Hermas");
  });

  it("returns null for references with no trailing number", () => {
    expect(extractBookName("no number here")).toBeNull();
  });
});

describe("BOOK_ORDER and BOOK_DISPLAY_NAMES consistency", () => {
  it("has display names for all OT books", () => {
    for (let i = 1; i <= 39; i++) {
      expect(BOOK_DISPLAY_NAMES[i]).toBeTruthy();
    }
  });

  it("has display names for all NT books", () => {
    for (let i = 40; i <= 66; i++) {
      expect(BOOK_DISPLAY_NAMES[i]).toBeTruthy();
    }
  });

  it("BOOK_ORDER has lowercase keys", () => {
    for (const key of Object.keys(BOOK_ORDER)) {
      expect(key).toBe(key.toLowerCase());
    }
  });
});
