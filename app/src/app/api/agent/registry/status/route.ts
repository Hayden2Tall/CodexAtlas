import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SOURCE_REGISTRY } from "@/lib/utils/source-registry";
import type { UserRole, User } from "@/lib/types";

const ADMIN_ROLES: UserRole[] = ["admin", "editor", "contributor"];

export async function GET() {
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

    const admin = createAdminClient();

    // Paginate to bypass the 1000-row Supabase default cap.
    // WLC alone has ~929 chapter rows; combined corpus easily exceeds 1000.
    const PAGE_SIZE = 1000;
    const allRows: { source: string; created_at: string }[] = [];
    let from = 0;
    while (true) {
      const { data: page, error } = await admin
        .from("manuscript_source_texts")
        .select("source, created_at")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!page?.length) break;
      allRows.push(...page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    // Build summary map
    const summary = new Map<
      string,
      { rowCount: number; lastImported: string | null }
    >();

    for (const row of allRows) {
      const existing = summary.get(row.source);
      if (!existing) {
        summary.set(row.source, { rowCount: 1, lastImported: row.created_at });
      } else {
        existing.rowCount++;
        // rows are ordered desc by created_at, so first seen is latest
      }
    }

    const sources = Object.values(SOURCE_REGISTRY).map((entry) => {
      const stats = summary.get(entry.sourceId);
      return {
        id: entry.id,
        sourceId: entry.sourceId,
        displayName: entry.displayName,
        language: entry.language,
        coverage: entry.coverage,
        license: entry.license,
        preprocessorScript: entry.preprocessorScript,
        transcriptionMethod: entry.transcriptionMethod,
        rowCount: stats?.rowCount ?? 0,
        lastImported: stats?.lastImported ?? null,
        status: (stats?.rowCount ?? 0) > 0 ? "loaded" : "empty",
      };
    });

    return NextResponse.json({ sources });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
