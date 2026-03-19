import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/settings/contributor-request
 * Sets role = 'pending_contributor' and records the request timestamp.
 * Only callable by users whose current role is reader/reviewer/scholar.
 *
 * DELETE /api/settings/contributor-request
 * Cancels a pending application — reverts role to 'reader'.
 */

export async function POST() {
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
    .single<{ role: string }>();

  const ELIGIBLE_ROLES = ["reader", "reviewer", "scholar"];
  if (!profile || !ELIGIBLE_ROLES.includes(profile.role)) {
    return NextResponse.json(
      { error: "Only reader, reviewer, or scholar accounts can apply to contribute" },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ role: "pending_contributor", contributor_requested_at: new Date().toISOString() })
    .eq("id", user.id);

  if (updateError) {
    console.error("[contributor-request] update error:", updateError);
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE() {
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
    .single<{ role: string }>();

  if (!profile || profile.role !== "pending_contributor") {
    return NextResponse.json({ error: "No pending application to cancel" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ role: "reader", contributor_requested_at: null })
    .eq("id", user.id);

  if (updateError) {
    console.error("[contributor-request] cancel error:", updateError);
    return NextResponse.json({ error: "Failed to cancel application" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
