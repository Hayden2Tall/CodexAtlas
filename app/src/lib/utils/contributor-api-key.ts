import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Returns the Anthropic API key to use for a given request.
 *
 * - contributor: decrypts their personal key from Supabase Vault.
 *   Returns a 402 error object if no key is stored.
 * - all other roles: returns the platform key from env.
 */
export async function getAnthropicApiKey(
  userId: string,
  role: string,
): Promise<{ key: string } | { error: string; status: number }> {
  if (role !== "contributor") {
    return { key: process.env.ANTHROPIC_API_KEY! };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_contributor_api_key", {
    p_user_id: userId,
  });

  if (error || !data) {
    return {
      error:
        "No Anthropic API key found. Add your key in Settings to use AI features as a contributor.",
      status: 402,
    };
  }

  return { key: data as string };
}
