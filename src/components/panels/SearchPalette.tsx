"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/state/workspace-provider";
import { useCanvasUI } from "@/state/canvas-ui-provider";
import { NODE_TYPES } from "@/types/graph";

export function SearchPalette({ onClose }: { onClose: () => void }) {
  const workspace = useWorkspace();
  const ui = useCanvasUI();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workspace.nodes.slice(0, 8);
    return workspace.nodes
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.type.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [query, workspace.nodes]);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 pt-[14vh]" onClick={onClose}>
      <div
        className="pvw-pop w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] shadow-[var(--shadow-elevated)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <span className="text-[var(--ink-faint)]">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your workspace…"
            className="flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
          />
          <kbd className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--ink-faint)]">Esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--ink-faint)]">No matches found.</p>
          ) : (
            results.map((node) => {
              const typeMeta = NODE_TYPES.find((t) => t.value === node.type);
              return (
                <button
                  key={node.id}
                  onClick={() => {
                    ui.focusNode(node.id);
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--surface-hover)]"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs"
                    style={{ background: `var(--node-${node.color})`, color: "var(--surface-0)" }}
                  >
                    {typeMeta?.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--ink)]">
                      {node.title || "Untitled"}
                    </span>
                    <span className="block truncate text-xs text-[var(--ink-faint)]">
                      {typeMeta?.label} {node.content ? `· ${node.content.slice(0, 60)}` : ""}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
