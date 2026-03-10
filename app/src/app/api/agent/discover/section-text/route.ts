import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import type { UserRole, User, Passage } from "@/lib/types";

export const maxDuration = 60;

const ADMIN_ROLES: UserRole[] = ["admin", "editor"];

// Standard Bible book name → number mapping (1-66 Protestant, 67+ LXX apocrypha)
// Numbers for LXX apocrypha must match bolls.life API bookid values exactly
const BOOK_NUMBERS: Record<string, number> = {
  genesis: 1, exodus: 2, leviticus: 3, numbers: 4, deuteronomy: 5,
  joshua: 6, judges: 7, ruth: 8, "1 samuel": 9, "2 samuel": 10,
  "1 kings": 11, "2 kings": 12, "1 chronicles": 13, "2 chronicles": 14,
  ezra: 15, nehemiah: 16, esther: 17, job: 18, psalms: 19, psalm: 19,
  proverbs: 20, ecclesiastes: 21, "song of solomon": 22, "song of songs": 22, canticles: 22, isaiah: 23,
  jeremiah: 24, lamentations: 25, ezekiel: 26, daniel: 27, hosea: 28,
  joel: 29, amos: 30, obadiah: 31, jonah: 32, micah: 33, nahum: 34,
  habakkuk: 35, zephaniah: 36, haggai: 37, zechariah: 38, malachi: 39,
  matthew: 40, mark: 41, luke: 42, john: 43, acts: 44, romans: 45,
  "1 corinthians": 46, "2 corinthians": 47, galatians: 48, ephesians: 49,
  philippians: 50, colossians: 51, "1 thessalonians": 52, "2 thessalonians": 53,
  "1 timothy": 54, "2 timothy": 55, titus: 56, philemon: 57, hebrews: 58,
  james: 59, "1 peter": 60, "2 peter": 61, "1 john": 62, "2 john": 63,
  "3 john": 64, jude: 65, revelation: 66,
  // LXX deuterocanonical (bolls.life bookids)
  "1 esdras": 67, "3 ezra": 67, "esdras a": 67,
  tobit: 68,
  judith: 69,
  wisdom: 70, "wisdom of solomon": 70,
  sirach: 71, ecclesiasticus: 71, "wisdom of sirach": 71, "ben sira": 71,
  baruch: 73, "letter of jeremiah": 73, "epistle of jeremiah": 73,
  "1 maccabees": 74, "2 maccabees": 75, "3 maccabees": 76, "4 maccabees": 80,
  susanna: 78, "bel and the dragon": 79,
  "psalms of solomon": 85, odes: 86, "odæs": 86, ode: 86,
};

function parseBookAndChapter(reference: string): { bookNum: number; chapter: number } | null {
  const match = reference.match(/^(.+?)\s+(\d+)$/);
  if (!match) return null;
  const bookName = match[1].toLowerCase().trim();
  const chapter = parseInt(match[2], 10);
  const bookNum = BOOK_NUMBERS[bookName];
  if (!bookNum || isNaN(chapter)) return null;
  return { bookNum, chapter };
}

async function fetchFromBibleApi(
  language: string,
  reference: string
): Promise<{ text: string; edition: string } | null> {
  const parsed = parseBookAndChapter(reference);
  if (!parsed) return null;

  // Pick translation based on language and testament
  // LXX has OT (1-39) and apocrypha (67+); TR has NT only (40-66)
  let translation: string;
  if (language === "grc") {
    translation = parsed.bookNum >= 40 && parsed.bookNum <= 66 ? "TR" : "LXX";
  } else if (language === "heb") {
    translation = "WLC";
  } else {
    return null;
  }

  const url = `https://bolls.life/get-text/${translation}/${parsed.bookNum}/${parsed.chapter}/`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const verses: Array<{ verse: number; text: string }> = await res.json();
    if (!Array.isArray(verses) || verses.length === 0) return null;

    const text = verses
      .sort((a, b) => a.verse - b.verse)
      .map((v) => v.text.replace(/<[^>]*>/g, "").trim())
      .filter(Boolean)
      .join("\n");

    return text.length > 50 ? { text, edition: translation } : null;
  } catch {
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

    // Check if passage already exists
    const { data: existing } = await admin
      .from("passages")
      .select("id, reference, original_text")
      .eq("manuscript_id", manuscript_id)
      .ilike("reference", reference.trim());

    // Only skip if the existing passage has substantial text in the correct script.
    const MIN_TEXT_LENGTH = 500;
    const lang = (original_language ?? "grc").toLowerCase();

    function textHasCorrectScript(text: string): boolean {
      const grc = (text.match(/[\u0370-\u03FF\u1F00-\u1FFF]/g) || []).length;
      const heb = (text.match(/[\u0590-\u05FF]/g) || []).length;
      if (lang === "grc") return grc > text.length * 0.15;
      if (lang === "heb") return heb > text.length * 0.15;
      return true;
    }

    const existingComplete = existing?.find(
      (p) =>
        p.original_text &&
        p.original_text.trim().length >= MIN_TEXT_LENGTH &&
        textHasCorrectScript(p.original_text)
    );

    if (existingComplete) {
      console.log(`[section-text] ${reference}: skipped — existing passage ${existingComplete.id} has ${existingComplete.original_text?.length ?? 0} chars of valid text`);
      return NextResponse.json({
        passage_id: existingComplete.id,
        skipped: true,
        reason: `Already imported (${existingComplete.original_text?.length ?? 0} chars)`,
      });
    }

    // Existing record with no/short/wrong-script text — we'll overwrite it
    const existingToUpdate = existing?.[0] ?? null;

    if (existingToUpdate) {
      console.log(`[section-text] ${reference}: found existing passage ${existingToUpdate.id} with ${existingToUpdate.original_text?.length ?? 0} chars — will overwrite`);
    } else {
      console.log(`[section-text] ${reference}: no existing passage found — will create new`);
    }

    // STEP 1: Try free Bible text API first (free, instant, no content filters)
    const apiResult = await fetchFromBibleApi(original_language ?? "grc", reference);
    let originalText = "";
    let aiModel = "bible-api";
    let editionSource = "";
    let tokensInput = 0;
    let tokensOutput = 0;
    let costUsd = 0;

    if (apiResult && textHasCorrectScript(apiResult.text)) {
      console.log(`[section-text] ${reference}: fetched from Bible API ${apiResult.edition} (${apiResult.text.length} chars)`);
      originalText = apiResult.text;
      editionSource = apiResult.edition;
    } else {
      if (apiResult) {
        console.log(`[section-text] ${reference}: Bible API returned text but wrong script, trying AI`);
      } else {
        console.log(`[section-text] ${reference}: Bible API unavailable, trying AI`);
      }

    // STEP 2: Fall back to AI models
    const MODELS = [
      "claude-haiku-4-5-20251001",
      "claude-sonnet-4-20250514",
    ] as const;

    const { system, user: userMsg, prefill } = buildSectionTextPrompt(
      manuscript_title,
      original_language ?? "grc",
      reference
    );

    const refusalPattern = /^(I |Sorry|Unfortunately|I'm |I appreciate|I understand|This |The text|I cannot|I don't|I need to|Thank you|While I|As an AI|Here'?s? |Let me)/i;

    for (const model of MODELS) {
      aiModel = model;
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
        return NextResponse.json(
          { error: isTimeout ? "Claude API timed out" : "Claude API unreachable" },
          { status: 502 }
        );
      }
      clearTimeout(timeout);

      if (!anthropicRes.ok) {
        const detail = await anthropicRes.text();
        console.error(`[section-text] ${reference}: ${model} API error ${anthropicRes.status}:`, detail);
        if (model !== MODELS[MODELS.length - 1]) {
          console.log(`[section-text] ${reference}: escalating to next model`);
          continue;
        }
        const isContentFilter = detail.includes("content filtering policy");
        return NextResponse.json(
          {
            error: isContentFilter
              ? `Content filter blocked (${anthropicRes.status})`
              : `Claude API error: ${anthropicRes.status}`,
          },
          { status: 502 }
        );
      }

      let aiResult;
      try {
        aiResult = await anthropicRes.json();
      } catch {
        if (model !== MODELS[MODELS.length - 1]) continue;
        return NextResponse.json(
          { error: "Malformed response from Claude API" },
          { status: 502 }
        );
      }

      const rawContent: string | undefined = aiResult.content?.[0]?.text;
      tokensInput += aiResult.usage?.input_tokens ?? 0;
      tokensOutput += aiResult.usage?.output_tokens ?? 0;
      costUsd += estimateCostUsd(model, aiResult.usage?.input_tokens ?? 0, aiResult.usage?.output_tokens ?? 0);

      if (!rawContent || rawContent.trim().length === 0) {
        if (model !== MODELS[MODELS.length - 1]) continue;
        return NextResponse.json(
          { error: `Empty response (stop_reason: ${aiResult.stop_reason ?? "unknown"})` },
          { status: 502 }
        );
      }

      let text = (prefill + rawContent).trim();
      text = text
        .replace(/^```(?:[\w-]*)?\s*\n?/i, "")
        .replace(/\n?\s*```\s*$/, "")
        .trim();

      try {
        const parsed = JSON.parse(text);
        if (typeof parsed === "string") text = parsed;
        else if (parsed.text) text = parsed.text;
        else if (parsed.original_text) text = parsed.original_text;
      } catch { /* raw text */ }

      console.log(
        `[section-text] ${reference} (${model}): ${text.length} chars, starts: "${text.slice(0, 150).replace(/\n/g, " ")}"`
      );

      if (text.includes("[UNAVAILABLE]")) {
        console.log(`[section-text] ${reference}: ${model} returned [UNAVAILABLE], escalating`);
        if (model !== MODELS[MODELS.length - 1]) continue;
        return NextResponse.json({
          passage_id: null,
          skipped: true,
          reason: "Unavailable: section does not exist in this manuscript",
        });
      }

      if (refusalPattern.test(text)) {
        console.log(`[section-text] ${reference}: ${model} refused, escalating`);
        if (model !== MODELS[MODELS.length - 1]) continue;
        return NextResponse.json({
          passage_id: null,
          skipped: true,
          reason: `AI refused on all models: "${text.slice(0, 80)}..."`,
        });
      }

      if (!textHasCorrectScript(text)) {
        console.log(`[section-text] ${reference}: ${model} wrong script, escalating`);
        if (model !== MODELS[MODELS.length - 1]) continue;
        return NextResponse.json({
          passage_id: null,
          skipped: true,
          reason: `Wrong script on all models`,
        });
      }

      originalText = text;
      break;
    }

    if (!originalText) {
      return NextResponse.json(
        { error: "All models failed to produce valid text" },
        { status: 502 }
      );
    }

    } // end of else (Bible API unavailable, using AI fallback)

    // Save passage — update existing empty record or insert new one
    try {
      let passageId: string;

      const isFromApi = aiModel === "bible-api";

      if (existingToUpdate) {
        const { error: uErr } = await admin
          .from("passages")
          .update({
            original_text: originalText,
            transcription_method: isFromApi ? "standard_edition" : "ai_reconstructed",
            metadata: {
              ingested_by: isFromApi ? "bible_api" : "full_import_agent",
              ...(isFromApi && editionSource ? { edition_source: editionSource } : {}),
              passage_description: description || null,
              ai_model: aiModel,
              tokens_used: tokensInput + tokensOutput,
            },
          } as Record<string, unknown>)
          .eq("id", existingToUpdate.id);

        if (uErr) {
          console.error("Passage update failed:", uErr);
          return NextResponse.json(
            { error: `DB update error: ${uErr.message}` },
            { status: 500 }
          );
        }
        passageId = existingToUpdate.id;
      } else {
        const { data: passage, error: pErr } = await admin
          .from("passages")
          .insert({
            manuscript_id,
            reference: reference.trim(),
            sequence_order: sequence_order ?? null,
            original_text: originalText,
            transcription_method: isFromApi ? "standard_edition" : "ai_reconstructed",
            created_by: user.id,
            metadata: {
              ingested_by: isFromApi ? "bible_api" : "full_import_agent",
              ...(isFromApi && editionSource ? { edition_source: editionSource } : {}),
              passage_description: description || null,
              ai_model: aiModel,
              tokens_used: tokensInput + tokensOutput,
            },
          } as Record<string, unknown>)
          .select("id")
          .single<Pick<Passage, "id">>();

        if (pErr || !passage) {
          console.error("Passage creation failed:", pErr);
          return NextResponse.json(
            { error: `DB error: ${pErr?.message ?? "unknown"}` },
            { status: 500 }
          );
        }
        passageId = passage.id;
      }

      return NextResponse.json({
        passage_id: passageId,
        skipped: false,
        text_length: originalText.length,
        usage: {
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          estimated_cost_usd: costUsd,
          ai_model: aiModel,
        },
      });
    } catch (dbErr) {
      console.error("Passage insert exception:", dbErr);
      return NextResponse.json(
        { error: `Insert failed: ${dbErr instanceof Error ? dbErr.message : "unknown"}` },
        { status: 500 }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("POST /api/agent/discover/section-text error:", msg, err);
    return NextResponse.json(
      { error: `Server error: ${msg}` },
      { status: 500 }
    );
  }
}

function buildSectionTextPrompt(
  _manuscriptTitle: string,
  language: string,
  reference: string
): { system: string; user: string; prefill: string } {
  const langName = language === "heb"
    ? "Biblical Hebrew"
    : language === "grc"
      ? "Koine Greek"
      : language;

  const system = `You are a multilingual text reference tool. You output ancient scripture in its original language. Output ONLY the original-language text — no English, no translations, no verse numbers, no commentary, no markdown. If the section does not exist, respond with exactly: [UNAVAILABLE]`;

  const user = `Output the full ${langName} text of ${reference}. Every verse, no omissions.`;

  const prefill = language === "grc"
    ? "᾿"
    : language === "heb"
      ? "וַ"
      : "";

  return { system, user, prefill };
}
