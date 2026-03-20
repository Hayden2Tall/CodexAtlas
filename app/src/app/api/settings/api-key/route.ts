import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/settings/api-key
 * Body: { api_key: string }
 * Stores or updates the contributor's Anthropic API key in Supabase Vault.
 * Only accessible by users with role = 'contributor'.
 *
 * DELETE /api/settings/api-key
 * Removes the stored API key from Vault.
 */

async function getContributorUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { error: "Unauthorized", status: 401 as const, user: null, supabase: null };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (!profile || !["contributor", "editor"].includes(profile.role)) {
    return { error: "Only contributors and editors can manage API keys", status: 403 as const, user: null, supabase: null };
  }

  return { user, supabase, error: null, status: null };
}

export async function POST(request: NextRequest) {
  const auth = await getContributorUser();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user } = auth;

  const body = await request.json();
  const { api_key } = body as { api_key?: string };

  if (!api_key || typeof api_key !== "string" || !api_key.startsWith("sk-ant-")) {
    return NextResponse.json(
      { error: "Invalid API key format — Anthropic keys start with sk-ant-" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("store_contributor_api_key", {
    p_user_id: user!.id,
    p_api_key: api_key,
  });

  if (error) {
    console.error("[api-key] store error:", error);
    return NextResponse.json({ error: "Failed to store API key" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const auth = await getContributorUser();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user } = auth;

  const admin = createAdminClient();
  const { error } = await admin.rpc("delete_contributor_api_key", {
    p_user_id: user!.id,
  });

  if (error) {
    console.error("[api-key] delete error:", error);
    return NextResponse.json({ error: "Failed to remove API key" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
