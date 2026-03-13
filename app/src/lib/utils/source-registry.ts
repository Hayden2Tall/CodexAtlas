/**
 * Source Registry — maps open-access manuscript corpora to their DB identifiers.
 *
 * Each entry describes a pre-cataloged corpus that is bulk-imported into the
 * `manuscript_source_texts` table via CLI preprocessor scripts.  The section-text
 * chain consults this registry (Step 1) before trying any live API.
 */

export interface SourceRegistryEntry {
  /** Stable registry key, also used as a lookup identifier. */
  id: string;
  /** Human-readable name shown in the admin panel. */
  displayName: string;
  /** SPDX license identifier or short description. */
  license: string;
  /** ISO 639-3 language code (lowercase). */
  language: string;
  /** Scripture coverage. */
  coverage: "ot" | "nt" | "full" | "patristic" | "mixed";
  /**
   * Manuscript titles stored in `manuscript_source_texts.manuscript_name`.
   * The first value is the canonical display name; additional values are aliases.
   */
  manuscriptNames: string[];
  /** Canonical download / repository URL (for documentation; CLI scripts handle actual download). */
  downloadUrl: string;
  /** Source file format. */
  format: "tei-xml" | "osis-xml" | "tsv" | "txt" | "json";
  /** Filename (without path) of the CLI preprocessor script. */
  preprocessorScript: string;
  /**
   * Value stored in `manuscript_source_texts.source` column.
   * Also the value used for DB queries in the section-text chain.
   */
  sourceId: string;
  /** Transcription method to assign when creating/updating passages from this source. */
  transcriptionMethod: "scholarly_transcription" | "standard_edition";
}

export const SOURCE_REGISTRY: Record<string, SourceRegistryEntry> = {
  sinaiticus: {
    id: "sinaiticus",
    displayName: "Codex Sinaiticus",
    license: "CC BY-NC-SA 3.0",
    language: "grc",
    coverage: "full",
    manuscriptNames: ["Codex Sinaiticus", "Sinaiticus"],
    downloadUrl: "https://codexsinaiticus.org/en/project/transcription.aspx",
    format: "tei-xml",
    preprocessorScript: "preprocess-sinaiticus.mjs",
    sourceId: "sinaiticus_project",
    transcriptionMethod: "scholarly_transcription",
  },

  dss: {
    id: "dss",
    displayName: "Dead Sea Scrolls (ETCBC)",
    license: "CC BY-NC 4.0",
    language: "heb",
    coverage: "ot",
    manuscriptNames: ["Dead Sea Scrolls", "Dead Sea Scrolls (ETCBC)"],
    downloadUrl: "https://github.com/ETCBC/dss",
    format: "json",
    preprocessorScript: "preprocess-dss.mjs",
    sourceId: "etcbc_dss",
    transcriptionMethod: "scholarly_transcription",
  },

  wlc: {
    id: "wlc",
    displayName: "Westminster Leningrad Codex",
    license: "Public domain",
    language: "heb",
    coverage: "ot",
    manuscriptNames: [
      "Westminster Leningrad Codex",
      "Leningrad Codex",
      "Codex Leningradensis",
      "Firkovich B 19A",
      "Leningradensis",
    ],
    downloadUrl: "https://github.com/openscriptures/morphhb",
    format: "osis-xml",
    preprocessorScript: "preprocess-wlc.mjs",
    sourceId: "wlc",
    transcriptionMethod: "scholarly_transcription",
  },

  sblgnt: {
    id: "sblgnt",
    displayName: "SBL Greek New Testament",
    license: "CC BY 4.0",
    language: "grc",
    coverage: "nt",
    manuscriptNames: ["SBLGNT", "SBL Greek New Testament"],
    downloadUrl: "https://github.com/LogosBible/SBLGNT",
    format: "txt",
    preprocessorScript: "preprocess-sblgnt.mjs",
    sourceId: "sblgnt",
    transcriptionMethod: "standard_edition",
  },

  thgnt: {
    id: "thgnt",
    displayName: "Tyndale House Greek New Testament",
    license: "CC BY 4.0",
    language: "grc",
    coverage: "nt",
    manuscriptNames: ["Tyndale House GNT", "THGNT", "Tyndale House Greek New Testament"],
    downloadUrl: "https://github.com/STEPBible/STEPBible-Data",
    format: "tsv",
    preprocessorScript: "preprocess-thgnt.mjs",
    sourceId: "thgnt",
    transcriptionMethod: "standard_edition",
  },

  coptic: {
    id: "coptic",
    displayName: "Coptic Scriptorium",
    license: "CC BY 4.0",
    language: "cop",
    coverage: "mixed",
    manuscriptNames: ["Coptic Scriptorium", "Sahidic NT", "Coptic Scriptorium (Sahidic NT)"],
    downloadUrl: "https://github.com/CopticScriptorium/corpora",
    format: "tei-xml",
    preprocessorScript: "preprocess-coptic.mjs",
    sourceId: "coptic_scriptorium",
    transcriptionMethod: "scholarly_transcription",
  },

  oshb: {
    id: "oshb",
    displayName: "Open Scriptures Hebrew Bible",
    license: "CC BY 4.0",
    language: "heb",
    coverage: "ot",
    manuscriptNames: ["Open Scriptures Hebrew Bible", "OSHB"],
    downloadUrl: "https://github.com/openscriptures/morphhb",
    format: "osis-xml",
    preprocessorScript: "preprocess-oshb.mjs",
    sourceId: "oshb",
    transcriptionMethod: "standard_edition",
  },

  ogl: {
    id: "ogl",
    displayName: "OpenGreekAndLatin (First1KGreek)",
    license: "CC-BY or equivalent per work",
    language: "grc",
    coverage: "patristic",
    manuscriptNames: ["OpenGreekAndLatin", "First1KGreek"],
    downloadUrl: "https://github.com/OpenGreekAndLatin/First1KGreek",
    format: "tei-xml",
    preprocessorScript: "preprocess-ogl.mjs",
    sourceId: "first1k_greek",
    transcriptionMethod: "scholarly_transcription",
  },
};

/**
 * Find a registry entry that claims the given manuscript title (case-insensitive).
 * Also accepts an optional language hint for disambiguation between same-named sources.
 *
 * Returns `null` if no entry matches — the section-text chain should fall through to NTVMR.
 */
export function findRegistrySource(
  manuscriptTitle: string,
  language?: string
): SourceRegistryEntry | null {
  const titleLower = manuscriptTitle.toLowerCase().trim();
  const langLower = language?.toLowerCase().trim();

  for (const entry of Object.values(SOURCE_REGISTRY)) {
    const nameMatch = entry.manuscriptNames.some(
      (n) => n.toLowerCase() === titleLower
    );
    if (!nameMatch) continue;

    // If a language hint is given, prefer entries whose language matches,
    // but still return a match if language is not specified.
    if (langLower && entry.language !== langLower) continue;

    return entry;
  }

  return null;
}

/**
 * Look up a registry entry by its `sourceId` (the value stored in the DB `source` column).
 */
export function getRegistryEntry(sourceId: string): SourceRegistryEntry | undefined {
  return Object.values(SOURCE_REGISTRY).find((e) => e.sourceId === sourceId);
}
