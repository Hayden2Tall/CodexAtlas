import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

/**
 * GET /api/admin/users
 * Returns all users ordered by created_at desc.
 * Admin-only.
 */
export async function GET() {
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

  const admin = createAdminClient();

  // Join with auth.users to get email
  const { data: users, error: listError } = await admin
    .from("users")
    .select("id, display_name, role, created_at, contributor_requested_at, api_key_vault_id")
    .order("created_at", { ascending: false });

  if (listError) {
    console.error("[admin/users] list error:", listError);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }

  return NextResponse.json({ users: users ?? [] });
}
