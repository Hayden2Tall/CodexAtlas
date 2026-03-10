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
      .select("id, reference")
      .eq("manuscript_id", manuscript_id)
      .ilike("reference", reference.trim());

    if (existing && existing.length > 0) {
      return NextResponse.json({
        passage_id: existing[0].id,
        skipped: true,
        reason: "Passage already exists",
      });
    }

    const aiModel = "claude-sonnet-4-20250514";
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

    const aiResult = await anthropicRes.json();
    const rawContent: string | undefined = aiResult.content?.[0]?.text;
    const tokensInput: number = aiResult.usage?.input_tokens ?? 0;
    const tokensOutput: number = aiResult.usage?.output_tokens ?? 0;
    const costUsd = estimateCostUsd(aiModel, tokensInput, tokensOutput);

    if (!rawContent || rawContent.trim().length === 0) {
      return NextResponse.json(
        { error: "Empty response for section text" },
        { status: 502 }
      );
    }

    // Claude may wrap the text in JSON or return raw text — handle both
    let originalText = rawContent.trim();
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

    // Handle [UNAVAILABLE] — text not available for this section
    if (originalText === "[UNAVAILABLE]" || originalText.startsWith("[UNAVAILABLE")) {
      return NextResponse.json({
        passage_id: null,
        skipped: true,
        reason: "Text not available for this section",
      });
    }

    // Save passage — wrap in try/catch for better error info
    try {
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

      return NextResponse.json({
        passage_id: passage.id,
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
    console.error("POST /api/agent/discover/section-text error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function buildSectionTextPrompt(
  manuscriptTitle: string,
  language: string,
  reference: string
): string {
  return `You are a manuscript text specialist. Provide the COMPLETE original-language text for the following section of a well-known manuscript.

Manuscript: "${manuscriptTitle}"
Section: "${reference}"
Language code: "${language}"

RESPOND WITH ONLY THE ORIGINAL-LANGUAGE TEXT. No translation, no commentary, no markdown formatting, no JSON wrapping. Just the raw text in the original language and script.

For biblical manuscripts, use standard critical editions (NA28/UBS5 for Greek NT, BHS for Hebrew Bible) as your source. Provide the COMPLETE text of the section — every verse, every line. Do not truncate or summarize.

If you cannot confidently provide the text for this section, respond with exactly: [UNAVAILABLE]`;
}
