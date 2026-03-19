"use client";

import { useState, useEffect, useCallback } from "react";

interface UserRow {
  id: string;
  display_name: string | null;
  role: string;
  created_at: string;
  contributor_requested_at: string | null;
  api_key_vault_id: string | null;
}

type FilterTab = "all" | "pending" | "contributors" | "editors" | "admins";

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: "bg-red-50 text-red-700",
  editor: "bg-purple-50 text-purple-700",
  contributor: "bg-blue-50 text-blue-700",
  pending_contributor: "bg-amber-50 text-amber-700",
  scholar: "bg-green-50 text-green-700",
  reviewer: "bg-gray-100 text-gray-600",
  reader: "bg-gray-50 text-gray-500",
};

export function UsersPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to load users");
    } else {
      setUsers(data.users ?? []);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function changeRole(userId: string, role: string) {
    setActionLoading(userId + role);
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    setActionLoading(null);
    if (!res.ok) {
      alert(data.error ?? "Failed to update role");
    } else {
      await loadUsers();
    }
  }

  const filtered = users.filter((u) => {
    if (filter === "pending") return u.role === "pending_contributor";
    if (filter === "contributors") return u.role === "contributor";
    if (filter === "editors") return u.role === "editor";
    if (filter === "admins") return u.role === "admin";
    return true;
  });

  const pendingCount = users.filter((u) => u.role === "pending_contributor").length;

  const tabs: { key: FilterTab; label: string; badge?: number }[] = [
    { key: "pending", label: "Pending", badge: pendingCount },
    { key: "contributors", label: "Contributors" },
    { key: "editors", label: "Editors" },
    { key: "admins", label: "Admins" },
    { key: "all", label: "All users" },
  ];

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading users...</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No users in this category.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">API key</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((u) => {
                const isActing = actionLoading?.startsWith(u.id);
                return (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">
                        {u.display_name ?? "(no name)"}
                      </span>
                      {u.contributor_requested_at && (
                        <span className="ml-2 text-xs text-gray-400">
                          Applied {new Date(u.contributor_requested_at).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          ROLE_BADGE_COLORS[u.role] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {u.api_key_vault_id ? (
                        <span className="text-xs text-green-600">Stored</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.role === "pending_contributor" && (
                          <>
                            <button
                              onClick={() => changeRole(u.id, "contributor")}
                              disabled={isActing}
                              className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => changeRole(u.id, "reader")}
                              disabled={isActing}
                              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {u.role !== "pending_contributor" && (
                          <select
                            value={u.role}
                            onChange={(e) => changeRole(u.id, e.target.value)}
                            disabled={isActing}
                            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 disabled:opacity-50"
                          >
                            <option value="reader">reader</option>
                            <option value="reviewer">reviewer</option>
                            <option value="scholar">scholar</option>
                            <option value="contributor">contributor</option>
                            <option value="editor">editor</option>
                            <option value="admin">admin</option>
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
