"use client";

import { useState } from "react";
import { BatchTranslatePanel } from "./batch-translate-panel";
import { DiscoveryPanel } from "./discovery-panel";
import { FullImportPanel } from "./full-import-panel";
import { OcrPanel } from "./ocr-panel";
import { VariantPanel } from "./variant-panel";
import { TaskList } from "./task-list";
import { SourceRegistryPanel } from "./source-registry-panel";
import { IiifHarvestPanel } from "./iiif-harvest-panel";
import { UsersPanel } from "./users-panel";
import { ActivityLogPanel } from "./activity-log-panel";
import type { AgentTask } from "@/lib/types";

interface ManuscriptOption {
  id: string;
  title: string;
  original_language: string;
}

interface PassageOption {
  id: string;
  reference: string;
  manuscript_id: string;
  manuscript_title: string;
}

interface Props {
  stats: {
    manuscripts: number;
    passages: number;
    translations: number;
    reviews: number;
  };
  initialTasks: AgentTask[];
  manuscripts: ManuscriptOption[];
  passagesForVariants: PassageOption[];
  userRole: string;
}

type Tab = "operations" | "registry" | "iiif" | "tasks" | "activity" | "users";

export function AdminDashboard({ stats, initialTasks, manuscripts, passagesForVariants, userRole }: Props) {
  const [tasks, setTasks] = useState<AgentTask[]>(initialTasks);
  const [activeTab, setActiveTab] = useState<Tab>("operations");

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

  const costByType = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.task_type] = (acc[t.task_type] ?? 0) + Number(t.estimated_cost_usd);
    return acc;
  }, {});

  const activeTasks = tasks.filter(
    (t) => t.status === "running" || t.status === "queued"
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "operations", label: "Agent Operations" },
    { id: "registry", label: "Source Registry" },
    { id: "iiif", label: "IIIF Harvest" },
    { id: "tasks", label: `Task History (${tasks.length})` },
    { id: "activity", label: "AI Activity" },
    ...(userRole === "admin" ? [{ id: "users" as Tab, label: "Users" }] : []),
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Agent task management, content pipeline, and cost monitoring.
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
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Agent Cost Summary
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Cost</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              ${totalCost.toFixed(4)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Tokens In</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatTokens(totalTokensIn)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Tokens Out</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatTokens(totalTokensOut)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active Tasks</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {activeTasks.length}
            </p>
          </div>
        </div>

        {/* Cost breakdown by type */}
        {Object.keys(costByType).length > 0 && (
          <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Cost by Type</p>
            <div className="mt-1.5 flex flex-wrap gap-3">
              {Object.entries(costByType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, cost]) => (
                  <span key={type} className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-medium">{TYPE_LABELS[type] ?? type}:</span>{" "}
                    ${cost.toFixed(4)}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-primary-700 text-primary-700 dark:border-primary-400 dark:text-primary-400"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "operations" && (
        <div className="space-y-8">
          <DiscoveryPanel />
          <FullImportPanel manuscripts={manuscripts} />
          <BatchTranslatePanel
            manuscripts={manuscripts}
            onTaskCreated={handleTaskCreated}
            onTaskUpdated={handleTaskUpdated}
          />
          <OcrPanel manuscripts={manuscripts} />
          <VariantPanel passages={passagesForVariants} />
        </div>
      )}

      {activeTab === "registry" && <SourceRegistryPanel />}

      {activeTab === "iiif" && <IiifHarvestPanel />}

      {activeTab === "tasks" && <TaskList tasks={tasks} />}

      {activeTab === "activity" && <ActivityLogPanel />}

      {activeTab === "users" && userRole === "admin" && <UsersPanel />}
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  batch_translate: "Translation",
  discover_manuscript: "Discovery",
  ocr_process: "OCR",
  detect_variants: "Variants",
  custom: "Custom",
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}
