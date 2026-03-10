import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole, User, Manuscript, Passage } from "@/lib/types";

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

interface IngestPassage {
  reference: string;
  original_text: string | null;
  description: string;
}

/**
 * POST /api/agent/ingest
 *
 * Takes an approved manuscript discovery and creates the manuscript
 * plus any suggested passages in the database.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await requireAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      original_language,
      estimated_date_start,
      estimated_date_end,
      origin_location,
      archive_location,
      archive_identifier,
      description,
      historical_context,
      passages,
    } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Check for duplicate
    const { data: existing } = await admin
      .from("manuscripts")
      .select("id, title")
      .ilike("title", title.trim())
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          error: `Manuscript "${existing[0].title}" already exists`,
          existing_id: existing[0].id,
        },
        { status: 409 }
      );
    }

    // Create manuscript
    const { data: manuscript, error: mErr } = await admin
      .from("manuscripts")
      .insert({
        title: title.trim(),
        original_language: original_language ?? "grc",
        estimated_date_start: estimated_date_start ?? null,
        estimated_date_end: estimated_date_end ?? null,
        origin_location: origin_location ?? null,
        archive_location: archive_location ?? null,
        archive_identifier: archive_identifier ?? null,
        description: description ?? null,
        historical_context: historical_context ?? null,
        created_by: user.id,
        metadata: { ingested_by: "discovery_agent" },
      } as Record<string, unknown>)
      .select()
      .single<Manuscript>();

    if (mErr || !manuscript) {
      console.error("Manuscript creation failed:", mErr);
      return NextResponse.json(
        { error: "Failed to create manuscript" },
        { status: 500 }
      );
    }

    // Create passages if provided
    let passagesCreated = 0;
    const typedPassages: IngestPassage[] = Array.isArray(passages) ? passages : [];

    if (typedPassages.length > 0) {
      const passageRows = typedPassages
        .filter((p) => p.reference && typeof p.reference === "string")
        .map((p, i) => ({
          manuscript_id: manuscript.id,
          reference: p.reference.trim(),
          sequence_order: i + 1,
          original_text: p.original_text?.trim() || null,
          transcription_method: p.original_text ? "manual" : null,
          created_by: user.id,
          metadata: {
            ingested_by: "discovery_agent",
            passage_description: p.description || null,
          },
        }));

      if (passageRows.length > 0) {
        const { data: createdPassages, error: pErr } = await admin
          .from("passages")
          .insert(passageRows as Record<string, unknown>[])
          .select("id")
          .returns<Pick<Passage, "id">[]>();

        if (pErr) {
          console.error("Passage creation failed (manuscript still created):", pErr);
        } else {
          passagesCreated = createdPassages?.length ?? 0;
        }
      }
    }

    return NextResponse.json({
      manuscript,
      passages_created: passagesCreated,
    }, { status: 201 });
  } catch (err) {
    console.error("POST /api/agent/ingest error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
