import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

const VALID_ROLES: UserRole[] = [
  "reader",
  "reviewer",
  "scholar",
  "contributor",
  "pending_contributor",
  "editor",
  "admin",
];

/**
 * PATCH /api/admin/users/[id]/role
 * Body: { role: UserRole }
 * Changes the role of any user. Admin-only.
 *
 * When approving a contributor (role → contributor), contributor_requested_at is cleared.
 * When rejecting (role → reader), contributor_requested_at is also cleared.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const { id: targetId } = await params;
  const body = await request.json();
  const { role } = body as { role?: string };

  if (!role || !VALID_ROLES.includes(role as UserRole)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Clear contributor_requested_at when the application is resolved
  const clearRequest = role === "contributor" || role === "reader";
  const updatePayload: Record<string, unknown> = { role };
  if (clearRequest) {
    updatePayload.contributor_requested_at = null;
  }

  const { error: updateError } = await admin
    .from("users")
    .update(updatePayload)
    .eq("id", targetId);

  if (updateError) {
    console.error("[admin/users/role] update error:", updateError);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: targetId, role });
}
