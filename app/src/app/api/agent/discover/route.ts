import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import type { UserRole, User, AgentTask } from "@/lib/types";

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);

    let anthropicRes: Response;
    try {
      anthropicRes = await fetch(
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
          signal: controller.signal,
        }
      );
    } catch (fetchErr) {
      clearTimeout(timeout);
      const isTimeout = fetchErr instanceof Error && fetchErr.name === "AbortError";
      return NextResponse.json(
        { error: isTimeout ? "Discovery timed out — try a more specific query" : "Discovery service unreachable" },
        { status: 502 }
      );
    }
    clearTimeout(timeout);

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, detail);
      return NextResponse.json(
        { error: `Discovery service error (${anthropicRes.status})` },
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
      .select("id, title")
      .in("title", titles);

    const existingMap = new Map(
      (existing ?? []).map((e: { id: string; title: string }) => [e.title.toLowerCase(), e.id])
    );

    const results = manuscripts.map((m) => ({
      ...m,
      already_exists: existingMap.has(m.title.toLowerCase()),
      existing_manuscript_id: existingMap.get(m.title.toLowerCase()) ?? null,
    }));

    // Track the discovery task
    await admin
      .from("agent_tasks")
      .insert({
        task_type: "discover_manuscript",
        status: "completed",
        config: { query: query.trim(), max_results: maxResults },
        result: { manuscripts_found: manuscripts.length, duplicates: existingMap.size },
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
        "reference": "Standard scholarly reference for this passage unit",
        "original_text": "Full original-language text for this passage unit",
        "description": "What this passage contains and its scholarly significance"
      }
    ],
    "confidence_notes": "What is well-established vs uncertain about this entry"
  }
]

CRITICAL passage guidelines:
- Each passage must be a SUBSTANTIAL, meaningful scholarly unit — an entire chapter, a complete pericope, a full folio, or a significant textual section. NEVER suggest individual verses or single lines.
- For biblical manuscripts: use whole chapters (e.g., "Genesis 1", "John 1", "Matthew 5-7") or recognized pericopes (e.g., "The Prologue of John", "The Sermon on the Mount").
- For non-biblical texts: use natural divisions like folios, sections, or titled segments.
- Include 2-5 passages per manuscript, each covering a significant portion of text.
- For original_text: ALWAYS provide the COMPLETE text in the original language/script for each passage unit. For well-known manuscripts (biblical codices, Dead Sea Scrolls, classical texts), use standard critical editions (NA28, BHS, etc.) as your source. Provide the full text of the chapter or pericope, not just the opening line. Only use null for genuinely unpublished or fragmentary texts where the content is unknown.

Other guidelines:
- Only suggest manuscripts that are historically documented and well-attested
- Dates should be integers representing years (positive for CE, negative for BCE)
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
