"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

interface Edge {
  id: string;
  parentId: string;
  parentTitle: string;
  parentDate: number | null;
  childId: string;
  childTitle: string;
  childDate: number | null;
  type: string;
  confidence: number | null;
}

interface StemmaViewProps {
  edges: Edge[];
}

interface TreeNode {
  id: string;
  title: string;
  date: number | null;
  children: TreeNode[];
  x: number;
  y: number;
}

const NODE_W = 160;
const NODE_H = 50;
const H_GAP = 40;
const V_GAP = 80;

const EDGE_STYLES: Record<string, { dash: string; color: string }> = {
  copy: { dash: "", color: "#6b7280" },
  derivative: { dash: "", color: "#3b82f6" },
  shared_source: { dash: "6,4", color: "#10b981" },
  hypothetical: { dash: "4,4", color: "#f59e0b" },
};

function formatYear(y: number | null): string {
  if (y == null) return "?";
  return y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`;
}

export function StemmaView({ edges }: StemmaViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { tree, svgW, svgH, drawnEdges } = useMemo(() => {
    const nodeMap = new Map<string, TreeNode>();
    const childIds = new Set<string>();

    for (const e of edges) {
      if (!nodeMap.has(e.parentId)) {
        nodeMap.set(e.parentId, { id: e.parentId, title: e.parentTitle, date: e.parentDate, children: [], x: 0, y: 0 });
      }
      if (!nodeMap.has(e.childId)) {
        nodeMap.set(e.childId, { id: e.childId, title: e.childTitle, date: e.childDate, children: [], x: 0, y: 0 });
      }
      nodeMap.get(e.parentId)!.children.push(nodeMap.get(e.childId)!);
      childIds.add(e.childId);
    }

    const roots = [...nodeMap.values()].filter((n) => !childIds.has(n.id));
    if (roots.length === 0 && nodeMap.size > 0) roots.push([...nodeMap.values()][0]);

    let nextX = 0;
    function layout(node: TreeNode, depth: number) {
      node.y = depth * (NODE_H + V_GAP);
      if (node.children.length === 0) {
        node.x = nextX;
        nextX += NODE_W + H_GAP;
      } else {
        for (const child of node.children) layout(child, depth + 1);
        const first = node.children[0].x;
        const last = node.children[node.children.length - 1].x;
        node.x = (first + last) / 2;
      }
    }

    for (const root of roots) layout(root, 0);

    const allNodes: TreeNode[] = [];
    function collect(n: TreeNode) { allNodes.push(n); n.children.forEach(collect); }
    roots.forEach(collect);

    const maxX = Math.max(...allNodes.map((n) => n.x + NODE_W), 400);
    const maxY = Math.max(...allNodes.map((n) => n.y + NODE_H), 200);

    const drawnEdgesArr = edges.map((e) => ({
      ...e,
      from: nodeMap.get(e.parentId)!,
      to: nodeMap.get(e.childId)!,
    }));

    return { tree: roots, svgW: maxX + 40, svgH: maxY + 40, drawnEdges: drawnEdgesArr };
  }, [edges]);

  const selected = selectedId
    ? (() => {
        const allNodes: TreeNode[] = [];
        function collect(n: TreeNode) { allNodes.push(n); n.children.forEach(collect); }
        tree.forEach(collect);
        return allNodes.find((n) => n.id === selectedId);
      })()
    : null;

  return (
    <div>
      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-gray-600">
        {Object.entries(EDGE_STYLES).map(([type, style]) => (
          <span key={type} className="flex items-center gap-1.5">
            <svg width="24" height="8">
              <line x1="0" y1="4" x2="24" y2="4" stroke={style.color} strokeWidth="2" strokeDasharray={style.dash} />
            </svg>
            {type}
          </span>
        ))}
      </div>

      {/* SVG tree */}
      <div className="overflow-auto rounded-lg border border-gray-200 bg-white p-4">
        <svg width={svgW} height={svgH} className="min-w-full">
          {drawnEdges.map((e) => {
            const style = EDGE_STYLES[e.type] ?? EDGE_STYLES.copy;
            const x1 = e.from.x + NODE_W / 2;
            const y1 = e.from.y + NODE_H;
            const x2 = e.to.x + NODE_W / 2;
            const y2 = e.to.y;
            return (
              <line
                key={e.id}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={style.color}
                strokeWidth={2}
                strokeDasharray={style.dash}
              />
            );
          })}

          {(() => {
            const allNodes: TreeNode[] = [];
            function collect(n: TreeNode) { allNodes.push(n); n.children.forEach(collect); }
            tree.forEach(collect);
            return allNodes.map((node) => (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                onClick={() => setSelectedId(selectedId === node.id ? null : node.id)}
                className="cursor-pointer"
              >
                <rect
                  width={NODE_W} height={NODE_H} rx={8}
                  fill={selectedId === node.id ? "#eff6ff" : "#ffffff"}
                  stroke={selectedId === node.id ? "#3b82f6" : "#d1d5db"}
                  strokeWidth={selectedId === node.id ? 2 : 1}
                />
                <text x={NODE_W / 2} y={20} textAnchor="middle" className="fill-gray-900 text-xs font-medium">
                  {node.title.length > 20 ? node.title.slice(0, 18) + "…" : node.title}
                </text>
                <text x={NODE_W / 2} y={36} textAnchor="middle" className="fill-gray-400 text-[10px]">
                  {formatYear(node.date)}
                </text>
              </g>
            ));
          })()}
        </svg>
      </div>

      {/* Selected detail */}
      {selected && (
        <div className="mt-4 rounded-lg border border-primary-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-lg font-semibold text-gray-900">{selected.title}</h3>
              <p className="text-sm text-gray-500">{formatYear(selected.date)}</p>
            </div>
            <Link
              href={`/manuscripts/${selected.id}`}
              className="shrink-0 rounded-lg border border-primary-200 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50"
            >
              View manuscript
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
