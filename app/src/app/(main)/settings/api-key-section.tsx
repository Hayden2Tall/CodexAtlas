"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  role: string;
  hasVaultKey: boolean;
  requestedAt: string | null;
}

const ELIGIBLE_ROLES = ["reader", "reviewer", "scholar"];

export function ApiKeySection({ role, hasVaultKey, requestedAt }: Props) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function applyToContribute() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/settings/contributor-request", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to submit application");
    } else {
      router.refresh();
    }
  }

  async function cancelApplication() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/settings/contributor-request", { method: "DELETE" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to cancel");
    } else {
      router.refresh();
    }
  }

  async function saveApiKey() {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/settings/api-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save key");
    } else {
      setSuccess("API key saved securely.");
      setApiKey("");
      router.refresh();
    }
  }

  async function removeApiKey() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/settings/api-key", { method: "DELETE" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to remove key");
    } else {
      setSuccess("API key removed.");
      router.refresh();
    }
  }

  // Admin/editor — no contributor UI needed
  if (role === "admin" || role === "editor") {
    return null;
  }

  // Contributor — show API key management
  if (role === "contributor") {
    return (
      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Anthropic API Key</h2>
        <p className="mb-4 text-xs text-gray-500">
          Your key is encrypted and stored securely. It is used only when you trigger AI tasks.
          Your Anthropic account is billed directly — CodexAtlas never charges you.
        </p>

        <div className="mb-4 rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-600">
          <p className="mb-1.5 font-semibold text-gray-700">Don&apos;t have an Anthropic API key?</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>Go to <span className="font-mono text-gray-800">console.anthropic.com</span> and sign up or log in</li>
            <li>Navigate to <span className="font-semibold">API Keys</span> in the left sidebar</li>
            <li>Click <span className="font-semibold">Create Key</span>, give it a name, and copy it</li>
            <li>Your key will start with <span className="font-mono text-gray-800">sk-ant-</span> — paste it below</li>
          </ol>
          <p className="mt-1.5 text-gray-400">You will be billed directly by Anthropic. CodexAtlas never charges you.</p>
        </div>

        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {success && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">{success}</p>}

        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-gray-600">Status:</span>
          {hasVaultKey ? (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
              Key stored
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              No key stored
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              {hasVaultKey ? "Update API key" : "Add API key"}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveApiKey}
              disabled={loading || !apiKey.trim()}
              className="rounded-md bg-primary-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-800 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save key"}
            </button>
            {hasVaultKey && (
              <button
                onClick={removeApiKey}
                disabled={loading}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Remove key
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Pending contributor
  if (role === "pending_contributor") {
    return (
      <section className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Contributor Application</h2>
        <p className="mb-4 text-sm text-gray-600">
          Your application is under review. An admin will approve or reject it.
          {requestedAt && (
            <span className="ml-1 text-xs text-gray-400">
              (Applied {new Date(requestedAt).toLocaleDateString()})
            </span>
          )}
        </p>
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <button
          onClick={cancelApplication}
          disabled={loading}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white disabled:opacity-50"
        >
          {loading ? "Cancelling..." : "Cancel application"}
        </button>
      </section>
    );
  }

  // Reader / reviewer / scholar — show apply button
  if (ELIGIBLE_ROLES.includes(role)) {
    return (
      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Contribute</h2>
        <p className="mb-4 text-sm text-gray-600">
          Contributors get full AI task access — translate, summarize, import, detect variants — using
          their own Anthropic API key. Your Anthropic account is billed directly.
        </p>
        <p className="mb-4 text-xs text-gray-400">
          Apply below and an admin will review your request. Once approved, you can add your
          Anthropic API key in this settings page to activate AI tasks.
        </p>
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <button
          onClick={applyToContribute}
          disabled={loading}
          className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Apply to contribute"}
        </button>
      </section>
    );
  }

  return null;
}
