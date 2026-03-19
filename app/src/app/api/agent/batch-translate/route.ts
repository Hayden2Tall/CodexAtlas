import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole, User, AgentTask, Passage } from "@/lib/types";

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

/**
 * POST /api/agent/batch-translate
 *
 * Creates a batch translation task and returns the list of passages that
 * need translation. The client orchestrates individual translate calls
 * (one passage at a time to stay within Vercel timeout limits) and
 * updates the task progress after each.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await requireAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const targetLanguage: string = body.target_language ?? "English";
    const manuscriptId: string | undefined = body.manuscript_id;
    // When true, include already-translated passages so they can be re-translated
    const includeTranslated: boolean = body.include_translated === true;

    const admin = createAdminClient();

    let passageQuery = admin
      .from("passages")
      .select("id, manuscript_id, reference, original_text")
      .not("original_text", "is", null);

    if (manuscriptId) {
      passageQuery = passageQuery.eq("manuscript_id", manuscriptId);
    }

    const { data: allPassages, error: pErr } = await passageQuery
      .order("created_at", { ascending: true })
      .returns<Pick<Passage, "id" | "manuscript_id" | "reference" | "original_text">[]>();

    if (pErr || !allPassages) {
      console.error("Failed to fetch passages:", pErr);
      return NextResponse.json(
        { error: "Failed to fetch passages" },
        { status: 500 }
      );
    }

    // Also count passages that have no original text at all
    let totalPassageCount = 0;
    if (allPassages.length === 0) {
      const countQuery = admin
        .from("passages")
        .select("id", { count: "exact", head: true });
      if (manuscriptId) countQuery.eq("manuscript_id", manuscriptId);
      const { count } = await countQuery;
      totalPassageCount = count ?? 0;

      return NextResponse.json({
        task: null,
        pending_passages: [],
        message: totalPassageCount > 0
          ? `Found ${totalPassageCount} passage(s) but none have original text yet. Add original text (manually or via OCR) before translating.`
          : "No passages found",
      });
    }

    const passageIds = allPassages.map((p) => p.id);

    const { data: existingTranslations } = await admin
      .from("translations")
      .select("passage_id")
      .in("passage_id", passageIds)
      .eq("target_language", targetLanguage)
      .not("current_version_id", "is", null);

    const translatedPassageIds = new Set(
      (existingTranslations ?? []).map((t: { passage_id: string }) => t.passage_id)
    );

    const pendingPassages = includeTranslated
      ? allPassages
      : allPassages.filter((p) => !translatedPassageIds.has(p.id));

    if (pendingPassages.length === 0) {
      return NextResponse.json({
        task: null,
        pending_passages: [],
        already_translated: translatedPassageIds.size,
        total_passages: allPassages.length,
        message: `All ${allPassages.length} passages already translated to ${targetLanguage}`,
      });
    }

    const { data: task, error: tErr } = await admin
      .from("agent_tasks")
      .insert({
        task_type: "batch_translate",
        status: "running",
        config: {
          target_language: targetLanguage,
          manuscript_id: manuscriptId ?? null,
        },
        total_items: pendingPassages.length,
        completed_items: 0,
        failed_items: 0,
        ai_model: "claude-sonnet-4-20250514",
        started_at: new Date().toISOString(),
        created_by: user.id,
      } as Record<string, unknown>)
      .select()
      .single<AgentTask>();

    if (tErr || !task) {
      console.error("Failed to create batch task:", tErr);
      return NextResponse.json(
        { error: "Failed to create batch task" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      task,
      pending_passages: pendingPassages.map((p) => ({
        ...p,
        is_translated: translatedPassageIds.has(p.id),
      })),
      total_passages: allPassages.length,
      already_translated: translatedPassageIds.size,
    }, { status: 201 });
  } catch (err) {
    console.error("POST /api/agent/batch-translate error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
