"use client";

import { useState } from "react";
import { BatchTranslatePanel } from "./batch-translate-panel";
import { TaskList } from "./task-list";
import type { AgentTask } from "@/lib/types";

interface Props {
  stats: {
    manuscripts: number;
    passages: number;
    translations: number;
    reviews: number;
  };
  initialTasks: AgentTask[];
}

export function AdminDashboard({ stats, initialTasks }: Props) {
  const [tasks, setTasks] = useState<AgentTask[]>(initialTasks);

  function handleTaskCreated(task: AgentTask) {
    setTasks((prev) => [task, ...prev]);
  }

  function handleTaskUpdated(updated: AgentTask) {
    setTasks((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
  }

  const totalCost = tasks.reduce(
    (sum, t) => sum + Number(t.estimated_cost_usd),
    0
  );
  const totalTokensIn = tasks.reduce((sum, t) => sum + t.tokens_input, 0);
  const totalTokensOut = tasks.reduce((sum, t) => sum + t.tokens_output, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Agent task management, batch operations, and cost monitoring.
        </p>
      </div>

      {/* Content stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Manuscripts" value={stats.manuscripts} />
        <StatCard label="Passages" value={stats.passages} />
        <StatCard label="Translations" value={stats.translations} />
        <StatCard label="Reviews" value={stats.reviews} />
      </div>

      {/* Cost overview */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700">
          Agent Cost Summary
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Total Cost</p>
            <p className="text-lg font-semibold text-gray-900">
              ${totalCost.toFixed(4)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Tokens In</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatTokens(totalTokensIn)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Tokens Out</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatTokens(totalTokensOut)}
            </p>
          </div>
        </div>
      </div>

      {/* Batch translate */}
      <BatchTranslatePanel
        onTaskCreated={handleTaskCreated}
        onTaskUpdated={handleTaskUpdated}
      />

      {/* Task list */}
      <TaskList tasks={tasks} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}
