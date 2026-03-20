import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/settings/usage
 * Returns the current user's 100 most recent ai_activity_log entries + aggregate totals.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ai_activity_log")
    .select("id, route, model, tokens_in, tokens_out, cost_usd, context, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const entries = data ?? [];
  const totalCost = entries.reduce((sum, e) => sum + Number(e.cost_usd), 0);
  const totalTokensIn = entries.reduce((sum, e) => sum + e.tokens_in, 0);
  const totalTokensOut = entries.reduce((sum, e) => sum + e.tokens_out, 0);

  return NextResponse.json({
    entries,
    totals: { cost_usd: totalCost, tokens_in: totalTokensIn, tokens_out: totalTokensOut },
  });
}
