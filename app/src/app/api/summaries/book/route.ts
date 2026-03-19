import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import { getAnthropicApiKey } from "@/lib/utils/contributor-api-key";

export const maxDuration = 45;

const AI_MODEL = "claude-sonnet-4-6";

const BOOK_SUMMARY_TOOL = {
  name: "submit_book_summary",
  description: "Submit a scholarly book-level summary synthesizing chapter summaries and manuscript evidence.",
  input_schema: {
    type: "object" as const,
    properties: {
      overview: {
        type: "string",
        description: "3–4 sentence overview of the book's content, purpose, and place in the canon",
      },
      structure: {
        type: "string",
        description: "How the book is organized — major sections, narrative arc, or thematic structure",
      },
      theological_themes: {
        type: "array",
        items: { type: "string" },
        description: "4–8 major theological or literary themes that run through the entire book",
      },
      manuscript_tradition: {
        type: "string",
        description:
          "Overview of the manuscript tradition: how many manuscripts, language diversity, textual stability or variation, notable features",
      },
      scholarly_significance: {
        type: "string",
        description: "Why this book matters in biblical studies — historical, theological, or literary importance",
      },
    },
    required: ["overview", "structure", "theological_themes", "manuscript_tradition", "scholarly_significance"],
  },
};

interface BookSummaryContent {
  overview: string;
  structure: string;
  theological_themes: string[];
  manuscript_tradition: string;
  scholarly_significance: string;
}

/**
 * POST /api/summaries/book
 * Body: { book: string }
 *
 * Generates a book-level summary by aggregating chapter summaries.
 * Cached in ai_summaries (level='book', scope_key='BookName').
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
    const { book } = body as { book?: string };

    if (!book || typeof book !== "string") {
      return NextResponse.json({ error: "book (string) is required" }, { status: 400 });
    }

    const scopeKey = book;
    const admin = createAdminClient();

    // Return cached summary if it exists
    const { data: cached } = await admin
      .from("ai_summaries")
      .select("content, model, generated_at, version")
      .eq("level", "book")
      .eq("scope_key", scopeKey)
      .single();

    if (cached) {
      return NextResponse.json({ summary: cached.content, cached: true });
    }

    // Gather existing chapter summaries for this book
    const { data: chapterSummaries } = await admin
      .from("ai_summaries")
      .select("scope_key, content, generated_at")
      .eq("level", "chapter")
      .ilike("scope_key", `${book} %`)
      .order("scope_key");

    if (!chapterSummaries?.length) {
      return NextResponse.json(
        { error: "No chapter summaries found — generate chapter summaries first" },
        { status: 422 }
      );
    }

    // Also pull manuscript diversity stats
    const { data: passages } = await admin
      .from("passages")
      .select("manuscript_id, manuscripts!inner(title, original_language)")
      .ilike("reference", `${book} %`)
      .not("original_text", "is", null);

    const manuscripts = new Set<string>();
    const languages = new Set<string>();
    for (const p of passages ?? []) {
      const ms = p.manuscripts as unknown as { title: string; original_language: string };
      manuscripts.add(ms.title);
      languages.add(ms.original_language);
    }

    // Build chapter context block — up to 6000 chars
    const chapterBlocks: string[] = [];
    let totalChars = 0;

    for (const cs of chapterSummaries) {
      const content = cs.content as { overview?: string; theological_themes?: string[] };
      const block = [
        `[${cs.scope_key}]`,
        content.overview ?? "",
        content.theological_themes?.length
          ? `Themes: ${content.theological_themes.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      if (totalChars + block.length > 6000) break;
      chapterBlocks.push(block);
      totalChars += block.length;
    }

    const prompt = `You are a biblical studies scholar. Generate a comprehensive book-level summary for the book of ${book}.

Manuscript data:
- ${manuscripts.size} manuscript(s): ${[...manuscripts].slice(0, 10).join(", ")}${manuscripts.size > 10 ? ` (+${manuscripts.size - 10} more)` : ""}
- Languages: ${[...languages].join(", ")}
- ${chapterSummaries.length} chapter(s) with summaries

Chapter-by-chapter evidence:
${chapterBlocks.join("\n\n")}

Call submit_book_summary with your synthesis.`;

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
        tools: [BOOK_SUMMARY_TOOL],
        tool_choice: { type: "tool", name: "submit_book_summary" },
      }),
    });

    if (!anthropicRes.ok) {
      console.error(`[summaries/book] AI error ${anthropicRes.status}`);
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

    const parsed = toolBlock.input as BookSummaryContent;

    await admin.from("ai_summaries").upsert(
      {
        level: "book",
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
    console.error("[summaries/book] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
