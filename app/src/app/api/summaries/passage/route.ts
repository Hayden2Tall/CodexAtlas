import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";

export const maxDuration = 30;

const PASSAGE_SUMMARY_TOOL = {
  name: "submit_passage_summary",
  description: "Submit the completed passage summary for storage.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "2-3 sentence plain-language summary of what this passage says",
      },
      historical_context: {
        type: "string",
        description: "1-2 sentences about the historical/literary context",
      },
      significance: {
        type: "string",
        description: "1 sentence about why this passage matters in biblical studies",
      },
      key_themes: {
        type: "array",
        items: { type: "string" },
        description: "2-4 key themes in this passage",
      },
    },
    required: ["summary", "historical_context", "significance", "key_themes"],
  },
};

interface PassageSummaryInput {
  summary: string;
  historical_context: string;
  significance: string;
  key_themes: string[];
}

/**
 * POST /api/summaries/passage
 *
 * Generates a plain-language AI summary for a passage. Caches the result
 * in passages.metadata.ai_summary so it is not regenerated on every view.
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
    const { passage_id } = body;

    if (!passage_id) {
      return NextResponse.json({ error: "passage_id is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: passage } = await admin
      .from("passages")
      .select("id, reference, original_text, metadata, manuscript_id, manuscripts!inner(title, original_language)")
      .eq("id", passage_id)
      .single();

    if (!passage) {
      return NextResponse.json({ error: "Passage not found" }, { status: 404 });
    }

    const existingMeta = (passage.metadata as Record<string, unknown>) ?? {};
    if (existingMeta.ai_summary) {
      return NextResponse.json({
        summary: existingMeta.ai_summary,
        cached: true,
      });
    }

    const { data: translations } = await admin
      .from("translations")
      .select("id, target_language, current_version_id")
      .eq("passage_id", passage_id);

    const versionIds = (translations ?? [])
      .map((t) => t.current_version_id)
      .filter(Boolean) as string[];

    let translatedText = "";
    if (versionIds.length) {
      const { data: versions } = await admin
        .from("translation_versions")
        .select("translated_text, confidence_score")
        .in("id", versionIds)
        .eq("status", "published")
        .order("confidence_score", { ascending: false })
        .limit(1);
      translatedText = versions?.[0]?.translated_text ?? "";
    }

    const ms = passage.manuscripts as unknown as { title: string; original_language: string };

    const userPrompt = `You are a biblical studies scholar. Provide a concise, informative summary of this passage for general readers.

Passage Reference: ${passage.reference}
Manuscript: ${ms.title} (${ms.original_language})
Original Text (excerpt): ${(passage.original_text ?? "").slice(0, 2000)}
${translatedText ? `English Translation: ${translatedText.slice(0, 2000)}` : ""}

Call submit_passage_summary with your analysis.`;

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
        messages: [{ role: "user", content: userPrompt }],
        tools: [PASSAGE_SUMMARY_TOOL],
        tool_choice: { type: "tool", name: "submit_passage_summary" },
      }),
    });

    if (!anthropicRes.ok) {
      console.error(`[summaries/passage] AI error ${anthropicRes.status}`);
      return NextResponse.json({ error: "Summary generation failed" }, { status: 502 });
    }

    const aiResult = await anthropicRes.json();
    const tokensIn = aiResult.usage?.input_tokens ?? 0;
    const tokensOut = aiResult.usage?.output_tokens ?? 0;
    const cost = estimateCostUsd(aiModel, tokensIn, tokensOut);

    const toolBlock = (aiResult.content as { type: string; input?: unknown }[] | undefined)
      ?.find((b) => b.type === "tool_use");

    if (!toolBlock?.input) {
      console.error("[summaries/passage] No tool_use block:", JSON.stringify(aiResult.content).slice(0, 300));
      return NextResponse.json({ error: "Could not parse summary" }, { status: 502 });
    }

    const parsed = toolBlock.input as PassageSummaryInput;

    const aiSummary = {
      summary: parsed.summary ?? "",
      historical_context: parsed.historical_context ?? "",
      significance: parsed.significance ?? "",
      key_themes: Array.isArray(parsed.key_themes) ? parsed.key_themes : [],
      generated_at: new Date().toISOString(),
      model: aiModel,
      cost_usd: cost,
    };

    await admin
      .from("passages")
      .update({
        metadata: { ...existingMeta, ai_summary: aiSummary },
      })
      .eq("id", passage_id);

    return NextResponse.json({
      summary: aiSummary,
      cached: false,
      usage: { tokens_input: tokensIn, tokens_output: tokensOut, estimated_cost_usd: cost, ai_model: aiModel },
    });
  } catch (err) {
    console.error("[summaries/passage] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
