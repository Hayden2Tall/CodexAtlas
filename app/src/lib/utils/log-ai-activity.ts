import { createAdminClient } from "@/lib/supabase/admin";

interface LogParams {
  userId: string;
  route: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  context?: Record<string, unknown>;
}

/**
 * Fire-and-forget activity log write. Never throws — failures are logged to console only.
 * Call after a successful AI response; do not await.
 */
export function logAiActivity(params: LogParams): void {
  const admin = createAdminClient();
  admin
    .from("ai_activity_log")
    .insert({
      user_id: params.userId,
      route: params.route,
      model: params.model,
      tokens_in: params.tokensIn,
      tokens_out: params.tokensOut,
      cost_usd: params.costUsd,
      context: params.context ?? null,
    })
    .then(({ error }) => {
      if (error) console.error("[logAiActivity] insert failed:", error.message);
    });
}
