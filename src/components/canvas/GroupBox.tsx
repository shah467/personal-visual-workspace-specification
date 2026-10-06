"use client";

import { memo } from "react";
import clsx from "clsx";
import type { Group } from "@/types/graph";

interface GroupBoxProps {
  group: Group;
  selected: boolean;
  nodeCount: number;
  onPointerDownHeader: (event: React.PointerEvent) => void;
  onPointerDownResize: (event: React.PointerEvent) => void;
  onClick: (event: React.MouseEvent) => void;
}

export const GroupBox = memo(function GroupBox({
  group,
  selected,
  nodeCount,
  onPointerDownHeader,
  onPointerDownResize,
  onClick,
}: GroupBoxProps) {
  return (
    <div
      className={clsx(
        "pvw-group absolute flex select-none flex-col rounded-[22px] border-2 border-dashed",
        `node-color-${group.color}`,
        selected ? "bg-[var(--accent-soft)]" : "bg-[color-mix(in_oklab,var(--node-accent)_5%,transparent)]",
      )}
      style={{
        left: group.x,
        top: group.y,
        width: group.width,
        height: group.height,
        borderColor: selected ? "var(--accent)" : "var(--node-accent)",
      }}
      onClick={onClick}
    >
      <div
        className="group/header absolute -top-9 left-0 flex max-w-full cursor-grab items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--ink)] shadow-[var(--shadow-soft)] active:cursor-grabbing"
        onPointerDown={onPointerDownHeader}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--node-accent)" }} />
        <span className="truncate">{group.title || "Untitled Group"}</span>
        <span className="text-[var(--ink-faint)]">· {nodeCount}</span>
      </div>

      <div
        className="absolute bottom-0 right-0 h-5 w-5 translate-x-1/2 translate-y-1/2 cursor-se-resize opacity-0 transition-opacity hover:opacity-100"
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDownResize(e);
        }}
      >
        <svg viewBox="0 0 16 16" className="h-full w-full text-[var(--ink-faint)]">
          <path d="M14 2 L2 14 M14 8 L8 14" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </div>
    </div>
  );
});
