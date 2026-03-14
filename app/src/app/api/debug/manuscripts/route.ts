import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { User } from "@/lib/types";

/**
 * GET /api/debug/manuscripts
 * Admin-only: full inventory of manuscript records with archived status,
 * language, passage count, and visibility state.
 */
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single<Pick<User, "role">>();
  if (!["admin", "editor"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const admin = createAdminClient();

  const [{ data: manuscripts }, { data: passageCounts }] = await Promise.all([
    admin
      .from("manuscripts")
      .select("id, title, original_language, archived_at, created_at")
      .order("created_at", { ascending: true }),
    admin
      .from("passages")
      .select("manuscript_id")
      .not("original_text", "is", null),
  ]);

  const countByMs = new Map<string, number>();
  for (const p of passageCounts ?? []) {
    countByMs.set(p.manuscript_id, (countByMs.get(p.manuscript_id) ?? 0) + 1);
  }

  const rows = (manuscripts ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    language: m.original_language,
    archived: m.archived_at !== null,
    archived_at: m.archived_at,
    passagesWithText: countByMs.get(m.id) ?? 0,
    publiclyVisible: m.archived_at === null,
  }));

  const langCounts: Record<string, number> = {};
  for (const m of manuscripts ?? []) {
    langCounts[m.original_language] = (langCounts[m.original_language] ?? 0) + 1;
  }

  const archivedCount = rows.filter((r) => r.archived).length;

  return NextResponse.json({
    totalManuscripts: rows.length,
    nonArchived: rows.length - archivedCount,
    archived: archivedCount,
    languageSummary: langCounts,
    manuscripts: rows,
  });
}
