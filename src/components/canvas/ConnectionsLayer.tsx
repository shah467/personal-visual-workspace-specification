"use client";

import { useMemo } from "react";
import type { Connection, GraphNode } from "@/types/graph";
import { rectBorderPoint, curvedPath } from "@/lib/connection-path";

interface ConnectionsLayerProps {
  nodes: GraphNode[];
  connections: Connection[];
  selectedId: string | null;
  draft: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  onSelect: (id: string) => void;
}

export function ConnectionsLayer({ nodes, connections, selectedId, draft, onSelect }: ConnectionsLayerProps) {
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
      <g>
        {connections.map((connection) => {
          const source = nodeMap.get(connection.sourceId);
          const target = nodeMap.get(connection.targetId);
          if (!source || !target) return null;

          const sourceRect = { x: source.x, y: source.y, width: source.width, height: source.height };
          const targetRect = { x: target.x, y: target.y, width: target.width, height: target.height };
          const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
          const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };

          const p1 = rectBorderPoint(sourceRect, targetCenter.x, targetCenter.y);
          const p2 = rectBorderPoint(targetRect, sourceCenter.x, sourceCenter.y);
          const { d, labelX, labelY } = curvedPath(p1.x, p1.y, p2.x, p2.y);
          const selected = selectedId === connection.id;

          return (
            <g key={connection.id}>
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                className="pointer-events-auto cursor-pointer"
                onClick={() => onSelect(connection.id)}
              />
              <path
                d={d}
                fill="none"
                stroke={selected ? "var(--accent)" : "var(--border-strong)"}
                strokeWidth={selected ? 2 : 1.4}
                strokeDasharray={connection.style?.dashed ? "5 5" : undefined}
                opacity={selected ? 0.95 : 0.65}
              />
              {connection.label ? (
                <g transform={`translate(${labelX}, ${labelY})`}>
                  <rect x={-40} y={-10} width={80} height={20} rx={10} fill="var(--surface-1)" opacity={0.92} />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={10.5}
                    fill="var(--ink-muted)"
                  >
                    {connection.label.slice(0, 16)}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}

        {draft ? (
          <path
            d={curvedPath(draft.from.x, draft.from.y, draft.to.x, draft.to.y).d}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.6}
            strokeDasharray="4 4"
            opacity={0.85}
          />
        ) : null}
      </g>
    </svg>
  );
}
