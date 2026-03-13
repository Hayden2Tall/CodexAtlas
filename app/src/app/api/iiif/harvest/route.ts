import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IIIF_INSTITUTIONS,
  fetchManifest,
  extractManuscriptMetadata,
  fetchCollection,
} from "@/lib/services/iiif";
import type { UserRole, User } from "@/lib/types";

export const maxDuration = 60;

const ADMIN_ROLES: UserRole[] = ["admin", "editor"];

interface HarvestRequest {
  institution_id: string;
  limit: number;
  offset: number;
  dry_run?: boolean;
  force_update?: boolean;
}

interface HarvestResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  has_more: boolean;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body: HarvestRequest = await request.json();
    const {
      institution_id,
      limit: rawLimit,
      offset: rawOffset,
      dry_run = false,
      force_update = false,
    } = body;

    // Input validation
    if (!institution_id || !(institution_id in IIIF_INSTITUTIONS)) {
      return NextResponse.json(
        {
          error: `Unknown institution_id "${institution_id}". Valid values: ${Object.keys(IIIF_INSTITUTIONS).join(", ")}`,
        },
        { status: 400 }
      );
    }
    const limit = Math.min(Math.max(1, Number(rawLimit) || 50), 100);
    const offset = Math.max(0, Number(rawOffset) || 0);

    const institution = IIIF_INSTITUTIONS[institution_id];
    const admin = createAdminClient();

    // Fetch manifest URLs from the collection
    let manifestUrls: string[];
    try {
      const allUrls = await fetchCollection(institution.collectionUrl);
      manifestUrls = allUrls.slice(offset, offset + limit);
      const has_more = offset + limit < allUrls.length;

      if (dry_run) {
        return NextResponse.json({
          created: 0,
          updated: 0,
          skipped: 0,
          errors: 0,
          has_more,
          dry_run: true,
          would_process: manifestUrls.length,
          total_available: allUrls.length,
        });
      }
    } catch (err) {
      return NextResponse.json(
        {
          error: `Failed to fetch collection from ${institution.name}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
        { status: 502 }
      );
    }

    const result: HarvestResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      has_more: offset + limit < manifestUrls.length + offset,
    };

    for (const manifestUrl of manifestUrls) {
      try {
        const manifest = await fetchManifest(manifestUrl);
        const meta = extractManuscriptMetadata(manifest, manifestUrl);

        if (!meta.title || meta.title === "Untitled") {
          result.skipped++;
          continue;
        }

        // Check if manuscript already exists by IIIF manifest URL
        const { data: existing } = await admin
          .from("manuscripts")
          .select("id")
          .eq("metadata->>iiif_manifest_url", manifestUrl)
          .single<{ id: string }>();

        if (existing && !force_update) {
          result.skipped++;
          continue;
        }

        const manuscriptData = {
          title: meta.title,
          description: meta.description,
          estimated_date_start: meta.estimatedDateStart,
          estimated_date_end: meta.estimatedDateEnd,
          archive_location: meta.archiveLocation,
          archive_identifier: meta.archiveIdentifier,
          original_language: meta.language ?? "unknown",
          metadata: {
            iiif_manifest_url: manifestUrl,
            iiif_institution: institution_id,
            iiif_institution_name: institution.name,
            page_count: meta.pageCount,
            thumbnail_url: meta.thumbnailUrl,
          },
        };

        if (existing) {
          const { error: uErr } = await admin
            .from("manuscripts")
            .update(manuscriptData as Record<string, unknown>)
            .eq("id", existing.id);
          if (uErr) {
            result.errors++;
            continue;
          }
          result.updated++;
        } else {
          const { data: newMs, error: iErr } = await admin
            .from("manuscripts")
            .insert(manuscriptData as Record<string, unknown>)
            .select("id")
            .single<{ id: string }>();

          if (iErr || !newMs) {
            result.errors++;
            continue;
          }

          // Create a stub passage with transcription_method = 'iiif_metadata'
          await admin.from("passages").insert({
            manuscript_id: newMs.id,
            reference: "Full manuscript",
            original_text: null,
            transcription_method: "iiif_metadata",
            created_by: user.id,
            metadata: {
              iiif_manifest_url: manifestUrl,
              iiif_institution: institution_id,
              page_count: meta.pageCount,
            },
          } as Record<string, unknown>);

          result.created++;
        }
      } catch (_err) {
        result.errors++;
      }
    }

    // Re-evaluate has_more accurately
    result.has_more = manifestUrls.length === limit;

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
