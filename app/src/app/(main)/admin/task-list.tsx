"use client";

import type { AgentTask } from "@/lib/types";

interface Props {
  tasks: AgentTask[];
}

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-gray-100 text-gray-700",
  running: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-amber-100 text-amber-700",
};

const TYPE_LABELS: Record<string, string> = {
  batch_translate: "Batch Translation",
  discover_manuscript: "Manuscript Discovery",
  ocr_process: "OCR Processing",
  detect_variants: "Variant Detection",
  custom: "Custom Task",
};

export function TaskList({ tasks }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Agent Tasks</h2>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          No agent tasks yet. Start a batch translation above to create the
          first one.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        Agent Tasks ({tasks.length})
      </h2>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Progress</th>
              <th className="pb-2 pr-4">Tokens</th>
              <th className="pb-2 pr-4">Cost</th>
              <th className="pb-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const config = task.config as Record<string, unknown> | null;
              const lang = config?.target_language as string | undefined;
              const progressPct =
                task.total_items && task.total_items > 0
                  ? Math.round(
                      ((task.completed_items + task.failed_items) /
                        task.total_items) *
                        100
                    )
                  : null;

              return (
                <tr
                  key={task.id}
                  className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <td className="py-2 pr-4">
                    <span className="font-medium text-gray-900 dark:text-gray-200">
                      {TYPE_LABELS[task.task_type] ?? task.task_type}
                    </span>
                    {lang && (
                      <span className="ml-1.5 text-xs text-gray-400">
                        ({lang})
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[task.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-xs text-gray-600 dark:text-gray-400">
                    {task.total_items != null ? (
                      <span>
                        {task.completed_items}/{task.total_items}
                        {task.failed_items > 0 && (
                          <span className="text-red-500">
                            {" "}
                            ({task.failed_items} failed)
                          </span>
                        )}
                        {progressPct != null && (
                          <span className="ml-1 text-gray-400">
                            {progressPct}%
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs tabular-nums text-gray-600 dark:text-gray-400">
                    {task.tokens_input > 0
                      ? `${formatTokens(task.tokens_input)} / ${formatTokens(task.tokens_output)}`
                      : "—"}
                  </td>
                  <td className="py-2 pr-4 text-xs tabular-nums text-gray-600 dark:text-gray-400">
                    {Number(task.estimated_cost_usd) > 0
                      ? `$${Number(task.estimated_cost_usd).toFixed(4)}`
                      : "—"}
                  </td>
                  <td className="py-2 text-xs text-gray-400">
                    {formatDate(task.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
