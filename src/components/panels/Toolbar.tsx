"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useWorkspace } from "@/state/workspace-provider";
import { useCanvasUI } from "@/state/canvas-ui-provider";
import { useTheme } from "@/state/theme-provider";
import { NODE_TYPES } from "@/types/graph";
import { fitViewport } from "@/lib/viewport";
import { clamp, MAX_SCALE, MIN_SCALE } from "@/lib/geometry";
import { SearchPalette } from "./SearchPalette";

export function Toolbar() {
  const workspace = useWorkspace();
  const ui = useCanvasUI();
  const theme = useTheme();
  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function createNode(type: (typeof NODE_TYPES)[number]["value"]) {
    const { width, height } = ui.containerSize;
    const centerWorld = {
      x: (width / 2 - ui.viewport.x) / ui.viewport.scale - 140,
      y: (height / 2 - ui.viewport.y) / ui.viewport.scale - 95,
    };
    const jitter = () => (Math.random() - 0.5) * 60;
    const node = workspace.createNode({
      type,
      title: "",
      x: centerWorld.x + jitter(),
      y: centerWorld.y + jitter(),
    });
    ui.focusNode(node.id);
    setCreateOpen(false);
  }

  function zoomBy(factor: number) {
    ui.setViewport((prev) => {
      const nextScale = clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE);
      const ratio = nextScale / prev.scale;
      const cx = ui.containerSize.width / 2;
      const cy = ui.containerSize.height / 2;
      return { scale: nextScale, x: cx - (cx - prev.x) * ratio, y: cy - (cy - prev.y) * ratio };
    });
  }

  function fitToContent() {
    const rects = [
      ...workspace.nodes.map((n) => ({ x: n.x, y: n.y, width: n.width, height: n.height })),
      ...workspace.groups.map((g) => ({ x: g.x, y: g.y, width: g.width, height: g.height })),
    ];
    ui.setViewport(fitViewport(rects, ui.containerSize.width, ui.containerSize.height));
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-4 z-20 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-1)]/95 px-2 py-2 shadow-[var(--shadow-soft)] backdrop-blur">
          <ToolbarButton label="New" primary onClick={() => setCreateOpen((v) => !v)}>
            <PlusIcon />
          </ToolbarButton>

          <Divider />

          <ToolbarButton label="Search" onClick={() => setSearchOpen(true)}>
            <SearchIcon />
          </ToolbarButton>

          {expanded && (
            <>
              <Divider />
              <ToolbarButton label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
                <MinusIcon />
              </ToolbarButton>
              <span className="w-10 text-center text-xs tabular-nums text-[var(--ink-muted)]">
                {Math.round(ui.viewport.scale * 100)}%
              </span>
              <ToolbarButton label="Zoom in" onClick={() => zoomBy(1.2)}>
                <PlusIcon small />
              </ToolbarButton>
              <ToolbarButton label="Fit to content" onClick={fitToContent}>
                <FitIcon />
              </ToolbarButton>

              <Divider />

              <ToolbarButton
                label="Group selected nodes"
                disabled={ui.selection.nodeIds.length < 2}
                onClick={() => {
                  const selected = workspace.nodes.filter((n) => ui.selection.nodeIds.includes(n.id));
                  if (selected.length < 2) return;
                  const minX = Math.min(...selected.map((n) => n.x)) - 48;
                  const minY = Math.min(...selected.map((n) => n.y)) - 72;
                  const maxX = Math.max(...selected.map((n) => n.x + n.width)) + 48;
                  const maxY = Math.max(...selected.map((n) => n.y + n.height)) + 48;
                  const group = workspace.createGroup({
                    title: "New Group",
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY,
                  });
                  selected.forEach((n) => workspace.updateNode(n.id, { groupId: group.id }));
                  ui.selectGroup(group.id);
                }}
              >
                <GroupIcon />
              </ToolbarButton>

              <Divider />

              <ToolbarButton
                label={theme.resolved === "dark" ? "Switch to light" : "Switch to dark"}
                onClick={() => theme.setMode(theme.resolved === "dark" ? "light" : "dark")}
              >
                {theme.resolved === "dark" ? <SunIcon /> : <MoonIcon />}
              </ToolbarButton>
            </>
          )}

          <Divider />
          <ToolbarButton label={expanded ? "Collapse toolbar" : "Expand toolbar"} onClick={() => setExpanded((v) => !v)}>
            <ChevronDown flipped={expanded} />
          </ToolbarButton>
        </div>
      </div>

      {createOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setCreateOpen(false)} />
          <div className="pvw-pop fixed left-1/2 top-[72px] z-30 w-[320px] -translate-x-1/2 rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-2 shadow-[var(--shadow-elevated)]">
            <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-[var(--ink-faint)]">
              Create a node
            </p>
            <div className="grid grid-cols-2 gap-1.5 p-1">
              {NODE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => createNode(t.value)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[var(--ink)] transition hover:bg-[var(--surface-hover)]"
                >
                  <span className="text-base">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <SyncBadge />

      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
    </>
  );
}

function SyncBadge() {
  const workspace = useWorkspace();

  if (workspace.online && workspace.pendingCount === 0 && !workspace.loadError) return null;

  return (
    <div className="pvw-fade-in fixed bottom-4 left-1/2 z-20 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-4 py-2 text-xs text-[var(--ink-muted)] shadow-[var(--shadow-soft)]">
        <span className={clsx("h-2 w-2 rounded-full", workspace.online ? "bg-[var(--success)]" : "bg-[var(--danger)]")} />
        {!workspace.online && <span>You&apos;re offline — changes are saved locally.</span>}
        {workspace.online && workspace.pendingCount > 0 && (
          <span>{workspace.pendingCount} change{workspace.pendingCount > 1 ? "s" : ""} waiting to sync.</span>
        )}
        {workspace.pendingCount > 0 && workspace.online && (
          <button
            className="rounded-full bg-[var(--accent)] px-2.5 py-1 font-medium text-[var(--accent-ink)] disabled:opacity-60"
            disabled={workspace.syncing}
            onClick={() => workspace.reviewSync()}
          >
            {workspace.syncing ? "Syncing…" : "Review & Sync"}
          </button>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "flex h-9 w-9 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-40",
        primary
          ? "bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90"
          : "text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-[var(--border)]" />;
}

function PlusIcon({ small }: { small?: boolean }) {
  return (
    <svg width={small ? 14 : 16} height={small ? 14 : 16} viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
function MinusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth={2} />
      <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
function FitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 4H5v4M15 4h4v4M9 20H5v-4M15 20h4v-4"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function GroupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth={2} />
      <rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth={2} />
      <path d="M11 7h4a2 2 0 012 2v4" stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth={2} />
      <path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}
function ChevronDown({ flipped }: { flipped?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      style={{ transform: flipped ? "rotate(180deg)" : undefined }}
      className="transition-transform"
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
