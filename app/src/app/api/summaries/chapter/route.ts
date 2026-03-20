import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import { getAnthropicApiKey } from "@/lib/utils/contributor-api-key";
import { logAiActivity } from "@/lib/utils/log-ai-activity";

export const maxDuration = 45;

const AI_MODEL = "claude-haiku-4-5-20251001";

const CHAPTER_SUMMARY_TOOL = {
  name: "submit_chapter_summary",
  description:
    "Submit a scholarly chapter summary synthesizing all manuscript evidence for this chapter.",
  input_schema: {
    type: "object" as const,
    properties: {
      overview: {
        type: "string",
        description: "2–3 sentence plain-language overview of the chapter's content and narrative",
      },
      theological_themes: {
        type: "array",
        items: { type: "string" },
        description: "3–6 key theological, narrative, or thematic threads running through the chapter",
      },
      manuscript_notes: {
        type: "string",
        description:
          "Notable observations about manuscript diversity, textual variation, or translation challenges in this chapter. Be specific if data supports it.",
      },
      scholarly_significance: {
        type: "string",
        description:
          "1–2 sentences on why this chapter matters in biblical or historical scholarship",
      },
    },
    required: ["overview", "theological_themes", "manuscript_notes", "scholarly_significance"],
  },
};

interface ChapterSummaryContent {
  overview: string;
  theological_themes: string[];
  manuscript_notes: string;
  scholarly_significance: string;
}

/**
 * POST /api/summaries/chapter
 * Body: { book: string, chapter: number }
 *
 * Generates a chapter-level AI summary by aggregating:
 * - Passage-level ai_summary entries for this chapter
 * - Best translations per passage
 * - Manuscript count and language diversity
 *
 * Result is cached in ai_summaries (level='chapter', scope_key='Book N').
 * Returns cached result immediately on repeat calls.
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

    // Return cached summary if it exists
    const { data: cached } = await admin
      .from("ai_summaries")
      .select("content, model, generated_at, version")
      .eq("level", "chapter")
      .eq("scope_key", scopeKey)
      .single();

    if (cached && !force) {
      return NextResponse.json({ summary: cached.content, cached: true });
    }

    // Gather passages for this chapter across all manuscripts
    const { data: passages } = await admin
      .from("passages")
      .select(
        "id, reference, original_text, metadata, manuscripts!inner(title, original_language)"
      )
      .ilike("reference", `${book} ${chapter}%`)
      .not("original_text", "is", null);

    if (!passages?.length) {
      return NextResponse.json({ error: "No passages found for this chapter" }, { status: 404 });
    }

    const passageIds = passages.map((p) => p.id);

    // Fetch best translations
    const { data: translations } = await admin
      .from("translations")
      .select("passage_id, current_version_id")
      .in("passage_id", passageIds);

    const versionIds = (translations ?? [])
      .map((t) => t.current_version_id)
      .filter(Boolean) as string[];

    const { data: versions } = versionIds.length
      ? await admin
          .from("translation_versions")
          .select("id, translation_id, translated_text, confidence_score")
          .in("id", versionIds)
          .eq("status", "published")
      : { data: [] as { id: string; translation_id: string; translated_text: string; confidence_score: number | null }[] };

    const translationById = new Map<string, string>();
    for (const v of versions ?? []) {
      translationById.set(v.id, v.translated_text);
    }

    const translationByPassage = new Map<string, string>();
    for (const t of translations ?? []) {
      if (t.current_version_id) {
        const text = translationById.get(t.current_version_id);
        if (text) translationByPassage.set(t.passage_id, text);
      }
    }

    // Build context block — up to 5000 chars of passage summaries + translations
    const manuscripts = new Set<string>();
    const languages = new Set<string>();
    const passageBlocks: string[] = [];
    let totalChars = 0;

    for (const p of passages) {
      const ms = p.manuscripts as unknown as { title: string; original_language: string };
      manuscripts.add(ms.title);
      languages.add(ms.original_language);

      const meta = (p.metadata as Record<string, unknown> | null) ?? {};
      const aiSummary = meta.ai_summary as { summary?: string } | undefined;
      const translation = translationByPassage.get(p.id);

      const block = [
        `[${p.reference} — ${ms.title} (${ms.original_language})]`,
        aiSummary?.summary ? `Summary: ${aiSummary.summary}` : "",
        translation ? `Translation: ${translation.slice(0, 300)}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      if (totalChars + block.length > 5000) break;
      passageBlocks.push(block);
      totalChars += block.length;
    }

    const prompt = `You are a biblical studies scholar. Generate a chapter-level summary for ${book} chapter ${chapter}.

Available data:
- ${manuscripts.size} manuscript(s): ${[...manuscripts].join(", ")}
- Languages: ${[...languages].join(", ")}
- ${passages.length} passage record(s)

Passage evidence:
${passageBlocks.join("\n\n")}

Call submit_chapter_summary with your synthesis. Be scholarly but accessible.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
        tools: [CHAPTER_SUMMARY_TOOL],
        tool_choice: { type: "tool", name: "submit_chapter_summary" },
      }),
    });

    if (!anthropicRes.ok) {
      console.error(`[summaries/chapter] AI error ${anthropicRes.status}`);
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
      return NextResponse.json({ error: "Unexpected AI response format" }, { status: 502 });
    }

    const parsed = toolBlock.input as ChapterSummaryContent;

    logAiActivity({ userId: user.id, route: "/api/summaries/chapter", model: AI_MODEL, tokensIn, tokensOut, costUsd: cost, context: { book, chapter } });

    // Upsert into ai_summaries
    await admin.from("ai_summaries").upsert(
      {
        level: "chapter",
        scope_key: scopeKey,
        content: parsed,
        model: AI_MODEL,
        cost_usd: cost,
        generated_at: new Date().toISOString(),
        version: 1,
      },
      { onConflict: "level,scope_key" }
    );

    return NextResponse.json({
      summary: parsed,
      cached: false,
      usage: { tokens_input: tokensIn, tokens_output: tokensOut, estimated_cost_usd: cost, ai_model: AI_MODEL },
    });
  } catch (err) {
    console.error("[summaries/chapter] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
