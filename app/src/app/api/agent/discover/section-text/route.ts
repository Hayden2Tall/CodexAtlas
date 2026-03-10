import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import {
  NTVMR_MANUSCRIPTS,
  NT_SBL_BOOKS,
  LENINGRAD_TITLES,
  BOLLS_LIFE_LANGUAGES,
  LANGUAGE_NAMES,
  parseBookAndChapter,
  textHasCorrectScript as textHasCorrectScriptBase,
  parseNtvmrHtml,
  parseSblgntChapter,
  SOURCE_LABELS,
} from "@/lib/utils/text-sources";
import type { SourceChainStep } from "@/lib/utils/text-sources";
import type { UserRole, User, Passage } from "@/lib/types";

export const maxDuration = 60;

const ADMIN_ROLES: UserRole[] = ["admin", "editor"];

async function fetchFromNtvmr(
  manuscriptTitle: string,
  reference: string
): Promise<{ text: string; docId: number; gaNumber: string } | null> {
  const titleLower = manuscriptTitle.toLowerCase().trim();
  const docId = NTVMR_MANUSCRIPTS[titleLower];
  if (!docId) return null;

  const match = reference.match(/^(.+?)\s+(\d+)$/);
  if (!match) return null;
  const bookName = match[1].toLowerCase().trim();
  const chapter = match[2];
  const ntvmrBook = NT_SBL_BOOKS[bookName];
  if (!ntvmrBook) return null;

  const gaNumber = docId >= 20000 ? String(docId - 20000).padStart(2, "0") : `P${docId - 10000}`;
  const indexContent = `${ntvmrBook}.${chapter}`;
  const url = `https://ntvmr.uni-muenster.de/community/vmr/api/transcript/get/?docID=${docId}&format=html&indexContent=${indexContent}&pageID=ALL`;

  console.log(`[section-text] NTVMR: fetching ${url}`);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.log(`[section-text] NTVMR: HTTP ${res.status}`);
      return null;
    }

    const html = await res.text();
    if (!html || html.length < 100) return null;

    const text = parseNtvmrHtml(html);
    if (text.length < 50) {
      console.log(`[section-text] NTVMR: parsed text too short (${text.length} chars)`);
      return null;
    }

    return { text, docId, gaNumber };
  } catch (err) {
    console.log(`[section-text] NTVMR: fetch error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function fetchFromBibleApi(
  language: string,
  reference: string
): Promise<{ text: string; edition: string } | null> {
  const parsed = parseBookAndChapter(reference);
  if (!parsed) {
    console.log(`[section-text] bolls.life: cannot parse reference "${reference}"`);
    return null;
  }

  let translation: string;
  if (language === "grc") {
    translation = parsed.bookNum >= 40 && parsed.bookNum <= 66 ? "TR" : "LXX";
  } else if (language === "heb") {
    translation = "WLC";
  } else {
    console.log(`[section-text] bolls.life: unsupported language "${language}"`);
    return null;
  }

  const url = `https://bolls.life/get-text/${translation}/${parsed.bookNum}/${parsed.chapter}/`;
  console.log(`[section-text] bolls.life: fetching ${url}`);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.log(`[section-text] bolls.life: HTTP ${res.status}`);
      return null;
    }

    const verses: Array<{ verse: number; text: string }> = await res.json();
    if (!Array.isArray(verses) || verses.length === 0) {
      console.log(`[section-text] bolls.life: empty/invalid response`);
      return null;
    }

    const text = verses
      .sort((a, b) => a.verse - b.verse)
      .map((v) => v.text.replace(/<[^>]*>/g, "").trim())
      .filter(Boolean)
      .join("\n");

    console.log(`[section-text] bolls.life: got ${text.length} chars from ${translation}`);
    return text.length > 50 ? { text, edition: translation } : null;
  } catch (err) {
    console.log(`[section-text] bolls.life: error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function fetchFromSblgnt(
  reference: string
): Promise<{ text: string; edition: string } | null> {
  const match = reference.match(/^(.+?)\s+(\d+)$/);
  if (!match) {
    console.log(`[section-text] SBLGNT: cannot parse reference "${reference}"`);
    return null;
  }
  const bookName = match[1].toLowerCase().trim();
  const chapter = match[2];
  const sblBook = NT_SBL_BOOKS[bookName];
  if (!sblBook) {
    console.log(`[section-text] SBLGNT: "${bookName}" not an NT book`);
    return null;
  }

  const url = `https://raw.githubusercontent.com/LogosBible/SBLGNT/master/data/sblgnt/text/${sblBook}.txt`;
  console.log(`[section-text] SBLGNT: fetching ${url}`);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.log(`[section-text] SBLGNT: HTTP ${res.status}`);
      return null;
    }

    const fullText = await res.text();
    const verses = parseSblgntChapter(fullText, sblBook, chapter);
    if (verses.length === 0) {
      console.log(`[section-text] SBLGNT: no verses for ${sblBook} ch${chapter}`);
      return null;
    }
    const text = verses.join("\n");
    console.log(`[section-text] SBLGNT: got ${text.length} chars, ${verses.length} verses`);
    return text.length > 50 ? { text, edition: "SBLGNT" } : null;
  } catch (err) {
    console.log(`[section-text] SBLGNT: error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function fetchFromSinaiticusProject(
  admin: AdminClient,
  reference: string
): Promise<{ text: string } | null> {
  const match = reference.match(/^(.+?)\s+(\d+)$/);
  if (!match) {
    console.log(`[section-text] Sinaiticus: cannot parse reference "${reference}"`);
    return null;
  }
  const bookName = match[1].trim();
  const chapter = parseInt(match[2], 10);

  try {
    const { data, error } = await admin
      .from("manuscript_source_texts")
      .select("text")
      .eq("source", "sinaiticus_project")
      .ilike("book", bookName)
      .eq("chapter", chapter)
      .single();

    if (error) {
      console.log(`[section-text] Sinaiticus: DB query error for "${bookName}" ch${chapter}:`, error.message);
      return null;
    }
    if (!data?.text || data.text.length < 50) {
      console.log(`[section-text] Sinaiticus: ${data ? `text too short (${data.text?.length ?? 0} chars)` : "no row"} for "${bookName}" ch${chapter}`);
      return null;
    }
    console.log(`[section-text] Sinaiticus: found ${data.text.length} chars for "${bookName}" ch${chapter}`);
    return { text: data.text };
  } catch (err) {
    console.log(`[section-text] Sinaiticus: error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function fetchFromDss(
  admin: AdminClient,
  reference: string
): Promise<{ text: string; scrollId: string } | null> {
  const match = reference.match(/^(.+?)\s+(\d+)$/);
  if (!match) {
    console.log(`[section-text] DSS: cannot parse reference "${reference}"`);
    return null;
  }
  const bookName = match[1].trim();
  const chapter = parseInt(match[2], 10);

  try {
    const { data, error } = await admin
      .from("manuscript_source_texts")
      .select("text, manuscript_name")
      .eq("source", "etcbc_dss")
      .ilike("book", bookName)
      .eq("chapter", chapter)
      .single();

    if (error) {
      console.log(`[section-text] DSS: DB query error for "${bookName}" ch${chapter}:`, error.message);
      return null;
    }
    if (!data?.text || data.text.length < 50) {
      console.log(`[section-text] DSS: ${data ? `text too short (${data.text?.length ?? 0} chars)` : "no row"} for "${bookName}" ch${chapter}`);
      return null;
    }
    console.log(`[section-text] DSS: found ${data.text.length} chars for "${bookName}" ch${chapter} (${data.manuscript_name})`);
    return { text: data.text, scrollId: data.manuscript_name };
  } catch (err) {
    console.log(`[section-text] DSS: error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single<Pick<User, "role">>();
  if (!profile || !ADMIN_ROLES.includes(profile.role as UserRole)) return null;
  return user;
}

/**
 * POST /api/agent/discover/section-text
 *
 * Retrieves the full original-language text for a single section of a
 * manuscript and saves it as a passage. Called iteratively by the client
 * during a full-import operation.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await requireAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      manuscript_id,
      manuscript_title,
      original_language,
      reference,
      description,
      sequence_order,
    } = body;

    if (!manuscript_id || !reference || !manuscript_title) {
      return NextResponse.json(
        { error: "manuscript_id, manuscript_title, and reference are required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const lang = (original_language ?? "grc").toLowerCase();
    const langName = LANGUAGE_NAMES[lang] ?? lang;
    const requestId = Math.random().toString(36).slice(2, 8);

    console.log(`[section-text][${requestId}] START ref="${reference}" ms="${manuscript_title}" lang=${lang} msId=${manuscript_id}`);

    // Check if passage already exists
    const { data: existing } = await admin
      .from("passages")
      .select("id, reference, original_text")
      .eq("manuscript_id", manuscript_id)
      .ilike("reference", reference.trim());

    // Use a lower threshold for fragmentary manuscripts to avoid over-skipping
    const MIN_TEXT_LENGTH = 100;

    function textHasCorrectScript(text: string): boolean {
      return textHasCorrectScriptBase(text, lang);
    }

    const existingComplete = existing?.find(
      (p) =>
        p.original_text &&
        p.original_text.trim().length >= MIN_TEXT_LENGTH &&
        textHasCorrectScript(p.original_text)
    );

    if (existingComplete) {
      console.log(`[section-text][${requestId}] SKIP existing passage ${existingComplete.id} has ${existingComplete.original_text?.length ?? 0} chars of valid ${lang} text`);
      return NextResponse.json({
        passage_id: existingComplete.id,
        skipped: true,
        reason: `Already imported (${existingComplete.original_text?.length ?? 0} chars)`,
      });
    }

    const existingToUpdate = existing?.[0] ?? null;

    if (existingToUpdate) {
      console.log(`[section-text][${requestId}] OVERWRITE existing passage ${existingToUpdate.id} (${existingToUpdate.original_text?.length ?? 0} chars)`);
    } else {
      console.log(`[section-text][${requestId}] NEW passage`);
    }

    // === TEXT SOURCE CHAIN (with reasoning) ===
    type TextSource = "sinaiticus-project" | "ntvmr" | "dss" | "leningrad-wlc" | "sblgnt" | "bible-api" | "ai";
    let originalText = "";
    let sourceType: TextSource = "ai";
    let sourceDetail = "";
    let tokensInput = 0;
    let tokensOutput = 0;
    let costUsd = 0;
    const chain: SourceChainStep[] = [];

    const titleLower = manuscript_title.toLowerCase().trim();
    const isSinaiticus = titleLower.includes("sinaiticus");
    const isLeningrad = LENINGRAD_TITLES.has(titleLower);
    const bookMatch = reference.match(/^(.+?)\s+(\d+)$/);
    const bookNameLower = bookMatch?.[1]?.toLowerCase().trim() ?? reference.toLowerCase().trim();
    const isNtBook = !!NT_SBL_BOOKS[bookNameLower];
    const hasChapter = !!bookMatch;

    if (!hasChapter) {
      console.log(`[section-text][${requestId}] WARN: reference "${reference}" has no chapter number — source lookups that require "Book N" format will be skipped`);
    }

    console.log(`[section-text][${requestId}] CONTEXT: sinaiticus=${isSinaiticus} leningrad=${isLeningrad} nt=${isNtBook} hasChapter=${hasChapter} book="${bookNameLower}" bolls=${BOLLS_LIFE_LANGUAGES.has(lang)}`);


    // STEP 1: Codex Sinaiticus Project
    {
      if (!isSinaiticus) {
        chain.push({ step: 1, source: "sinaiticus-project", attempted: false, result: "not_applicable", reason: `Not Codex Sinaiticus`, durationMs: 0 });
      } else if (!hasChapter) {
        chain.push({ step: 1, source: "sinaiticus-project", attempted: false, result: "not_applicable", reason: `Reference "${reference}" has no chapter number`, durationMs: 0 });
      } else {
        const t0 = Date.now();
        const sinResult = await fetchFromSinaiticusProject(admin, reference);
        const ms = Date.now() - t0;
        if (sinResult && textHasCorrectScript(sinResult.text)) {
          chain.push({ step: 1, source: "sinaiticus-project", attempted: true, result: "success", reason: `Found ${sinResult.text.length} chars of manuscript-specific transcription`, durationMs: ms });
          originalText = sinResult.text;
          sourceType = "sinaiticus-project";
          console.log(`[section-text][${requestId}] STEP1 sinaiticus-project → SUCCESS (${sinResult.text.length} chars)`);
        } else if (sinResult) {
          chain.push({ step: 1, source: "sinaiticus-project", attempted: true, result: "wrong_script", reason: "Data found but text is in wrong script", durationMs: ms });
          console.log(`[section-text][${requestId}] STEP1 sinaiticus-project → wrong_script`);
        } else {
          chain.push({ step: 1, source: "sinaiticus-project", attempted: true, result: "no_data", reason: "No data — run scripts/preprocess-sinaiticus.mjs", durationMs: ms });
          console.log(`[section-text][${requestId}] STEP1 sinaiticus-project → no_data`);
        }
      }
    }

    // STEP 2: NTVMR
    if (!originalText) {
      const docId = NTVMR_MANUSCRIPTS[titleLower];
      if (!docId) {
        chain.push({ step: 2, source: "ntvmr", attempted: false, result: "not_applicable", reason: `No NTVMR mapping for "${manuscript_title}"`, durationMs: 0 });
      } else if (!hasChapter) {
        chain.push({ step: 2, source: "ntvmr", attempted: false, result: "not_applicable", reason: `Reference "${reference}" has no chapter number`, durationMs: 0 });
      } else if (!isNtBook) {
        chain.push({ step: 2, source: "ntvmr", attempted: false, result: "not_applicable", reason: `"${bookMatch?.[1] ?? reference}" is not NT — NTVMR is NT-only`, durationMs: 0 });
      } else {
        const t0 = Date.now();
        const ntvmrResult = await fetchFromNtvmr(manuscript_title, reference);
        const ms = Date.now() - t0;
        if (ntvmrResult && textHasCorrectScript(ntvmrResult.text)) {
          chain.push({ step: 2, source: "ntvmr", attempted: true, result: "success", reason: `GA ${ntvmrResult.gaNumber}: ${ntvmrResult.text.length} chars`, durationMs: ms });
          originalText = ntvmrResult.text;
          sourceType = "ntvmr";
          sourceDetail = JSON.stringify({ ga_number: ntvmrResult.gaNumber, doc_id: ntvmrResult.docId });
          console.log(`[section-text][${requestId}] STEP2 ntvmr → SUCCESS (${ntvmrResult.text.length} chars, GA ${ntvmrResult.gaNumber})`);
        } else if (ntvmrResult) {
          chain.push({ step: 2, source: "ntvmr", attempted: true, result: "wrong_script", reason: "Transcript returned but wrong script", durationMs: ms });
          console.log(`[section-text][${requestId}] STEP2 ntvmr → wrong_script`);
        } else {
          chain.push({ step: 2, source: "ntvmr", attempted: true, result: "no_data", reason: "No transcript for this chapter (may not exist in manuscript)", durationMs: ms });
          console.log(`[section-text][${requestId}] STEP2 ntvmr → no_data`);
        }
      }
    }

    // STEP 3: Dead Sea Scrolls (Hebrew OT only)
    if (!originalText) {
      if (lang !== "heb") {
        chain.push({ step: 3, source: "dss", attempted: false, result: "not_applicable", reason: `Language "${langName}" — DSS is Hebrew OT only`, durationMs: 0 });
      } else if (isNtBook) {
        chain.push({ step: 3, source: "dss", attempted: false, result: "not_applicable", reason: `"${bookMatch?.[1] ?? reference}" is NT — DSS is OT only`, durationMs: 0 });
      } else if (!hasChapter) {
        chain.push({ step: 3, source: "dss", attempted: false, result: "not_applicable", reason: `Reference "${reference}" has no chapter number`, durationMs: 0 });
      } else {
        const t0 = Date.now();
        const dssResult = await fetchFromDss(admin, reference);
        const ms = Date.now() - t0;
        if (dssResult && textHasCorrectScript(dssResult.text)) {
          chain.push({ step: 3, source: "dss", attempted: true, result: "success", reason: `${dssResult.scrollId}: ${dssResult.text.length} chars`, durationMs: ms });
          originalText = dssResult.text;
          sourceType = "dss";
          sourceDetail = dssResult.scrollId;
          console.log(`[section-text][${requestId}] STEP3 dss → SUCCESS (${dssResult.text.length} chars)`);
        } else if (dssResult) {
          chain.push({ step: 3, source: "dss", attempted: true, result: "wrong_script", reason: "DSS data found but wrong script", durationMs: ms });
          console.log(`[section-text][${requestId}] STEP3 dss → wrong_script`);
        } else {
          chain.push({ step: 3, source: "dss", attempted: true, result: "no_data", reason: "Book/chapter not in DSS corpus", durationMs: ms });
          console.log(`[section-text][${requestId}] STEP3 dss → no_data`);
        }
      }
    }

    // STEP 4: SBLGNT (Greek NT critical edition)
    if (!originalText) {
      if (lang !== "grc") {
        chain.push({ step: 4, source: "sblgnt", attempted: false, result: "not_applicable", reason: `Language is ${langName} — SBLGNT is Greek only`, durationMs: 0 });
      } else if (!isNtBook) {
        chain.push({ step: 4, source: "sblgnt", attempted: false, result: "not_applicable", reason: `"${bookMatch?.[1] ?? reference}" is not NT — SBLGNT is NT-only`, durationMs: 0 });
      } else if (!hasChapter) {
        chain.push({ step: 4, source: "sblgnt", attempted: false, result: "not_applicable", reason: `Reference "${reference}" has no chapter number`, durationMs: 0 });
      } else {
        const t0 = Date.now();
        const sblResult = await fetchFromSblgnt(reference);
        const ms = Date.now() - t0;
        if (sblResult && textHasCorrectScript(sblResult.text)) {
          chain.push({ step: 4, source: "sblgnt", attempted: true, result: "success", reason: `${sblResult.text.length} chars of SBLGNT critical edition`, durationMs: ms });
          originalText = sblResult.text;
          sourceType = "sblgnt";
          sourceDetail = "SBLGNT";
          console.log(`[section-text][${requestId}] STEP4 sblgnt → SUCCESS (${sblResult.text.length} chars)`);
        } else {
          chain.push({ step: 4, source: "sblgnt", attempted: true, result: "no_data", reason: "SBLGNT file not found or chapter not present", durationMs: ms });
          console.log(`[section-text][${requestId}] STEP4 sblgnt → no_data`);
        }
      }
    }

    // STEP 5: bolls.life standard edition (Greek/Hebrew only)
    if (!originalText) {
      if (!BOLLS_LIFE_LANGUAGES.has(lang)) {
        chain.push({ step: 5, source: "bible-api", attempted: false, result: "not_applicable", reason: `bolls.life only supports Greek/Hebrew, not ${langName}`, durationMs: 0 });
        console.log(`[section-text][${requestId}] STEP5 bolls.life → not_applicable (${lang})`);
      } else if (!hasChapter) {
        chain.push({ step: 5, source: "bible-api", attempted: false, result: "not_applicable", reason: `Reference "${reference}" has no chapter number`, durationMs: 0 });
      } else {
        const t0 = Date.now();
        const apiResult = await fetchFromBibleApi(lang, reference);
        const ms = Date.now() - t0;
        if (apiResult && textHasCorrectScript(apiResult.text)) {
          if (isLeningrad && apiResult.edition === "WLC") {
            chain.push({ step: 5, source: "leningrad-wlc", attempted: true, result: "success", reason: `WLC recognized as Leningrad Codex — ${apiResult.text.length} chars`, durationMs: ms });
            originalText = apiResult.text;
            sourceType = "leningrad-wlc";
            sourceDetail = "WLC";
            console.log(`[section-text][${requestId}] STEP5 leningrad-wlc → SUCCESS (${apiResult.text.length} chars)`);
          } else {
            chain.push({ step: 5, source: "bible-api", attempted: true, result: "success", reason: `${apiResult.edition} standard edition — ${apiResult.text.length} chars (not manuscript-specific)`, durationMs: ms });
            originalText = apiResult.text;
            sourceType = "bible-api";
            sourceDetail = apiResult.edition;
            console.log(`[section-text][${requestId}] STEP5 bolls.life → SUCCESS (${apiResult.edition}, ${apiResult.text.length} chars)`);
          }
        } else if (apiResult) {
          chain.push({ step: 5, source: "bible-api", attempted: true, result: "wrong_script", reason: "bolls.life returned text but wrong script", durationMs: ms });
          console.log(`[section-text][${requestId}] STEP5 bolls.life → wrong_script`);
        } else {
          chain.push({ step: 5, source: "bible-api", attempted: true, result: "no_data", reason: "bolls.life API unavailable or book/chapter not found", durationMs: ms });
          console.log(`[section-text][${requestId}] STEP5 bolls.life → no_data`);
        }
      }
    }

    // STEP 6: AI models (final fallback)
    if (!originalText) {
      console.log(`[section-text][${requestId}] STEP6 falling back to AI for "${reference}" (${langName})`);
      const t0 = Date.now();
      const aiText = await fetchFromAiModels(
        manuscript_title, lang, reference, textHasCorrectScript
      );
      const ms = Date.now() - t0;

      if (aiText.error) {
        chain.push({ step: 6, source: "ai", attempted: true, result: "no_data", reason: aiText.error, durationMs: ms });
        console.log(`[section-text][${requestId}] CHAIN COMPLETE — ALL FAILED`, chain.map(s => `${s.step}:${s.source}=${s.result}`).join(", "));
        if (aiText.skipped) {
          return NextResponse.json({
            passage_id: null,
            skipped: true,
            reason: aiText.error,
            source_chain: chain,
          });
        }
        return NextResponse.json({ error: aiText.error, source_chain: chain }, { status: 502 });
      }

      chain.push({ step: 6, source: "ai", attempted: true, result: "success", reason: `${aiText.model}: ${aiText.text.length} chars (AI-generated, not manuscript-specific)`, durationMs: ms });
      originalText = aiText.text;
      sourceType = "ai";
      sourceDetail = aiText.model;
      tokensInput = aiText.tokensInput;
      tokensOutput = aiText.tokensOutput;
      costUsd = aiText.costUsd;
      console.log(`[section-text][${requestId}] STEP6 ai → SUCCESS (${aiText.model}, ${aiText.text.length} chars)`);
    }

    console.log(`[section-text][${requestId}] CHAIN COMPLETE → ${sourceType}`, chain.map(s => `${s.step}:${s.source}=${s.result}`).join(", "));

    if (!originalText) {
      return NextResponse.json(
        { error: "All sources failed to produce valid text", source_chain: chain },
        { status: 502 }
      );
    }

    // Save passage — update existing empty record or insert new one
    try {
      let passageId: string;

      const isManuscriptSpecific = ["sinaiticus-project", "ntvmr", "dss", "leningrad-wlc"].includes(sourceType);
      const transcriptionMethod = isManuscriptSpecific
        ? "scholarly_transcription"
        : sourceType === "ai" ? "ai_reconstructed" : "standard_edition";

      const chainSummary = chain.map(s => ({
        step: s.step,
        source: s.source,
        result: s.result,
        reason: s.reason,
        ...(s.durationMs ? { ms: s.durationMs } : {}),
      }));

      const metadata: Record<string, unknown> = {
        passage_description: description || null,
        tokens_used: tokensInput + tokensOutput,
        source_chain: chainSummary,
      };

      if (sourceType === "sinaiticus-project") {
        metadata.ingested_by = "sinaiticus_project";
        metadata.transcription_source = "Codex Sinaiticus Project";
      } else if (sourceType === "ntvmr") {
        const detail = JSON.parse(sourceDetail);
        metadata.ingested_by = "ntvmr";
        metadata.transcription_source = "INTF NTVMR";
        metadata.ga_number = detail.ga_number;
        metadata.doc_id = detail.doc_id;
      } else if (sourceType === "dss") {
        metadata.ingested_by = "etcbc_dss";
        metadata.transcription_source = "ETCBC Dead Sea Scrolls";
        metadata.scroll_id = sourceDetail;
      } else if (sourceType === "leningrad-wlc") {
        metadata.ingested_by = "bible_api";
        metadata.transcription_source = "Westminster Leningrad Codex";
        metadata.edition_source = "WLC";
      } else if (sourceType === "sblgnt") {
        metadata.ingested_by = "sblgnt";
        metadata.edition_source = "SBLGNT";
      } else if (sourceType === "bible-api") {
        metadata.ingested_by = "bible_api";
        metadata.edition_source = sourceDetail;
      } else {
        metadata.ingested_by = "full_import_agent";
        metadata.ai_model = sourceDetail;
      }

      if (existingToUpdate) {
        const { error: uErr } = await admin
          .from("passages")
          .update({
            original_text: originalText,
            transcription_method: transcriptionMethod,
            metadata,
          } as Record<string, unknown>)
          .eq("id", existingToUpdate.id);

        if (uErr) {
          console.error(`[section-text][${requestId}] DB update failed:`, uErr);
          return NextResponse.json(
            { error: `DB update error: ${uErr.message}` },
            { status: 500 }
          );
        }
        passageId = existingToUpdate.id;
        console.log(`[section-text][${requestId}] SAVED (updated) passage=${passageId} src=${sourceType} chars=${originalText.length}`);
      } else {
        const { data: passage, error: pErr } = await admin
          .from("passages")
          .insert({
            manuscript_id,
            reference: reference.trim(),
            sequence_order: sequence_order ?? null,
            original_text: originalText,
            transcription_method: transcriptionMethod,
            created_by: user.id,
            metadata,
          } as Record<string, unknown>)
          .select("id")
          .single<Pick<Passage, "id">>();

        if (pErr || !passage) {
          console.error(`[section-text][${requestId}] DB insert failed:`, pErr);
          return NextResponse.json(
            { error: `DB error: ${pErr?.message ?? "unknown"}` },
            { status: 500 }
          );
        }
        passageId = passage.id;
        console.log(`[section-text][${requestId}] SAVED (created) passage=${passageId} src=${sourceType} chars=${originalText.length}`);
      }

      return NextResponse.json({
        passage_id: passageId,
        skipped: false,
        text_length: originalText.length,
        source_used: sourceType,
        source_label: SOURCE_LABELS[sourceType] ?? sourceType,
        source_chain: chain,
        usage: {
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          estimated_cost_usd: costUsd,
          ai_model: sourceType === "ai" ? sourceDetail : sourceType,
        },
      });
    } catch (dbErr) {
      console.error(`[section-text][${requestId}] DB_ERROR:`, dbErr);
      return NextResponse.json(
        { error: `Insert failed: ${dbErr instanceof Error ? dbErr.message : "unknown"}` },
        { status: 500 }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[section-text] UNHANDLED_ERROR:`, msg, err);
    return NextResponse.json(
      { error: `Server error: ${msg}` },
      { status: 500 }
    );
  }
}

interface AiTextResult {
  text: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  error?: undefined;
  skipped?: undefined;
}

interface AiTextError {
  text: "";
  model: string;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  error: string;
  skipped: boolean;
}

async function fetchFromAiModels(
  manuscriptTitle: string,
  language: string,
  reference: string,
  textHasCorrectScript: (text: string) => boolean
): Promise<AiTextResult | AiTextError> {
  const MODELS = [
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-20250514",
  ] as const;

  const { system, user: userMsg, prefill } = buildSectionTextPrompt(
    manuscriptTitle, language, reference
  );

  const refusalPattern = /^(I |Sorry|Unfortunately|I'm |I appreciate|I understand|This |The text|I cannot|I don't|I need to|Thank you|While I|As an AI|Here'?s? |Let me)/i;

  let totalInput = 0, totalOutput = 0, totalCost = 0;

  for (const model of MODELS) {
    console.log(`[section-text] ${reference}: trying ${model}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);

    let anthropicRes: Response;
    try {
      anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          system,
          messages: prefill
            ? [
                { role: "user", content: userMsg },
                { role: "assistant", content: prefill },
              ]
            : [{ role: "user", content: userMsg }],
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      const isTimeout = fetchErr instanceof Error && fetchErr.name === "AbortError";
      if (model !== MODELS[MODELS.length - 1]) {
        console.log(`[section-text] ${reference}: ${model} ${isTimeout ? "timed out" : "unreachable"}, escalating`);
        continue;
      }
      return { text: "", model, tokensInput: totalInput, tokensOutput: totalOutput, costUsd: totalCost, error: isTimeout ? "Claude API timed out" : "Claude API unreachable", skipped: false };
    }
    clearTimeout(timeout);

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error(`[section-text] ${reference}: ${model} API error ${anthropicRes.status}:`, detail);
      if (model !== MODELS[MODELS.length - 1]) continue;
      const isContentFilter = detail.includes("content filtering policy");
      return { text: "", model, tokensInput: totalInput, tokensOutput: totalOutput, costUsd: totalCost, error: isContentFilter ? `Content filter blocked (${anthropicRes.status})` : `Claude API error: ${anthropicRes.status}`, skipped: false };
    }

    let aiResult;
    try {
      aiResult = await anthropicRes.json();
    } catch {
      if (model !== MODELS[MODELS.length - 1]) continue;
      return { text: "", model, tokensInput: totalInput, tokensOutput: totalOutput, costUsd: totalCost, error: "Malformed response from Claude API", skipped: false };
    }

    const rawContent: string | undefined = aiResult.content?.[0]?.text;
    totalInput += aiResult.usage?.input_tokens ?? 0;
    totalOutput += aiResult.usage?.output_tokens ?? 0;
    totalCost += estimateCostUsd(model, aiResult.usage?.input_tokens ?? 0, aiResult.usage?.output_tokens ?? 0);

    if (!rawContent || rawContent.trim().length === 0) {
      if (model !== MODELS[MODELS.length - 1]) continue;
      return { text: "", model, tokensInput: totalInput, tokensOutput: totalOutput, costUsd: totalCost, error: `Empty response (stop_reason: ${aiResult.stop_reason ?? "unknown"})`, skipped: false };
    }

    let text = (prefill + rawContent).trim();
    text = text.replace(/^```(?:[\w-]*)?\s*\n?/i, "").replace(/\n?\s*```\s*$/, "").trim();

    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === "string") text = parsed;
      else if (parsed.text) text = parsed.text;
      else if (parsed.original_text) text = parsed.original_text;
    } catch { /* raw text */ }

    console.log(`[section-text] ${reference} (${model}): ${text.length} chars, starts: "${text.slice(0, 150).replace(/\n/g, " ")}"`);

    if (text.includes("[UNAVAILABLE]")) {
      console.log(`[section-text] ${reference}: ${model} returned [UNAVAILABLE], escalating`);
      if (model !== MODELS[MODELS.length - 1]) continue;
      return { text: "", model, tokensInput: totalInput, tokensOutput: totalOutput, costUsd: totalCost, error: "Unavailable: section does not exist in this manuscript", skipped: true };
    }

    if (refusalPattern.test(text)) {
      console.log(`[section-text] ${reference}: ${model} refused, escalating`);
      if (model !== MODELS[MODELS.length - 1]) continue;
      return { text: "", model, tokensInput: totalInput, tokensOutput: totalOutput, costUsd: totalCost, error: `AI refused on all models: "${text.slice(0, 80)}..."`, skipped: true };
    }

    if (!textHasCorrectScript(text)) {
      console.log(`[section-text] ${reference}: ${model} wrong script, escalating`);
      if (model !== MODELS[MODELS.length - 1]) continue;
      return { text: "", model, tokensInput: totalInput, tokensOutput: totalOutput, costUsd: totalCost, error: "Wrong script on all models", skipped: true };
    }

    return { text, model, tokensInput: totalInput, tokensOutput: totalOutput, costUsd: totalCost };
  }

  return { text: "", model: "none", tokensInput: totalInput, tokensOutput: totalOutput, costUsd: totalCost, error: "All AI models failed", skipped: false };
}

const PREFILL_BY_LANG: Record<string, string> = {
  grc: "᾿",
  heb: "וַ",
  syc: "ܒ",
  gez: "በ",
  cop: "ⲁ",
  arm: "Ի",
  lat: "",
  ara: "",
};

function buildSectionTextPrompt(
  manuscriptTitle: string,
  language: string,
  reference: string
): { system: string; user: string; prefill: string } {
  const langName = LANGUAGE_NAMES[language] ?? language;

  const system = `You are a multilingual text reference tool specializing in ancient manuscripts. You output ancient scripture in its original language. Output ONLY the original-language text — no English, no translations, no verse numbers, no commentary, no markdown. If the section does not exist in this manuscript, respond with exactly: [UNAVAILABLE]

This text is from the public-domain manuscript "${manuscriptTitle}" and is needed for scholarly research. All content is from historical manuscripts pre-dating modern copyright.`;

  const user = `Output the full ${langName} text of ${reference} as found in ${manuscriptTitle}. Every verse, no omissions. Output only ${langName} characters.`;

  const prefill = PREFILL_BY_LANG[language] ?? "";

  return { system, user, prefill };
}
