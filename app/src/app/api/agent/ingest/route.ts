import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole, User, Manuscript, Passage } from "@/lib/types";

const ADMIN_ROLES: UserRole[] = ["admin", "editor", "contributor"];

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
      existing_manuscript_id,
    } = body;

    const admin = createAdminClient();

    let manuscript: Manuscript;
    let isNew = false;

    if (existing_manuscript_id) {
      // Add passages to an existing manuscript
      const { data: existing } = await admin
        .from("manuscripts")
        .select("*")
        .eq("id", existing_manuscript_id)
        .single<Manuscript>();

      if (!existing) {
        return NextResponse.json(
          { error: "Existing manuscript not found" },
          { status: 404 }
        );
      }

      manuscript = existing;
    } else {
      // Create new manuscript
      if (!title || typeof title !== "string") {
        return NextResponse.json(
          { error: "title is required" },
          { status: 400 }
        );
      }

      const { data: duplicate } = await admin
        .from("manuscripts")
        .select("id, title")
        .ilike("title", title.trim())
        .limit(1);

      if (duplicate && duplicate.length > 0) {
        return NextResponse.json(
          {
            error: `Manuscript "${duplicate[0].title}" already exists`,
            existing_id: duplicate[0].id,
          },
          { status: 409 }
        );
      }

      const { data: created, error: mErr } = await admin
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

      if (mErr || !created) {
        console.error("Manuscript creation failed:", mErr);
        return NextResponse.json(
          { error: "Failed to create manuscript" },
          { status: 500 }
        );
      }

      manuscript = created;
      isNew = true;
    }

    // Get existing passage references to avoid duplicates and overlaps
    const { data: existingPassages } = await admin
      .from("passages")
      .select("reference")
      .eq("manuscript_id", manuscript.id);

    const existingRefs = (existingPassages ?? []).map(
      (p: { reference: string }) => p.reference.toLowerCase().trim()
    );

    function refsOverlap(newRef: string, existingRef: string): boolean {
      const a = newRef.toLowerCase().trim();
      const b = existingRef.toLowerCase().trim();
      if (a === b) return true;
      if (a.startsWith(b) || b.startsWith(a)) return true;
      // "John 1" contains "John 1:1-3" and vice versa
      const bookA = a.replace(/[\s:,\-\d]+$/g, "").trim();
      const bookB = b.replace(/[\s:,\-\d]+$/g, "").trim();
      if (bookA !== bookB || !bookA) return false;
      // Same book — check if one is a broader range containing the other
      const numA = a.replace(bookA, "").trim();
      const numB = b.replace(bookB, "").trim();
      if (!numA || !numB) return true; // one is the whole book/chapter
      return false;
    }

    function isDuplicate(ref: string): boolean {
      return existingRefs.some((existing) => refsOverlap(ref, existing));
    }

    let passagesCreated = 0;
    const typedPassages: IngestPassage[] = Array.isArray(passages) ? passages : [];

    if (typedPassages.length > 0) {
      const passageRows = typedPassages
        .filter(
          (p) =>
            p.reference &&
            typeof p.reference === "string" &&
            !isDuplicate(p.reference)
        )
        .map((p, i) => ({
          manuscript_id: manuscript.id,
          reference: p.reference.trim(),
          sequence_order: existingRefs.length + i + 1,
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
          console.error("Passage creation failed:", pErr);
        } else {
          passagesCreated = createdPassages?.length ?? 0;
        }
      }
    }

    const skipped = typedPassages.length - passagesCreated;

    return NextResponse.json({
      manuscript,
      passages_created: passagesCreated,
      passages_skipped: skipped > 0 ? skipped : 0,
      is_new: isNew,
    }, { status: isNew ? 201 : 200 });
  } catch (err) {
    console.error("POST /api/agent/ingest error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
