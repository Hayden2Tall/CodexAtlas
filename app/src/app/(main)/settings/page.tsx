import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { ApiKeySection } from "./api-key-section";
import { UsageSection } from "./usage-section";

export const metadata: Metadata = {
  title: "Settings — CodexAtlas",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  reader: "Can read all public content.",
  reviewer: "Can submit human reviews on existing translations.",
  scholar: "Can translate passages using the platform AI.",
  contributor: "Full AI task access using your own Anthropic API key.",
  pending_contributor: "Contributor application under review.",
  editor: "Full AI task access using the platform key. Can import and manage content.",
  admin: "Full access including user management.",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, role, contributor_requested_at, api_key_vault_id")
    .eq("id", user.id)
    .single<{
      display_name: string | null;
      role: string;
      contributor_requested_at: string | null;
      api_key_vault_id: string | null;
    }>();

  if (!profile) {
    redirect("/");
  }

  // For admins/editors we don't show the API key section — they use the platform key.
  // For contributors we show key status (set or not), but never the actual key.
  const hasVaultKey = !!profile.api_key_vault_id;

  return (
    <div className="mx-auto max-w-2xl py-12 px-4">
      <h1 className="mb-8 font-serif text-3xl font-bold text-primary-900 dark:text-primary-200">Settings</h1>

      {/* Account */}
      <section className="mb-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Account</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Display name</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {profile.display_name ?? user.email}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Email</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Role</span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary-50 dark:bg-primary-900/50 px-2.5 py-0.5 text-xs font-semibold text-primary-700 dark:text-primary-300">
                {profile.role}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {ROLE_DESCRIPTIONS[profile.role] ?? ""}
          </p>
        </div>
      </section>

      {/* Contributor section */}
      <ApiKeySection
        role={profile.role}
        hasVaultKey={hasVaultKey}
        requestedAt={profile.contributor_requested_at}
      />

      {/* AI usage */}
      <UsageSection />
    </div>
  );
}
