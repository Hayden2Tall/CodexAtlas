import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BOOK_ORDER } from "@/lib/utils/book-order";
import type { User } from "@/lib/types";

/**
 * GET /api/debug/passages?book=Psalms&chapter=34
 * Admin-only diagnostic: shows what passages exist for a given book+chapter,
 * what the loadChapterData query finds, and any Supabase errors.
 */
export async function GET(request: NextRequest) {
  // Require admin auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single<Pick<User, "role">>();
  if (!["admin", "editor"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const book = searchParams.get("book") ?? "Psalms";
  const chapter = parseInt(searchParams.get("chapter") ?? "34", 10);

  const admin = createAdminClient();

  // 1. Raw broad query — ilike %book% to see what's there
  const { data: rawPassages, error: rawError } = await admin
    .from("passages")
    .select("id, reference, manuscript_id, transcription_method, original_text")
    .ilike("reference", `%${book}%`)
    .ilike("reference", `% ${chapter}%`);

  // 2. Simulate exact loadChapterData logic
  const targetOrder = BOOK_ORDER[book.toLowerCase()] ?? 999;
  const aliases = targetOrder !== 999
    ? [...new Set(Object.entries(BOOK_ORDER).filter(([, v]) => v === targetOrder).map(([k]) => k))]
    : [book.toLowerCase()];

  const SELECT = `id, reference, original_text, manuscript_id, transcription_method, manuscripts!inner(id, title, original_language, estimated_date_start, estimated_date_end)`;

  const aliasResults = await Promise.all(
    aliases.map(async (alias) => {
      const pattern = `${alias} ${chapter}%`;
      const { data, error } = await admin
        .from("passages")
        .select(SELECT)
        .ilike("reference", pattern)
        .not("original_text", "is", null);
      return { alias, pattern, data, error: error ? error.message : null, count: data?.length ?? 0 };
    })
  );

  const seenIds = new Set<string>();
  const merged = [];
  for (const r of aliasResults) {
    for (const row of r.data ?? []) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id);
        merged.push(row);
      }
    }
  }

  return NextResponse.json({
    book,
    chapter,
    targetOrder,
    aliases,
    rawQuery: {
      error: rawError?.message ?? null,
      count: rawPassages?.length ?? 0,
      refs: rawPassages?.map(p => ({ id: p.id, ref: p.reference, textLen: p.original_text?.length ?? 0, method: p.transcription_method })) ?? [],
    },
    aliasQueries: aliasResults.map(r => ({
      alias: r.alias,
      pattern: r.pattern,
      error: r.error,
      count: r.count,
      refs: r.data?.map((p: { id: string; reference: string; original_text: string | null }) => p.reference) ?? [],
    })),
    mergedCount: merged.length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mergedRefs: merged.map((p: any) => ({ ref: p.reference, ms: p.manuscripts?.title })),
  });
}
