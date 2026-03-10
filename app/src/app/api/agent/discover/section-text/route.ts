import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import type { UserRole, User, Passage } from "@/lib/types";

export const maxDuration = 60;

const ADMIN_ROLES: UserRole[] = ["admin", "editor"];

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

    const aiModel = "claude-haiku-4-5-20251001";
    const prompt = buildSectionTextPrompt(
      manuscript_title,
      original_language ?? "grc",
      reference
    );

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
          model: aiModel,
          max_tokens: 8192,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      const isTimeout = fetchErr instanceof Error && fetchErr.name === "AbortError";
      return NextResponse.json(
        { error: isTimeout ? "Claude API timed out" : "Claude API unreachable" },
        { status: 502 }
      );
    }
    clearTimeout(timeout);

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, detail);
      return NextResponse.json(
        { error: `Claude API error: ${anthropicRes.status}` },
        { status: 502 }
      );
    }

    let aiResult;
    try {
      aiResult = await anthropicRes.json();
    } catch (jsonErr) {
      console.error("Failed to parse Anthropic response as JSON:", jsonErr);
      return NextResponse.json(
        { error: "Malformed response from Claude API" },
        { status: 502 }
      );
    }

    const rawContent: string | undefined = aiResult.content?.[0]?.text;
    const tokensInput: number = aiResult.usage?.input_tokens ?? 0;
    const tokensOutput: number = aiResult.usage?.output_tokens ?? 0;
    const costUsd = estimateCostUsd(aiModel, tokensInput, tokensOutput);

    if (!rawContent || rawContent.trim().length === 0) {
      console.error("Empty AI response. Stop reason:", aiResult.stop_reason, "Model:", aiResult.model);
      return NextResponse.json(
        { error: `Empty response (stop_reason: ${aiResult.stop_reason ?? "unknown"})` },
        { status: 502 }
      );
    }

    // Claude may wrap the text in JSON, markdown fences, or return raw text
    let originalText = rawContent.trim();

    // Strip markdown code fences if present
    originalText = originalText
      .replace(/^```(?:[\w-]*)?\s*\n?/i, "")
      .replace(/\n?\s*```\s*$/, "")
      .trim();

    try {
      const parsed = JSON.parse(originalText);
      if (typeof parsed === "string") {
        originalText = parsed;
      } else if (parsed.text) {
        originalText = parsed.text;
      } else if (parsed.original_text) {
        originalText = parsed.original_text;
      }
    } catch {
      // Raw text response — use as-is
    }

    // Log the first 200 chars of what Claude returned for debugging
    console.log(
      `[section-text] ${reference}: ${originalText.length} chars, starts: "${originalText.slice(0, 200).replace(/\n/g, " ")}"`
    );

    // Handle [UNAVAILABLE] — section truly doesn't exist
    if (
      originalText === "[UNAVAILABLE]" ||
      originalText.startsWith("[UNAVAILABLE]") ||
      originalText.includes("[UNAVAILABLE]")
    ) {
      return NextResponse.json({
        passage_id: null,
        skipped: true,
        reason: "Unavailable: section does not exist in this manuscript",
      });
    }

    // Reject English refusal responses regardless of length.
    // Claude Haiku often returns 1000+ char polite refusals.
    const refusalPattern = /^(I |Sorry|Unfortunately|I'm |I appreciate|This |The text|I cannot|I don't|I need to|Thank you|While I|As an AI)/i;
    if (refusalPattern.test(originalText)) {
      console.log(`[section-text] ${reference}: rejected as English refusal (${originalText.length} chars): "${originalText.slice(0, 200)}"`);
      return NextResponse.json({
        passage_id: null,
        skipped: true,
        reason: `AI refused — will retry. "${originalText.slice(0, 80)}..."`,
      });
    }

    // Validate that the response contains characters from the expected script.
    const greekChars = (originalText.match(/[\u0370-\u03FF\u1F00-\u1FFF]/g) || []).length;
    const hebrewChars = (originalText.match(/[\u0590-\u05FF]/g) || []).length;
    const totalChars = originalText.length;

    const hasExpectedScript = textHasCorrectScript(originalText);

    if (!hasExpectedScript) {
      console.log(`[section-text] ${reference}: wrong script — expected ${lang}, got ${greekChars} Greek / ${hebrewChars} Hebrew chars out of ${totalChars}. First 200: "${originalText.slice(0, 200)}"`);
      return NextResponse.json({
        passage_id: null,
        skipped: true,
        reason: `Wrong script: response is not in ${lang === "grc" ? "Greek" : lang === "heb" ? "Hebrew" : lang}`,
      });
    }

    // Save passage — update existing empty record or insert new one
    try {
      let passageId: string;

      if (existingToUpdate) {
        const { error: uErr } = await admin
          .from("passages")
          .update({
            original_text: originalText,
            transcription_method: "ai_reconstructed",
            metadata: {
              ingested_by: "full_import_agent",
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
            transcription_method: "ai_reconstructed",
            created_by: user.id,
            metadata: {
              ingested_by: "full_import_agent",
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
  manuscriptTitle: string,
  language: string,
  reference: string
): string {
  const langGuide = language === "heb"
    ? "Provide the text in Biblical Hebrew (BHS/Westminster Leningrad Codex)."
    : language === "grc"
      ? "Provide the text in Koine Greek. For Old Testament / Septuagint books use the LXX (Rahlfs-Hanhart). For New Testament books use the standard critical text (NA28/UBS5)."
      : `Provide the text in the original language (code: ${language}).`;

  return `You are a biblical text specialist. Your task is to reproduce the COMPLETE original-language text of a scripture passage.

Section: "${reference}"
Context: This passage belongs to "${manuscriptTitle}".

${langGuide}

CRITICAL RULES:
1. Output ONLY the original-language text. No English, no translation, no verse labels, no commentary, no markdown, no JSON.
2. Include EVERY verse of the section. Do not skip, truncate, or summarize.
3. Use the standard critical edition text. Minor manuscript-specific variant readings are acceptable but not required.
4. You know these texts — they are among the most published works in human history. Reproduce them accurately.

Only if the section truly does not exist (e.g., a chapter number beyond the book's actual length), respond with exactly: [UNAVAILABLE]`;
}
