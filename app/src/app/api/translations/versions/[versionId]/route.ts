import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

/**
 * DELETE /api/translations/versions/[versionId]
 *
 * Soft-deletes a translation version by marking status = 'superseded'.
 * If this was the current version, reverts translations.current_version_id
 * to the most recent previous non-superseded version, or null if none exists.
 *
 * Authorization:
 * - contributor: can only delete their own versions
 * - editor/admin: can delete any version
 * - others: 403
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single<{ role: UserRole }>();

  if (!profile || !["contributor", "editor", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { versionId } = await params;
  const admin = createAdminClient();

  // Fetch the version to delete
  const { data: version, error: fetchError } = await admin
    .from("translation_versions")
    .select("id, translation_id, version_number, status, created_by")
    .eq("id", versionId)
    .single<{
      id: string;
      translation_id: string;
      version_number: number;
      status: string;
      created_by: string | null;
    }>();

  if (fetchError || !version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Contributors can only delete their own versions
  if (profile.role === "contributor" && version.created_by !== user.id) {
    return NextResponse.json({ error: "You can only delete your own translation versions" }, { status: 403 });
  }

  if (version.status === "superseded") {
    return NextResponse.json({ error: "Version is already superseded" }, { status: 409 });
  }

  // Check if this is the current version of its translation
  const { data: translation } = await admin
    .from("translations")
    .select("id, current_version_id")
    .eq("id", version.translation_id)
    .single<{ id: string; current_version_id: string | null }>();

  const isCurrent = translation?.current_version_id === versionId;

  // Soft-delete: mark as superseded
  const { error: updateError } = await admin
    .from("translation_versions")
    .update({ status: "superseded" })
    .eq("id", versionId);

  if (updateError) {
    console.error("[versions/delete] update error:", updateError);
    return NextResponse.json({ error: "Failed to delete version" }, { status: 500 });
  }

  // If this was the current version, revert to the previous one
  if (isCurrent && translation) {
    const { data: previousVersions } = await admin
      .from("translation_versions")
      .select("id, version_number")
      .eq("translation_id", version.translation_id)
      .neq("id", versionId)
      .neq("status", "superseded")
      .order("version_number", { ascending: false })
      .limit(1)
      .returns<{ id: string; version_number: number }[]>();

    const previousVersion = previousVersions?.[0] ?? null;

    // Revert current_version_id (null if no prior published version)
    await admin
      .from("translations")
      .update({ current_version_id: previousVersion?.id ?? null })
      .eq("id", translation.id);

    // If there was a previous version, re-publish it (it was superseded when this version was created)
    if (previousVersion) {
      await admin
        .from("translation_versions")
        .update({ status: "published" })
        .eq("id", previousVersion.id);
    }

    return NextResponse.json({
      success: true,
      reverted_to: previousVersion?.id ?? null,
    });
  }

  return NextResponse.json({ success: true, reverted_to: null });
}
