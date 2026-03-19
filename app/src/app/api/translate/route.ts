import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import {
  TRANSLATION_SYSTEM_PROMPT,
  buildTranslationPrompt,
  getCorpusDescription,
  type ParallelText,
} from "@/lib/utils/translation-prompts";
import { extractBookName } from "@/lib/utils/book-order";
import { truncateToMaxChars } from "@/lib/utils/text-sources";
import type {
  UserRole,
  User,
  Passage,
  Manuscript,
  EvidenceRecord,
  Translation,
  TranslationVersion,
} from "@/lib/types";

export const maxDuration = 60;

const SCHOLAR_AND_ABOVE: UserRole[] = ["scholar", "editor", "admin"];
const AI_MODEL = "claude-sonnet-4-6";

// Priority order for parallel text lookup — preferred source comes first.
// Only sources with the same language as the passage are useful as parallels.
const PARALLEL_SOURCE_PRIORITY: Record<string, string[]> = {
  heb: ["wlc", "oshb", "etcbc_dss"],
  grc: ["sinaiticus_project", "sblgnt", "thgnt"],
};

// Tool schema for structured translation output.
// Using tool_choice forces the model to always call this tool, making parse
// failures structurally impossible — the SDK returns a typed input object.
const TRANSLATION_TOOL = {
  name: "submit_translation",
  description:
    "Submit the completed scholarly translation with confidence assessment. Call this tool once with the finished translation.",
  input_schema: {
    type: "object" as const,
    properties: {
      translated_text: {
        type: "string",
        description: "The full scholarly translation of the passage",
      },
      confidence_score: {
        type: "number",
        description:
          "Confidence in the translation (0.0–1.0). Reflects textual certainty only — do NOT penalise for single-source manuscripts, as all translations here are single-source by design.",
      },
      translation_notes: {
        type: "string",
        description:
          "Scholarly notes on the translation approach, textual difficulties, or significant ambiguities",
      },
      key_decisions: {
        type: "array",
        items: { type: "string" },
        description:
          "List of significant translation choices and the reasoning behind each",
      },
    },
    required: [
      "translated_text",
      "confidence_score",
      "translation_notes",
      "key_decisions",
    ],
  },
};

interface TranslationToolInput {
  translated_text: string;
  confidence_score: number;
  translation_notes: string;
  key_decisions: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { passage_id, target_language } = body;

    if (!passage_id || typeof passage_id !== "string") {
      return NextResponse.json(
        { error: "passage_id is required and must be a string" },
        { status: 400 }
      );
    }
    if (!target_language || typeof target_language !== "string") {
      return NextResponse.json(
        { error: "target_language is required and must be a string" },
        { status: 400 }
      );
    }

    // ── Auth: require scholar role or above ──────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single<Pick<User, "role">>();

    if (!profile || !SCHOLAR_AND_ABOVE.includes(profile.role as UserRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions — scholar role or above required" },
        { status: 403 }
      );
    }

    // ── Fetch passage + manuscript ───────────────────────────────────
    const { data: passage, error: passageError } = await supabase
      .from("passages")
      .select("*")
      .eq("id", passage_id)
      .single<Passage>();

    if (passageError || !passage) {
      return NextResponse.json({ error: "Passage not found" }, { status: 404 });
    }

    if (!passage.original_text) {
      return NextResponse.json(
        { error: "Passage has no original text to translate" },
        { status: 422 }
      );
    }

    const { data: manuscript, error: msError } = await supabase
      .from("manuscripts")
      .select("*")
      .eq("id", passage.manuscript_id)
      .single<Manuscript>();

    if (msError || !manuscript) {
      return NextResponse.json(
        { error: "Manuscript not found" },
        { status: 404 }
      );
    }

    // ── Parallel text lookup ─────────────────────────────────────────
    const admin = createAdminClient();
    const sourceId = (passage.metadata as Record<string, unknown> | null)
      ?.ingested_by as string | undefined;

    const parallelText = await fetchParallelText(
      admin,
      passage.reference,
      sourceId,
      manuscript.original_language
    );

    // ── Build prompt ─────────────────────────────────────────────────
    const prompt = buildTranslationPrompt({
      originalText: passage.original_text,
      originalLanguage: manuscript.original_language,
      targetLanguage: target_language,
      manuscriptTitle: manuscript.title,
      dateStart: manuscript.estimated_date_start,
      dateEnd: manuscript.estimated_date_end,
      origin: manuscript.origin_location,
      transcriptionMethod: passage.transcription_method,
      sourceId,
      parallelText,
    });

    // ── Call Claude API with tool use (with retry) ───────────────────
    // tool_choice forces the model to call submit_translation — parse
    // failures are structurally impossible with this approach.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50_000);

    let anthropicRes: Response;
    try {
      anthropicRes = await callAnthropicWithRetry(
        {
          model: AI_MODEL,
          max_tokens: 4096,
          temperature: 0.2,
          system: TRANSLATION_SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
          tools: [TRANSLATION_TOOL],
          tool_choice: { type: "tool", name: "submit_translation" },
        },
        process.env.ANTHROPIC_API_KEY!,
        controller.signal
      );
    } catch (fetchErr) {
      clearTimeout(timeout);
      const isTimeout =
        fetchErr instanceof Error && fetchErr.name === "AbortError";
      return NextResponse.json(
        {
          error: isTimeout
            ? "Translation timed out — try a shorter passage"
            : "Translation service unreachable",
        },
        { status: 502 }
      );
    }
    clearTimeout(timeout);

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, detail);
      return NextResponse.json(
        { error: `Translation service error (${anthropicRes.status})` },
        { status: 502 }
      );
    }

    const aiResult = await anthropicRes.json();

    const tokensInput: number = aiResult.usage?.input_tokens ?? 0;
    const tokensOutput: number = aiResult.usage?.output_tokens ?? 0;
    const costUsd = estimateCostUsd(AI_MODEL, tokensInput, tokensOutput);

    // Extract tool use result from the response content array
    const toolUseBlock = (
      aiResult.content as { type: string; input?: unknown }[] | undefined
    )?.find((b) => b.type === "tool_use");

    if (!toolUseBlock?.input) {
      console.error(
        "[translate] No tool_use block in response:",
        JSON.stringify(aiResult.content).slice(0, 500)
      );
      return NextResponse.json(
        { error: "Translation service returned an unexpected response format" },
        { status: 502 }
      );
    }

    const parsed = toolUseBlock.input as TranslationToolInput;

    if (!parsed.translated_text?.trim()) {
      return NextResponse.json(
        { error: "Translation service returned an empty translation" },
        { status: 502 }
      );
    }

    // Clamp confidence score to [0, 1]
    const confidenceScore = Math.max(
      0,
      Math.min(1, parsed.confidence_score ?? 0.5)
    );

    // ── Persist to Supabase ──────────────────────────────────────────

    // 1. Evidence record
    const { data: evidenceRecord, error: evErr } = await admin
      .from("evidence_records")
      .insert({
        entity_type: "translation_version",
        entity_id: passage_id,
        source_manuscript_ids: [manuscript.id],
        translation_method: "ai_initial",
        ai_model: AI_MODEL,
        confidence_score: confidenceScore,
        revision_reason: null,
        metadata: {
          translation_notes: parsed.translation_notes ?? "",
          key_decisions: Array.isArray(parsed.key_decisions)
            ? parsed.key_decisions
            : [],
          target_language,
          original_language: manuscript.original_language,
          source_id: sourceId,
          had_parallel_text: parallelText !== null,
        },
      } as Record<string, unknown>)
      .select()
      .single<EvidenceRecord>();

    if (evErr || !evidenceRecord) {
      console.error("Evidence record creation failed:", evErr);
      return NextResponse.json(
        { error: "Failed to create evidence record" },
        { status: 500 }
      );
    }

    // 2. Find or create translation row
    let { data: translation } = await admin
      .from("translations")
      .select("*")
      .eq("passage_id", passage_id)
      .eq("target_language", target_language)
      .single<Translation>();

    if (!translation) {
      const { data: created, error: tErr } = await admin
        .from("translations")
        .insert({
          passage_id,
          target_language,
          created_by: user.id,
        } as Record<string, unknown>)
        .select()
        .single<Translation>();

      if (tErr || !created) {
        console.error("Translation creation failed:", tErr);
        return NextResponse.json(
          { error: "Failed to create translation record" },
          { status: 500 }
        );
      }
      translation = created;
    }

    // 3. Determine next version number
    const { count } = await admin
      .from("translation_versions")
      .select("*", { count: "exact", head: true })
      .eq("translation_id", translation.id);

    const versionNumber = (count ?? 0) + 1;

    // 4. Create translation version
    const { data: version, error: vErr } = await admin
      .from("translation_versions")
      .insert({
        translation_id: translation.id,
        version_number: versionNumber,
        translated_text: parsed.translated_text,
        translation_method: "ai_initial",
        ai_model: AI_MODEL,
        confidence_score: confidenceScore,
        source_manuscript_ids: [manuscript.id],
        status: "published",
        evidence_record_id: evidenceRecord.id,
        created_by: user.id,
      } as Record<string, unknown>)
      .select()
      .single<TranslationVersion>();

    if (vErr || !version) {
      console.error("Version creation failed:", vErr);
      return NextResponse.json(
        { error: "Failed to create translation version" },
        { status: 500 }
      );
    }

    // 5. Point evidence record at actual version
    await admin
      .from("evidence_records")
      .update({ entity_id: version.id } as Record<string, unknown>)
      .eq("id", evidenceRecord.id);

    // 6. Set as current version
    await admin
      .from("translations")
      .update({ current_version_id: version.id } as Record<string, unknown>)
      .eq("id", translation.id);

    return NextResponse.json({
      translation: { ...translation, current_version_id: version.id },
      version,
      evidence_record: evidenceRecord,
      usage: {
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: costUsd,
        ai_model: AI_MODEL,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Translation pipeline error:", msg, err);
    return NextResponse.json(
      { error: `Server error: ${msg}` },
      { status: 500 }
    );
  }
}

// ── Anthropic API call with exponential backoff retry ─────────────────────────

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 529]);
const MAX_RETRIES = 3;

async function callAnthropicWithRetry(
  reqBody: object,
  apiKey: string,
  signal: AbortSignal
): Promise<Response> {
  let lastRes: Response | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(reqBody),
        signal,
      });

      if (!RETRYABLE_STATUSES.has(res.status) || attempt === MAX_RETRIES) {
        return res;
      }

      lastRes = res;
      const delay = Math.min(
        1000 * Math.pow(2, attempt) + Math.random() * 500,
        30_000
      );
      console.warn(
        `[translate] Anthropic ${res.status} on attempt ${attempt + 1}/${MAX_RETRIES + 1} — retrying in ${Math.round(delay)}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      // On timeout/abort, one retry after 5s then re-throw
      if (isAbort && attempt === 0) {
        await new Promise((r) => setTimeout(r, 5_000));
        continue;
      }
      throw err;
    }
  }

  // Return last response if all retries exhausted
  return lastRes!;
}

// ── Parallel text lookup ──────────────────────────────────────────────────────

async function fetchParallelText(
  admin: ReturnType<typeof createAdminClient>,
  reference: string,
  currentSourceId: string | undefined,
  langCode: string
): Promise<ParallelText | null> {
  try {
    const bookName = extractBookName(reference);
    if (!bookName) return null;

    // Parse chapter from reference (last number in string)
    const chapterMatch = reference.match(/(\d+)\s*$/);
    if (!chapterMatch) return null;
    const chapter = parseInt(chapterMatch[1], 10);

    // Determine which sources are useful parallels for this language
    const prioritySources =
      PARALLEL_SOURCE_PRIORITY[langCode.toLowerCase()] ?? [];
    if (prioritySources.length === 0) return null;

    const { data: rows } = await admin
      .from("manuscript_source_texts")
      .select("source, text")
      .ilike("book", bookName)
      .eq("chapter", chapter)
      .neq("source", currentSourceId ?? "")
      .in("source", prioritySources)
      .limit(prioritySources.length);

    if (!rows || rows.length === 0) return null;

    // Pick the highest-priority source from what we got
    let bestRow: { source: string; text: string } | null = null;
    for (const srcId of prioritySources) {
      const found = (rows as { source: string; text: string }[]).find(
        (r) => r.source === srcId
      );
      if (found) {
        bestRow = found;
        break;
      }
    }

    if (!bestRow || !bestRow.text || bestRow.text.length <= 50) return null;

    return {
      sourceLabel: getCorpusDescription(bestRow.source),
      text: truncateToMaxChars(bestRow.text, 3000),
    };
  } catch (err) {
    // Parallel text is optional — log and continue without it
    console.warn("[translate] fetchParallelText failed:", err);
    return null;
  }
}
