"use client";

import { useWorkspace } from "@/state/workspace-provider";
import { Canvas } from "@/components/canvas/Canvas";
import { Toolbar } from "@/components/panels/Toolbar";
import { Inspector } from "@/components/panels/Inspector";

export function WorkspaceShell() {
  const workspace = useWorkspace();

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[var(--surface-0)]">
      <Canvas />
      <Toolbar />
      <Inspector />

      {workspace.loading && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-0)]">
          <div className="flex flex-col items-center gap-3 text-[var(--ink-muted)]">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--accent)]" />
            <p className="text-sm">Opening your workspace…</p>
          </div>
        </div>
      )}

      {!workspace.loading && workspace.nodes.length === 0 && workspace.groups.length === 0 && (
        <EmptyCanvasHint />
      )}
    </div>
  );
}

function EmptyCanvasHint() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
      <div className="pvw-fade-in max-w-sm rounded-3xl border border-dashed border-[var(--border-strong)] px-8 py-10 text-center">
        <div className="mb-3 text-3xl">✦</div>
        <h2 className="mb-1 text-lg font-semibold text-[var(--ink)]">An empty canvas</h2>
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
          Press <kbd className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs">New</kbd> in the
          toolbar above, or double-click anywhere to drop your first idea.
        </p>
      </div>
    </div>
  );
}
