import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole, User, Passage } from "@/lib/types";

const WRITE_ROLES: UserRole[] = ["admin", "editor", "scholar"];

async function requireWriter(supabase: Awaited<ReturnType<typeof createClient>>) {
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

  if (!profile || !WRITE_ROLES.includes(profile.role as UserRole)) return null;

  return user;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const user = await requireWriter(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.original_text !== undefined) {
      updates.original_text = body.original_text?.trim() || null;
      if (updates.original_text && !body.transcription_method) {
        updates.transcription_method = "manual";
      }
    }
    if (body.reference !== undefined) {
      updates.reference = body.reference.trim();
    }
    if (body.transcription_method !== undefined) {
      updates.transcription_method = body.transcription_method;
    }
    if (body.sequence_order !== undefined) {
      updates.sequence_order = body.sequence_order;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const admin = createAdminClient();
    const { data: passage, error: err } = await admin
      .from("passages")
      .update(updates)
      .eq("id", id)
      .select()
      .single<Passage>();

    if (err || !passage) {
      return NextResponse.json(
        { error: err?.message ?? "Passage not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ passage });
  } catch (err) {
    console.error("PATCH /api/passages/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const user = await requireWriter(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("passages")
      .select("id")
      .eq("id", id)
      .single<Pick<Passage, "id">>();

    if (!existing) {
      return NextResponse.json({ error: "Passage not found" }, { status: 404 });
    }

    const { error: err } = await admin
      .from("passages")
      .delete()
      .eq("id", id);

    if (err) {
      return NextResponse.json(
        { error: err.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/passages/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
