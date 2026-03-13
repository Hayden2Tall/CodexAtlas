import { describe, it, expect } from "vitest";
import {
  SOURCE_REGISTRY,
  findRegistrySource,
  getRegistryEntry,
} from "@/lib/utils/source-registry";

// ---------------------------------------------------------------------------
// findRegistrySource
// ---------------------------------------------------------------------------
describe("findRegistrySource", () => {
  it("finds Sinaiticus by title", () => {
    const entry = findRegistrySource("Codex Sinaiticus");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("sinaiticus");
    expect(entry!.sourceId).toBe("sinaiticus_project");
    expect(entry!.transcriptionMethod).toBe("scholarly_transcription");
  });

  it("finds Sinaiticus case-insensitively", () => {
    const entry = findRegistrySource("codex sinaiticus");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("sinaiticus");
  });

  it("finds Westminster Leningrad Codex", () => {
    const entry = findRegistrySource("Westminster Leningrad Codex", "heb");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("wlc");
    expect(entry!.sourceId).toBe("wlc");
  });

  it("finds Leningrad Codex alias", () => {
    const entry = findRegistrySource("Leningrad Codex", "heb");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("wlc");
  });

  it("finds Dead Sea Scrolls", () => {
    const entry = findRegistrySource("Dead Sea Scrolls", "heb");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("dss");
    expect(entry!.sourceId).toBe("etcbc_dss");
  });

  it("finds SBLGNT by exact title", () => {
    const entry = findRegistrySource("SBLGNT", "grc");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("sblgnt");
    expect(entry!.transcriptionMethod).toBe("standard_edition");
  });

  it("finds Tyndale House GNT", () => {
    const entry = findRegistrySource("Tyndale House GNT", "grc");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("thgnt");
  });

  it("finds Coptic Scriptorium", () => {
    const entry = findRegistrySource("Coptic Scriptorium", "cop");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("coptic");
    expect(entry!.sourceId).toBe("coptic_scriptorium");
  });

  it("finds Open Scriptures Hebrew Bible", () => {
    const entry = findRegistrySource("Open Scriptures Hebrew Bible", "heb");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("oshb");
  });

  it("finds OpenGreekAndLatin", () => {
    const entry = findRegistrySource("OpenGreekAndLatin", "grc");
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe("ogl");
  });

  it("returns null for unknown manuscript", () => {
    expect(findRegistrySource("Unknown Papyrus X", "grc")).toBeNull();
    expect(findRegistrySource("Chester Beatty III", "grc")).toBeNull();
  });

  it("respects language hint for disambiguation", () => {
    // WLC is heb; should not match for grc
    const hebrewEntry = findRegistrySource("Westminster Leningrad Codex", "heb");
    expect(hebrewEntry).not.toBeNull();
    const greekEntry = findRegistrySource("Westminster Leningrad Codex", "grc");
    expect(greekEntry).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getRegistryEntry
// ---------------------------------------------------------------------------
describe("getRegistryEntry", () => {
  it("finds entry by sourceId", () => {
    expect(getRegistryEntry("sinaiticus_project")?.id).toBe("sinaiticus");
    expect(getRegistryEntry("etcbc_dss")?.id).toBe("dss");
    expect(getRegistryEntry("wlc")?.id).toBe("wlc");
    expect(getRegistryEntry("sblgnt")?.id).toBe("sblgnt");
  });

  it("returns undefined for unknown sourceId", () => {
    expect(getRegistryEntry("nonexistent")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SOURCE_REGISTRY integrity
// ---------------------------------------------------------------------------
describe("SOURCE_REGISTRY entries", () => {
  const VALID_METHODS = ["scholarly_transcription", "standard_edition"] as const;
  const VALID_COVERAGE = ["ot", "nt", "full", "patristic", "mixed"] as const;

  for (const [key, entry] of Object.entries(SOURCE_REGISTRY)) {
    it(`entry "${key}" has required fields`, () => {
      expect(entry.id).toBeTruthy();
      expect(entry.sourceId).toBeTruthy();
      expect(entry.displayName).toBeTruthy();
      expect(entry.language).toBeTruthy();
      expect(entry.preprocessorScript).toBeTruthy();
      expect(entry.manuscriptNames.length).toBeGreaterThan(0);
      expect(VALID_METHODS).toContain(entry.transcriptionMethod);
      expect(VALID_COVERAGE).toContain(entry.coverage);
    });
  }
});
