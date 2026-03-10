import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import type { UserRole, User, AgentTask } from "@/lib/types";

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

export interface DiscoveredPassage {
  reference: string;
  original_text: string | null;
  description: string;
}

export interface DiscoveredManuscript {
  title: string;
  original_language: string;
  estimated_date_start: number | null;
  estimated_date_end: number | null;
  origin_location: string | null;
  archive_location: string | null;
  archive_identifier: string | null;
  description: string;
  historical_context: string;
  suggested_passages: DiscoveredPassage[];
  confidence_notes: string;
}

/**
 * POST /api/agent/discover
 *
 * Takes a research query and uses Claude to suggest manuscripts that match.
 * Returns structured manuscript data suitable for review and ingestion.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await requireAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const query: string = body.query;
    const maxResults: number = body.max_results ?? 5;

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return NextResponse.json(
        { error: "A research query of at least 3 characters is required" },
        { status: 400 }
      );
    }

    const aiModel = "claude-sonnet-4-20250514";
    const prompt = buildDiscoveryPrompt(query.trim(), maxResults);

    const anthropicRes = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
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
      }
    );

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, detail);
      return NextResponse.json(
        { error: "Discovery service unavailable" },
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
        { error: "Empty response from discovery service" },
        { status: 502 }
      );
    }

    const manuscripts = parseDiscoveryResponse(rawContent);

    if (!manuscripts || manuscripts.length === 0) {
      console.error("Failed to parse discovery response:", rawContent.slice(0, 500));
      return NextResponse.json(
        { error: "Could not parse discovery results" },
        { status: 502 }
      );
    }

    // Check for duplicates against existing manuscripts
    const admin = createAdminClient();
    const titles = manuscripts.map((m) => m.title);
    const { data: existing } = await admin
      .from("manuscripts")
      .select("title")
      .in("title", titles);

    const existingTitles = new Set(
      (existing ?? []).map((e: { title: string }) => e.title.toLowerCase())
    );

    const results = manuscripts.map((m) => ({
      ...m,
      already_exists: existingTitles.has(m.title.toLowerCase()),
    }));

    // Track the discovery task
    await admin
      .from("agent_tasks")
      .insert({
        task_type: "discover_manuscript",
        status: "completed",
        config: { query: query.trim(), max_results: maxResults },
        result: { manuscripts_found: manuscripts.length, duplicates: existingTitles.size },
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: costUsd,
        ai_model: aiModel,
        total_items: manuscripts.length,
        completed_items: manuscripts.length,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        created_by: user.id,
      } as Record<string, unknown>);

    return NextResponse.json({
      manuscripts: results,
      usage: {
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: costUsd,
        ai_model: aiModel,
      },
    });
  } catch (err) {
    console.error("POST /api/agent/discover error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function buildDiscoveryPrompt(query: string, maxResults: number): string {
  return `You are a manuscript research assistant specializing in ancient and medieval texts. Given a research query, suggest real, historically documented manuscripts that match the criteria.

Research query: "${query}"

Respond ONLY with a JSON array (no markdown fences, no extra text) of up to ${maxResults} manuscript suggestions. Each object must have exactly these fields:

[
  {
    "title": "Full scholarly title of the manuscript",
    "original_language": "ISO 639-3 code (e.g., grc, hbo, lat, syc, cop, ara, akk, got, arm, geo, eth, san)",
    "estimated_date_start": 100,
    "estimated_date_end": 200,
    "origin_location": "Place of origin if known",
    "archive_location": "Current repository",
    "archive_identifier": "Catalog or shelf number",
    "description": "Brief scholarly description",
    "historical_context": "Historical significance and provenance",
    "suggested_passages": [
      {
        "reference": "Standard scholarly reference (e.g., Chapter 1:1-5, Folio 12r)",
        "original_text": "Original language text if you can confidently provide it, otherwise null",
        "description": "What this passage contains"
      }
    ],
    "confidence_notes": "What is well-established vs uncertain about this entry"
  }
]

Guidelines:
- Only suggest manuscripts that are historically documented and well-attested
- Dates should be integers representing years (positive for CE, negative for BCE)
- Include 1-5 key passages per manuscript
- For original_text: provide actual text only if you are confident it is accurate; use null if uncertain
- confidence_notes should clearly distinguish established facts from scholarly speculation
- Prefer well-known, important manuscripts with good available scholarship`;
}

function parseDiscoveryResponse(raw: string): DiscoveredManuscript[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return validateManuscripts(parsed);
  } catch {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) return validateManuscripts(parsed);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function validateManuscripts(arr: Record<string, unknown>[]): DiscoveredManuscript[] {
  return arr
    .filter((m) => typeof m.title === "string" && m.title.length > 0)
    .map((m) => ({
      title: String(m.title),
      original_language: typeof m.original_language === "string" ? m.original_language : "grc",
      estimated_date_start:
        typeof m.estimated_date_start === "number" ? m.estimated_date_start : null,
      estimated_date_end:
        typeof m.estimated_date_end === "number" ? m.estimated_date_end : null,
      origin_location:
        typeof m.origin_location === "string" ? m.origin_location : null,
      archive_location:
        typeof m.archive_location === "string" ? m.archive_location : null,
      archive_identifier:
        typeof m.archive_identifier === "string" ? m.archive_identifier : null,
      description: typeof m.description === "string" ? m.description : "",
      historical_context:
        typeof m.historical_context === "string" ? m.historical_context : "",
      suggested_passages: Array.isArray(m.suggested_passages)
        ? (m.suggested_passages as Record<string, unknown>[])
            .filter((p) => typeof p.reference === "string")
            .map((p) => ({
              reference: String(p.reference),
              original_text:
                typeof p.original_text === "string" ? p.original_text : null,
              description: typeof p.description === "string" ? p.description : "",
            }))
        : [],
      confidence_notes:
        typeof m.confidence_notes === "string" ? m.confidence_notes : "",
    }));
}
