import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import { getAnthropicApiKey } from "@/lib/utils/contributor-api-key";
import { logAiActivity } from "@/lib/utils/log-ai-activity";

export const maxDuration = 45;

const AI_MODEL = "claude-sonnet-4-6";

const CROSS_MANUSCRIPT_TOOL = {
  name: "submit_cross_manuscript_summary",
  description:
    "Submit a cross-manuscript comparative summary for a specific book and chapter.",
  input_schema: {
    type: "object" as const,
    properties: {
      comparative_overview: {
        type: "string",
        description:
          "2–3 sentence overview of how this chapter appears across the attested manuscripts — where they converge, where they diverge, and what the comparison reveals",
      },
      manuscripts_compared: {
        type: "array",
        items: { type: "string" },
        description:
          "List of manuscript names included in this comparison",
      },
      areas_of_agreement: {
        type: "string",
        description:
          "Where the manuscripts substantially agree on wording, meaning, or structure for this chapter",
      },
      notable_divergences: {
        type: "string",
        description:
          "Significant textual differences between manuscripts — different readings, additions, omissions, or ordering differences. Be specific if the data supports it.",
      },
      textual_implications: {
        type: "string",
        description:
          "What the comparison implies for textual transmission history, scribal practice, or the reliability of particular readings",
      },
    },
    required: [
      "comparative_overview",
      "manuscripts_compared",
      "areas_of_agreement",
      "notable_divergences",
      "textual_implications",
    ],
  },
};

interface CrossManuscriptContent {
  comparative_overview: string;
  manuscripts_compared: string[];
  areas_of_agreement: string;
  notable_divergences: string;
  textual_implications: string;
}

/**
 * POST /api/summaries/cross-manuscript
 * Body: { book: string, chapter: number, force?: boolean }
 *
 * Generates a comparative summary of a book+chapter across all manuscripts
 * that contain it. Requires at least 2 manuscripts to be meaningful.
 * Cached in ai_summaries (level='cross_manuscript', scope_key='Book N').
 * Auth: any authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single<{ role: string }>();
    const apiKeyResult = await getAnthropicApiKey(user.id, profile?.role ?? "reader");
    if ("error" in apiKeyResult) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: apiKeyResult.status });
    }
    const anthropicApiKey = apiKeyResult.key;

    const body = await request.json();
    const { book, chapter, force } = body as { book?: string; chapter?: number; force?: boolean };

    if (!book || typeof book !== "string" || !chapter || typeof chapter !== "number") {
      return NextResponse.json(
        { error: "book (string) and chapter (number) are required" },
        { status: 400 }
      );
    }

    const scopeKey = `${book} ${chapter}`;
    const admin = createAdminClient();

    // Return cached summary if it exists and not forced
    const { data: cached } = await admin
      .from("ai_summaries")
      .select("content, model, generated_at, version")
      .eq("level", "cross_manuscript")
      .eq("scope_key", scopeKey)
      .single();

    if (cached && !force) {
      return NextResponse.json({ summary: cached.content, cached: true });
    }

    // Gather all passages for this book+chapter across all manuscripts
    const { data: passages } = await admin
      .from("passages")
      .select(
        "id, reference, original_text, metadata, manuscripts!inner(id, title, original_language, estimated_date_start, estimated_date_end)"
      )
      .ilike("reference", `${book} ${chapter}%`)
      .not("original_text", "is", null);

    if (!passages?.length) {
      return NextResponse.json({ error: "No passages found for this chapter" }, { status: 404 });
    }

    // Group by manuscript
    const byManuscript = new Map<string, { title: string; language: string; dateStart: number | null; passages: typeof passages }>();
    for (const p of passages) {
      const ms = p.manuscripts as unknown as {
        id: string;
        title: string;
        original_language: string;
        estimated_date_start: number | null;
        estimated_date_end: number | null;
      };
      if (!byManuscript.has(ms.id)) {
        byManuscript.set(ms.id, { title: ms.title, language: ms.original_language, dateStart: ms.estimated_date_start, passages: [] });
      }
      byManuscript.get(ms.id)!.passages.push(p);
    }

    const manuscriptCount = byManuscript.size;
    if (manuscriptCount < 2) {
      return NextResponse.json(
        { error: `Only 1 manuscript contains ${book} ${chapter} — cross-manuscript comparison requires at least 2` },
        { status: 422 }
      );
    }

    // Fetch variant readings for passages in this chapter
    const passageIds = passages.map((p) => p.id);
    const { data: variantReadings } = await admin
      .from("variant_readings")
      .select("id, variant_id, manuscript_id, reading_text, apparatus_notes, variants!inner(passage_reference, description, metadata)")
      .in("manuscript_id", [...byManuscript.keys()]);

    // Filter to readings relevant to this chapter
    const chapterVariants = (variantReadings ?? []).filter((vr) => {
      const v = vr.variants as unknown as { passage_reference: string };
      return v.passage_reference?.startsWith(`${book} ${chapter}`);
    });

    // Fetch best translations per passage
    const { data: translations } = await admin
      .from("translations")
      .select("passage_id, current_version_id")
      .in("passage_id", passageIds);

    const versionIds = (translations ?? []).map((t) => t.current_version_id).filter(Boolean) as string[];
    const { data: versions } = versionIds.length
      ? await admin
          .from("translation_versions")
          .select("id, translation_id, translated_text")
          .in("id", versionIds)
          .eq("status", "published")
      : { data: [] as { id: string; translation_id: string; translated_text: string }[] };

    const versionById = new Map<string, string>();
    for (const v of versions ?? []) versionById.set(v.id, v.translated_text);

    const translationByPassage = new Map<string, string>();
    for (const t of translations ?? []) {
      if (t.current_version_id) {
        const text = versionById.get(t.current_version_id);
        if (text) translationByPassage.set(t.passage_id, text);
      }
    }

    // Build per-manuscript context blocks — up to 6000 chars total
    const msBlocks: string[] = [];
    let totalChars = 0;

    const sortedMs = [...byManuscript.entries()].sort(
      ([, a], [, b]) => (a.dateStart ?? 9999) - (b.dateStart ?? 9999)
    );

    for (const [, ms] of sortedMs) {
      const passageLines = ms.passages.slice(0, 10).map((p) => {
        const meta = (p.metadata as Record<string, unknown> | null) ?? {};
        const aiSummary = (meta.ai_summary as { summary?: string } | undefined)?.summary;
        const translation = translationByPassage.get(p.id);
        return [
          `  [${p.reference}]`,
          aiSummary ? `  Summary: ${aiSummary}` : "",
          translation ? `  Translation: ${translation.slice(0, 200)}` : "",
        ].filter(Boolean).join("\n");
      });

      const block = `=== ${ms.title} (${ms.language}) ===\n${passageLines.join("\n")}`;
      if (totalChars + block.length > 6000) break;
      msBlocks.push(block);
      totalChars += block.length;
    }

    const variantSummary = chapterVariants.length > 0
      ? `\n\nKnown variant readings in this chapter (${chapterVariants.length} readings across manuscripts):\n` +
        chapterVariants.slice(0, 8).map((vr) => {
          const v = vr.variants as unknown as { passage_reference: string; description: string };
          return `- ${v.passage_reference}: ${v.description ?? ""}`;
        }).join("\n")
      : "";

    const prompt = `You are a textual scholar comparing ancient manuscripts. Analyze ${book} chapter ${chapter} across ${manuscriptCount} manuscripts and produce a comparative summary.

Manuscripts in this comparison (${manuscriptCount} total):
${[...byManuscript.values()].map((ms) => `- ${ms.title} (${ms.language})`).join("\n")}
${variantSummary}

Manuscript evidence:
${msBlocks.join("\n\n")}

Call submit_cross_manuscript_summary with your comparative analysis. Focus on what is revealed by comparing these manuscripts together that cannot be seen from any single manuscript alone.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
        tools: [CROSS_MANUSCRIPT_TOOL],
        tool_choice: { type: "tool", name: "submit_cross_manuscript_summary" },
      }),
    });

    if (!anthropicRes.ok) {
      console.error(`[summaries/cross-manuscript] AI error ${anthropicRes.status}`);
      return NextResponse.json({ error: "Summary generation failed" }, { status: 502 });
    }

    const aiResult = await anthropicRes.json();
    const tokensIn: number = aiResult.usage?.input_tokens ?? 0;
    const tokensOut: number = aiResult.usage?.output_tokens ?? 0;
    const cost = estimateCostUsd(AI_MODEL, tokensIn, tokensOut);

    const toolBlock = (
      aiResult.content as { type: string; input?: unknown }[] | undefined
    )?.find((b) => b.type === "tool_use");

    if (!toolBlock?.input) {
      console.error("[summaries/cross-manuscript] Unexpected AI response:", JSON.stringify(aiResult).slice(0, 300));
      return NextResponse.json({ error: "Unexpected AI response format" }, { status: 502 });
    }

    const parsed = toolBlock.input as CrossManuscriptContent;

    logAiActivity({ userId: user.id, route: "/api/summaries/cross-manuscript", model: AI_MODEL, tokensIn, tokensOut, costUsd: cost, context: { book, chapter } });

    const { data: existingRow } = await admin
      .from("ai_summaries")
      .select("version")
      .eq("level", "cross_manuscript")
      .eq("scope_key", scopeKey)
      .single();

    await admin.from("ai_summaries").upsert(
      {
        level: "cross_manuscript",
        scope_key: scopeKey,
        content: parsed,
        model: AI_MODEL,
        cost_usd: cost,
        generated_at: new Date().toISOString(),
        version: (existingRow?.version ?? 0) + 1,
      },
      { onConflict: "level,scope_key" }
    );

    return NextResponse.json({
      summary: parsed,
      manuscripts_compared: manuscriptCount,
      cached: false,
      usage: { tokens_input: tokensIn, tokens_output: tokensOut, estimated_cost_usd: cost, ai_model: AI_MODEL },
    });
  } catch (err) {
    console.error("[summaries/cross-manuscript] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
