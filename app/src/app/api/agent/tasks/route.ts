import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole, User, AgentTask } from "@/lib/types";

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

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await requireAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: tasks, error } = await admin
      .from("agent_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<AgentTask[]>();

    if (error) {
      console.error("Failed to fetch tasks:", error);
      return NextResponse.json(
        { error: "Failed to fetch tasks" },
        { status: 500 }
      );
    }

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("GET /api/agent/tasks error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await requireAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { task_type, config, priority } = body;

    if (!task_type) {
      return NextResponse.json(
        { error: "task_type is required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: task, error } = await admin
      .from("agent_tasks")
      .insert({
        task_type,
        config: config ?? {},
        priority: priority ?? 0,
        created_by: user.id,
      } as Record<string, unknown>)
      .select()
      .single<AgentTask>();

    if (error || !task) {
      console.error("Failed to create task:", error);
      return NextResponse.json(
        { error: "Failed to create task" },
        { status: 500 }
      );
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    console.error("POST /api/agent/tasks error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
