import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import type { UserRole, User } from "@/lib/types";

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

export interface TocSection {
  reference: string;
  description: string;
  estimated_verses: number;
}

/**
 * POST /api/agent/discover/toc
 *
 * Given a manuscript title and language, asks Claude for a complete table
 * of contents listing every major section/chapter in the manuscript.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await requireAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, original_language, manuscript_id } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get existing passages for this manuscript to mark what's already imported
    let existingRefs: string[] = [];
    if (manuscript_id) {
      const { data: passages } = await admin
        .from("passages")
        .select("reference")
        .eq("manuscript_id", manuscript_id);
      existingRefs = (passages ?? []).map(
        (p: { reference: string }) => p.reference.toLowerCase().trim()
      );
    }

    const aiModel = "claude-sonnet-4-20250514";
    const prompt = buildTocPrompt(title, original_language ?? "grc");

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: aiModel,
        max_tokens: 16384,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, detail);
      return NextResponse.json(
        { error: "TOC service unavailable" },
        { status: 502 }
      );
    }

    const aiResult = await anthropicRes.json();
    const rawContent: string | undefined = aiResult.content?.[0]?.text;
    const tokensInput: number = aiResult.usage?.input_tokens ?? 0;
    const tokensOutput: number = aiResult.usage?.output_tokens ?? 0;
    const costUsd = estimateCostUsd(aiModel, tokensInput, tokensOutput);

    if (!rawContent) {
      return NextResponse.json(
        { error: "Empty response from TOC service" },
        { status: 502 }
      );
    }

    const sections = parseTocResponse(rawContent);

    if (!sections || sections.length === 0) {
      console.error("Failed to parse TOC response. Length:", rawContent.length, "Start:", rawContent.slice(0, 300));
      return NextResponse.json(
        {
          error: "Could not parse table of contents",
          debug_length: rawContent.length,
          debug_start: rawContent.slice(0, 200),
        },
        { status: 502 }
      );
    }

    const results = sections.map((s) => ({
      ...s,
      already_imported: existingRefs.some(
        (r) =>
          r === s.reference.toLowerCase().trim() ||
          r.startsWith(s.reference.toLowerCase().trim()) ||
          s.reference.toLowerCase().trim().startsWith(r)
      ),
    }));

    // Estimate cost of importing all unimported sections
    const unimportedCount = results.filter((r) => !r.already_imported).length;
    const estimatedImportCostPerSection = 0.015; // ~$0.015 per section text retrieval
    const estimatedTotalImportCost = unimportedCount * estimatedImportCostPerSection;

    await admin
      .from("agent_tasks")
      .insert({
        task_type: "discover_manuscript",
        status: "completed",
        config: { mode: "toc", title, original_language },
        result: { sections_found: sections.length, already_imported: results.filter((r) => r.already_imported).length },
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: costUsd,
        ai_model: aiModel,
        total_items: sections.length,
        completed_items: sections.length,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        created_by: user.id,
      } as Record<string, unknown>);

    return NextResponse.json({
      sections: results,
      total_sections: sections.length,
      already_imported: results.filter((r) => r.already_imported).length,
      estimated_import_cost: estimatedTotalImportCost,
      usage: {
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: costUsd,
        ai_model: aiModel,
      },
    });
  } catch (err) {
    console.error("POST /api/agent/discover/toc error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function buildTocPrompt(title: string, language: string): string {
  return `You are a manuscript research assistant. Given a manuscript, provide a COMPLETE table of contents listing every major section/chapter/book contained in it.

Manuscript: "${title}"
Original language code: "${language}"

Respond ONLY with a JSON array (no markdown fences, no extra text). Each entry represents one major textual unit that would form a single "passage" in a scholarly database — typically a chapter, a complete pericope, a folio, or a named section.

[
  {
    "reference": "Standard scholarly reference (e.g., 'Matthew 1', 'Genesis 1', 'Folio 12r-14v')",
    "description": "Brief description of what this section contains",
    "estimated_verses": 30
  }
]

CRITICAL RULES:
- List EVERY section in the manuscript, not just highlights. For a biblical codex, list every chapter of every book it contains.
- Use chapter-level granularity for biblical texts (e.g., "Matthew 1", "Matthew 2", NOT "Matthew 1:1-25").
- For non-biblical texts, use the natural divisions of the text (sections, folios, named parts).
- estimated_verses is the approximate number of verses or lines in the section (used for cost estimation).
- The reference format must be consistent and use standard scholarly conventions.
- Order sections in their natural reading/canonical order.
- Be EXHAUSTIVE. If the manuscript contains the complete Gospel of Matthew (28 chapters), list all 28 chapters.`;
}

function parseTocResponse(raw: string): TocSection[] | null {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");

  // Try direct parse
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return validateTocSections(parsed);
  } catch {
    // noop
  }

  // Try extracting JSON array from surrounding text
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) return validateTocSections(parsed);
    } catch {
      // noop
    }
  }

  // Handle truncated JSON — find the last complete object and close the array
  const arrayStart = cleaned.indexOf("[");
  if (arrayStart >= 0) {
    let truncated = cleaned.slice(arrayStart);
    const lastCloseBrace = truncated.lastIndexOf("}");
    if (lastCloseBrace > 0) {
      truncated = truncated.slice(0, lastCloseBrace + 1) + "]";
      try {
        const parsed = JSON.parse(truncated);
        if (Array.isArray(parsed)) return validateTocSections(parsed);
      } catch {
        // noop
      }
    }
  }

  return null;
}

function validateTocSections(arr: Record<string, unknown>[]): TocSection[] {
  return arr
    .filter((s) => typeof s.reference === "string" && s.reference.length > 0)
    .map((s) => ({
      reference: String(s.reference),
      description: typeof s.description === "string" ? s.description : "",
      estimated_verses: typeof s.estimated_verses === "number" ? s.estimated_verses : 20,
    }));
}
