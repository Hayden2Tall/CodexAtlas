import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";

export const maxDuration = 30;

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

    const body = await request.json();
    const { manuscript_id } = body;

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
    if (existingMeta.ai_summary) {
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

Respond with ONLY a JSON object (no markdown, no commentary):
{
  "summary": "2-3 sentence scholarly significance summary",
  "significance_factors": ["factor1", "factor2", "factor3"],
  "historical_period": "brief description of the manuscript's historical context",
  "related_traditions": "which textual traditions this manuscript belongs to or relates to"
}`;

    const aiModel = "claude-haiku-4-5-20251001";

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: aiModel,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      console.error(`[summaries/manuscript] AI error ${anthropicRes.status}`);
      return NextResponse.json({ error: "Summary generation failed" }, { status: 502 });
    }

    const aiResult = await anthropicRes.json();
    const rawContent = aiResult.content?.[0]?.text ?? "";
    const tokensIn = aiResult.usage?.input_tokens ?? 0;
    const tokensOut = aiResult.usage?.output_tokens ?? 0;
    const cost = estimateCostUsd(aiModel, tokensIn, tokensOut);

    let parsed;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] ?? rawContent);
    } catch {
      console.error("[summaries/manuscript] Parse failed:", rawContent.slice(0, 300));
      return NextResponse.json({ error: "Could not parse summary" }, { status: 502 });
    }

    const aiSummary = {
      summary: parsed.summary ?? "",
      significance_factors: Array.isArray(parsed.significance_factors) ? parsed.significance_factors : [],
      historical_period: parsed.historical_period ?? "",
      related_traditions: parsed.related_traditions ?? "",
      generated_at: new Date().toISOString(),
      model: aiModel,
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
      usage: { tokens_input: tokensIn, tokens_output: tokensOut, estimated_cost_usd: cost, ai_model: aiModel },
    });
  } catch (err) {
    console.error("[summaries/manuscript] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
