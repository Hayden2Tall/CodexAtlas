/**
 * Translation prompt construction utilities.
 *
 * Extracted from /api/translate/route.ts for testability.
 * All functions are pure (no I/O, no external calls).
 */

// ── System prompt ────────────────────────────────────────────────────────────

export const TRANSLATION_SYSTEM_PROMPT = `You are a specialist in ancient manuscript translation with doctoral expertise in Biblical Hebrew, Koine Greek, Coptic, Ge'ez, Classical Syriac, and related ancient languages. Your role is to produce scholarly translations that are:

- Faithful to the source text, prioritising what the text actually says over what is familiar or expected
- Academically rigorous, noting genuine uncertainties explicitly in translation_notes
- Consistent in terminology within a single translation session
- Clear in English while preserving structural features that carry semantic meaning

Call the submit_translation tool exactly once with your completed translation.`;

// ── Language names ───────────────────────────────────────────────────────────

const LANG_NAMES: Record<string, string> = {
  heb: "Biblical Hebrew",
  grc: "Koine Greek",
  cop: "Coptic",
  gez: "Ge'ez (Classical Ethiopic)",
  syc: "Classical Syriac",
  lat: "Latin",
  arm: "Classical Armenian",
  geo: "Classical Georgian",
  ara: "Classical Arabic",
};

export function getLangName(code: string): string {
  return LANG_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

// ── Language-specific instruction blocks ─────────────────────────────────────

const LANGUAGE_BLOCKS: Record<string, string> = {
  heb: `Biblical Hebrew specifics:
- The perfect/imperfect system expresses aspect and narrative sequence, not strict English past/future tense.
- Waw-consecutive (וַ/וְ prefix on a verb) inverts aspect — render as narrative sequence using English past tense for waw-consecutive imperfect.
- Construct chains express possession or relation without "of" in the source; prefer "of the LORD" over "the LORD's" for formal equivalence.
- Render יהוה as "the LORD" (small-caps convention) and אֱלֹהִים as "God" or "gods" by context.
- Follow the Masoretic vowel points as authoritative; note where a qere/ketiv variant materially affects meaning.
- Paragraph breaks (פ = open section, ס = closed section) should be preserved as paragraph breaks in the translation.
- The derived verbal stems (Niphal, Piel, Hiphil, Hophal, Hithpael) carry meaning — note where the stem significantly changes force (e.g. Hiphil = causative, Niphal = passive/reflexive).`,

  grc: `Koine Greek specifics:
- The aorist expresses punctiliar (completed/undefined) action; the present expresses progressive or repeated action — preserve this distinction where English allows.
- The Greek article is semantically rich; its absence is as significant as its presence. Anarthrous nouns often indicate quality or category.
- Participial phrases should generally become English subordinate clauses or relative clauses for readability.
- The genitive absolute construction expresses background circumstance — render as a temporal or causal clause.
- NT Greek shows strong LXX/Semitic influence in idiom; note where a phrase derives from Hebrew idiom and affects meaning.
- Use standard English NT name forms (Jesus not Yeshua, Peter not Petros, Galilee not Galilaia).`,

  grc_patristic: `Patristic and early Church Greek specifics:
- This text is theological, philosophical, or ecclesiastical prose — not biblical scripture.
- Translate with the formal register appropriate to early Christian intellectual writing.
- Technical theological vocabulary (λόγος, πνεῦμα, ἐκκλησία, οὐσία, ὑπόστασις, etc.) should either be retained in transliteration with an English gloss, or rendered with the standard English theological equivalent — note the Greek term in translation_notes.
- The author may use rhetorical structures (anaphora, chiasm, periodic sentences) — preserve these in English where possible.
- Do not modernise the idiom or flatten the theological precision.`,

  cop: `Coptic (Sahidic) specifics:
- Coptic retains an Egyptian substrate enriched with Koine Greek loanwords. Translate Greek loanwords into natural English.
- The copula is often implicit — supply "is/are/was/were" as needed for English clarity.
- Standard word order is Verb-Subject-Object; reorder to Subject-Verb-Object for natural English.
- This text is likely translated from a Greek Vorlage; where the Coptic diverges from known Greek parallels, note this in translation_notes.
- The Bohairic and Sahidic dialects differ in vocabulary; if dialect is known, note it.`,

  gez: `Ge'ez (Classical Ethiopic) specifics:
- Ge'ez is a South Semitic language with canonical VSO word order; reorder to English SVO.
- The text may be translated from Greek or Hebrew; translate the Ge'ez as it stands, noting significant divergence from known source texts.
- The Ethiopian biblical canon includes texts absent from the Protestant and Catholic canons (1 Enoch, Jubilees, Meqabyan, 4 Baruch, Ascension of Isaiah). Do not assume Protestant canonical scope.
- Note theological terms specific to the Ethiopian Orthodox Tewahedo tradition.
- The Fidel (Ge'ez) script is a syllabary; each character encodes consonant + vowel.`,

  syc: `Classical Syriac specifics:
- Syriac is an Aramaic dialect; the verb system uses perfect/imperfect aspect similar to Biblical Hebrew.
- The Peshitta is the standard Syriac OT/NT translation; context from the Peshitta tradition may be relevant.
- Pa'el and Af'el verb stems roughly parallel Hebrew Piel and Hiphil (intensive and causative).
- The divine name ܡܪܝܐ (Maryah) = LORD.
- Eastern (Nestorian) and Western (Serto) script traditions exist; the text meaning is the same.`,

  lat: `Classical/Ecclesiastical Latin specifics:
- Distinguish Classical Latin from Ecclesiastical/Vulgate Latin — the register and vocabulary differ.
- The Vulgate (Jerome, 4th c.) uses a different register from Ciceronian Latin; if this is Vulgate or post-classical, note it.
- Latin has no articles; supply "the/a/an" as needed in English.
- The ablative absolute functions like the Greek genitive absolute — render as a subordinate clause.
- Ecclesiastical terms (gratia, sacramentum, ecclesia, verbum) have technical theological meanings; note where the Latin term is theologically loaded.`,
};

const DEFAULT_LANGUAGE_BLOCK = `Translate the text faithfully. Note any significant textual difficulties, unusual vocabulary, or structural features that affect meaning.`;

/**
 * Returns the language-specific instruction block for a given ISO 639-3 code.
 * Pass isPatristic=true for grc texts from first1k_greek to get the patristic block.
 */
export function getLanguageBlock(langCode: string, isPatristic = false): string {
  const code = langCode.toLowerCase();
  if (code === "grc" && isPatristic) return LANGUAGE_BLOCKS.grc_patristic;
  return LANGUAGE_BLOCKS[code] ?? DEFAULT_LANGUAGE_BLOCK;
}

// ── Corpus context descriptions ───────────────────────────────────────────────

const CORPUS_DESCRIPTIONS: Record<string, string> = {
  wlc: "Westminster Leningrad Codex (1008–1010 CE) — the standard scholarly Hebrew Bible (Masoretic Text), fully pointed with vowel marks and cantillation accents",
  etcbc_dss: "Dead Sea Scrolls (ETCBC) — Hebrew manuscripts from Qumran (c. 250 BCE–68 CE); may contain orthographic variants, scribal corrections, and alternate readings relative to the Masoretic tradition",
  sblgnt: "SBL Greek New Testament (2010) — modern critical edition of the Greek NT by the Society of Biblical Literature",
  thgnt: "Tyndale House Greek New Testament (2017) — conservative critical edition based on the oldest available manuscripts",
  sinaiticus_project: "Codex Sinaiticus (c. 330–360 CE) — oldest nearly complete Greek Bible; scholarly transcription of the Sinai manuscript",
  coptic_scriptorium: "Coptic Scriptorium — scholarly TEI-XML transcriptions of Sahidic Coptic NT manuscripts",
  oshb: "Open Scriptures Hebrew Bible — morphologically tagged Hebrew Bible text derived from the Westminster Leningrad Codex",
  first1k_greek: "OpenGreekAndLatin / First1KGreek — scholarly TEI-XML transcriptions of early Greek patristic and classical works (non-biblical)",
};

const DEFAULT_CORPUS_DESCRIPTION = "Ancient manuscript text — specific corpus not identified";

/** Returns a human-readable description of the source corpus for prompt injection. */
export function getCorpusDescription(sourceId: string | undefined): string {
  if (!sourceId) return DEFAULT_CORPUS_DESCRIPTION;
  return CORPUS_DESCRIPTIONS[sourceId] ?? `Source corpus: ${sourceId}`;
}

// ── Parallel text ─────────────────────────────────────────────────────────────

export interface ParallelText {
  sourceLabel: string;
  text: string;
}

// ── Prompt builder ────────────────────────────────────────────────────────────

export interface TranslationPromptInput {
  originalText: string;
  originalLanguage: string;
  targetLanguage: string;
  manuscriptTitle: string;
  dateStart: number | null;
  dateEnd: number | null;
  origin: string | null;
  transcriptionMethod: string | null;
  sourceId: string | undefined;
  parallelText: ParallelText | null;
}

export function buildTranslationPrompt(input: TranslationPromptInput): string {
  const {
    originalText,
    originalLanguage,
    targetLanguage,
    manuscriptTitle,
    dateStart,
    dateEnd,
    origin,
    transcriptionMethod,
    sourceId,
    parallelText,
  } = input;

  const langName = getLangName(originalLanguage);
  const isPatristic = sourceId === "first1k_greek";
  const langBlock = getLanguageBlock(originalLanguage, isPatristic);
  const corpusDesc = getCorpusDescription(sourceId);

  const dateRange =
    dateStart && dateEnd
      ? `${dateStart < 0 ? Math.abs(dateStart) + " BCE" : dateStart + " CE"}–${Math.abs(dateEnd)} ${dateEnd < 0 ? "BCE" : "CE"}`
      : dateStart
        ? `c. ${Math.abs(dateStart)} ${dateStart < 0 ? "BCE" : "CE"}`
        : "date unknown";

  const parallelSection =
    parallelText && parallelText.text.length > 50
      ? `
=== PARALLEL ATTESTATION (reference only — translate independently from primary text above) ===
${parallelText.sourceLabel}:
${parallelText.text}
`
      : "";

  return `Translate the following ${langName} passage to ${targetLanguage}.

=== MANUSCRIPT CONTEXT ===
Title: ${manuscriptTitle}
Corpus: ${corpusDesc}
Estimated date: ${dateRange}
Origin: ${origin ?? "unknown"}
Transcription: ${transcriptionMethod ?? "unknown"}

=== LANGUAGE-SPECIFIC GUIDANCE ===
${langBlock}
${parallelSection}
=== ORIGINAL TEXT ===
${originalText}

=== CONFIDENCE SCORE GUIDANCE ===
Set confidence_score to reflect your translation certainty only. Do NOT penalise for working from a single manuscript witness — all translations here are single-source by design.
- 0.95+ : Clear, unambiguous text; standard vocabulary and well-understood grammar
- 0.85–0.94 : Minor lexical choices with strong scholarly consensus; negligible uncertainty
- 0.70–0.84 : Meaningful ambiguities in vocabulary or grammar; multiple defensible readings
- 0.50–0.69 : Significant portions uncertain; disputed terminology; several viable interpretations
- 0.30–0.49 : Substantially fragmentary; highly uncertain vocabulary or syntax
- Below 0.30 : Largely speculative; extensive reconstruction required`;
}

