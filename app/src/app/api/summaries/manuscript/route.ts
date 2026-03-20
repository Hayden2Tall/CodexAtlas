import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import { getAnthropicApiKey } from "@/lib/utils/contributor-api-key";
import { logAiActivity } from "@/lib/utils/log-ai-activity";

export const maxDuration = 30;

const AI_MODEL = "claude-haiku-4-5-20251001";

const MANUSCRIPT_SUMMARY_TOOL = {
  name: "submit_manuscript_summary",
  description: "Submit a scholarly significance summary for a manuscript.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "2–3 sentence scholarly significance summary for researchers and general readers",
      },
      significance_factors: {
        type: "array",
        items: { type: "string" },
        description: "3–5 key factors that make this manuscript significant",
      },
      historical_period: {
        type: "string",
        description: "Brief description of the manuscript's historical context and dating",
      },
      related_traditions: {
        type: "string",
        description: "Which textual traditions this manuscript belongs to or relates to",
      },
    },
    required: ["summary", "significance_factors", "historical_period", "related_traditions"],
  },
};

interface ManuscriptSummaryContent {
  summary: string;
  significance_factors: string[];
  historical_period: string;
  related_traditions: string;
}

/**
 * POST /api/summaries/manuscript
 *
 * Generates a scholarly significance summary for a manuscript using AI.
 * Caches the result in manuscripts.metadata.ai_summary.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required to generate summaries" }, { status: 401 });
    }

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single<{ role: string }>();
    const apiKeyResult = await getAnthropicApiKey(user.id, profile?.role ?? "reader");
    if ("error" in apiKeyResult) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: apiKeyResult.status });
    }
    const anthropicApiKey = apiKeyResult.key;

    const body = await request.json();
    const { manuscript_id, force } = body;

    if (!manuscript_id) {
      return NextResponse.json({ error: "manuscript_id is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: manuscript } = await admin
      .from("manuscripts")
      .select("*")
      .eq("id", manuscript_id)
      .single();

    if (!manuscript) {
      return NextResponse.json({ error: "Manuscript not found" }, { status: 404 });
    }

    const existingMeta = (manuscript.metadata as Record<string, unknown>) ?? {};
    if (existingMeta.ai_summary && !force) {
      return NextResponse.json({
        summary: existingMeta.ai_summary,
        cached: true,
      });
    }

    const [passageCount, translationCount, variantCount] = await Promise.all([
      admin.from("passages").select("id", { count: "exact", head: true }).eq("manuscript_id", manuscript_id),
      admin
        .from("translations")
        .select("id, passages!inner(manuscript_id)", { count: "exact", head: true })
        .eq("passages.manuscript_id", manuscript_id),
      admin
        .from("variant_readings")
        .select("id", { count: "exact", head: true })
        .eq("manuscript_id", manuscript_id),
    ]);

    const prompt = `You are a manuscript studies scholar. Summarize the scholarly significance of this manuscript for researchers and general readers.

Manuscript: ${manuscript.title}
Language: ${manuscript.original_language}
Date: ${manuscript.estimated_date_start ?? "unknown"}–${manuscript.estimated_date_end ?? "unknown"} CE
Description: ${manuscript.description ?? "No description available"}
Origin: ${manuscript.origin_location ?? "unknown"}
Archive: ${manuscript.archive_location ?? "unknown"}
Stats: ${passageCount.count ?? 0} passages, ${translationCount.count ?? 0} translations, ${variantCount.count ?? 0} variant readings

Call submit_manuscript_summary with your analysis.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
        tools: [MANUSCRIPT_SUMMARY_TOOL],
        tool_choice: { type: "tool", name: "submit_manuscript_summary" },
      }),
    });

    if (!anthropicRes.ok) {
      console.error(`[summaries/manuscript] AI error ${anthropicRes.status}`);
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
      console.error("[summaries/manuscript] Unexpected AI response:", JSON.stringify(aiResult).slice(0, 300));
      return NextResponse.json({ error: "Unexpected AI response format" }, { status: 502 });
    }

    const parsed = toolBlock.input as ManuscriptSummaryContent;

    logAiActivity({ userId: user.id, route: "/api/summaries/manuscript", model: AI_MODEL, tokensIn, tokensOut, costUsd: cost, context: { manuscript_id } });

    const aiSummary = {
      summary: parsed.summary,
      significance_factors: parsed.significance_factors,
      historical_period: parsed.historical_period,
      related_traditions: parsed.related_traditions,
      generated_at: new Date().toISOString(),
      model: AI_MODEL,
      cost_usd: cost,
    };

    await admin
      .from("manuscripts")
      .update({
        metadata: { ...existingMeta, ai_summary: aiSummary },
      })
      .eq("id", manuscript_id);

    return NextResponse.json({
      summary: aiSummary,
      cached: false,
      usage: { tokens_input: tokensIn, tokens_output: tokensOut, estimated_cost_usd: cost, ai_model: AI_MODEL },
    });
  } catch (err) {
    console.error("[summaries/manuscript] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
