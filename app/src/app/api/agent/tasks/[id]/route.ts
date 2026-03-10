import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole, User, AgentTask } from "@/lib/types";

const ADMIN_ROLES: UserRole[] = ["admin", "editor"];

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const user = await requireAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const admin = createAdminClient();
    const { data: task, error } = await admin
      .from("agent_tasks")
      .select("*")
      .eq("id", id)
      .single<AgentTask>();

    if (error || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (err) {
    console.error("GET /api/agent/tasks/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const user = await requireAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const allowedFields = [
      "status",
      "tokens_input",
      "tokens_output",
      "estimated_cost_usd",
      "ai_model",
      "total_items",
      "completed_items",
      "failed_items",
      "result",
      "error_message",
      "started_at",
      "completed_at",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: task, error } = await admin
      .from("agent_tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single<AgentTask>();

    if (error || !task) {
      console.error("Failed to update task:", error);
      return NextResponse.json(
        { error: "Failed to update task" },
        { status: 500 }
      );
    }

    return NextResponse.json({ task });
  } catch (err) {
    console.error("PATCH /api/agent/tasks/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
