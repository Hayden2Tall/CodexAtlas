import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import type { UserRole, User } from "@/lib/types";

export const maxDuration = 60;

const AI_MODEL = "claude-opus-4-6";
const ADMIN_ROLES: UserRole[] = ["admin", "editor"];

const GRAND_ASSESSMENT_TOOL = {
  name: "submit_grand_assessment",
  description:
    "Submit the grand unified assessment of the entire manuscript corpus in CodexAtlas.",
  input_schema: {
    type: "object" as const,
    properties: {
      narrative: {
        type: "string",
        description:
          "500–800 word grand narrative synthesizing the corpus: what these manuscripts collectively reveal, how they agree and diverge, what the translation evidence shows about textual transmission, and what a scholar reading this corpus for the first time should know.",
      },
      confidence_trends: {
        type: "string",
        description:
          "Observations about translation confidence across the corpus — where confidence is high, where it is contested, and what drives the variation.",
      },
      variant_patterns: {
        type: "string",
        description:
          "High-level patterns in textual variants across the manuscripts — whether divergences cluster in certain books, languages, or eras.",
      },
      cross_manuscript_insights: {
        type: "string",
        description:
          "What comparing manuscripts across languages and traditions reveals that single-manuscript reading does not — convergences, independent witnesses, scribal traditions.",
      },
      areas_of_certainty: {
        type: "array",
        items: { type: "string" },
        description: "3–5 areas where the corpus gives high-confidence textual evidence",
      },
      areas_of_uncertainty: {
        type: "array",
        items: { type: "string" },
        description: "3–5 areas where the corpus surfaces genuine textual uncertainty or scholarly debate",
      },
    },
    required: [
      "narrative",
      "confidence_trends",
      "variant_patterns",
      "cross_manuscript_insights",
      "areas_of_certainty",
      "areas_of_uncertainty",
    ],
  },
};

interface GrandAssessmentContent {
  narrative: string;
  confidence_trends: string;
  variant_patterns: string;
  cross_manuscript_insights: string;
  areas_of_certainty: string[];
  areas_of_uncertainty: string[];
}

/**
 * POST /api/summaries/grand
 *
 * Generates the grand unified assessment of the entire CodexAtlas corpus.
 * Admin/editor only. Expensive — uses Opus model.
 * Cached in ai_summaries (level='grand', scope_key='grand').
 *
 * Body: {} (no params — always operates on the full corpus)
 */
export async function POST(request: NextRequest) {
  // Satisfy linter — body is intentionally unused
  void request;

  try {
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

    if (!profile || !ADMIN_ROLES.includes(profile.role as UserRole)) {
      return NextResponse.json(
        { error: "Admin or editor role required to generate grand assessment" },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // Gather all book summaries
    const { data: bookSummaries } = await admin
      .from("ai_summaries")
      .select("scope_key, content, generated_at")
      .eq("level", "book")
      .order("scope_key");

    if (!bookSummaries?.length) {
      return NextResponse.json(
        { error: "No book summaries found — generate book summaries first" },
        { status: 422 }
      );
    }

    // Gather corpus stats
    const { count: totalManuscripts } = await admin
      .from("manuscripts")
      .select("*", { count: "exact", head: true })
      .is("archived_at", null);

    const { count: totalPassages } = await admin
      .from("passages")
      .select("*", { count: "exact", head: true })
      .not("original_text", "is", null);

    const { count: totalTranslations } = await admin
      .from("translation_versions")
      .select("*", { count: "exact", head: true })
      .eq("status", "published");

    // Build book context — up to 8000 chars
    const bookBlocks: string[] = [];
    let totalChars = 0;

    for (const bs of bookSummaries) {
      const content = bs.content as {
        overview?: string;
        theological_themes?: string[];
        manuscript_tradition?: string;
      };
      const block = [
        `[${bs.scope_key}]`,
        content.overview ?? "",
        content.manuscript_tradition ? `Manuscript tradition: ${content.manuscript_tradition}` : "",
        content.theological_themes?.length
          ? `Themes: ${content.theological_themes.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      if (totalChars + block.length > 8000) break;
      bookBlocks.push(block);
      totalChars += block.length;
    }

    const prompt = `You are a senior biblical textual scholar conducting a grand assessment of the CodexAtlas manuscript corpus.

Corpus statistics:
- ${totalManuscripts ?? "?"} manuscripts
- ${totalPassages ?? "?"} passages with original text
- ${totalTranslations ?? "?"} published AI translations
- ${bookSummaries.length} books with summaries

Book-level evidence:
${bookBlocks.join("\n\n")}

Call submit_grand_assessment with your comprehensive synthesis. This is the authoritative overview of the entire corpus — be thorough, specific where data supports it, and honest about uncertainty.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
        tools: [GRAND_ASSESSMENT_TOOL],
        tool_choice: { type: "tool", name: "submit_grand_assessment" },
      }),
    });

    if (!anthropicRes.ok) {
      console.error(`[summaries/grand] AI error ${anthropicRes.status}`);
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

    const parsed = toolBlock.input as GrandAssessmentContent;

    const { data: existing } = await admin
      .from("ai_summaries")
      .select("version")
      .eq("level", "grand")
      .eq("scope_key", "grand")
      .single();

    await admin.from("ai_summaries").upsert(
      {
        level: "grand",
        scope_key: "grand",
        content: parsed,
        model: AI_MODEL,
        cost_usd: cost,
        generated_at: new Date().toISOString(),
        version: (existing?.version ?? 0) + 1,
      },
      { onConflict: "level,scope_key" }
    );

    return NextResponse.json({
      summary: parsed,
      cached: false,
      usage: { tokens_input: tokensIn, tokens_output: tokensOut, estimated_cost_usd: cost, ai_model: AI_MODEL },
    });
  } catch (err) {
    console.error("[summaries/grand] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
