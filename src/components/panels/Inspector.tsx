"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useWorkspace } from "@/state/workspace-provider";
import { useCanvasUI } from "@/state/canvas-ui-provider";
import { NODE_COLORS } from "@/lib/geometry";
import { NODE_TYPES } from "@/types/graph";
import type { NodeColor, NodeType } from "@/types/graph";
import { AudioRecorderControl } from "./AudioRecorderControl";

type Tab = "content" | "media" | "links" | "metadata" | "connections";

export function Inspector() {
  const workspace = useWorkspace();
  const ui = useCanvasUI();
  const [tab, setTab] = useState<Tab>("content");
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(ui.inspectorWidth);

  const selectedNode =
    ui.selection.kind === "node" && ui.selection.nodeIds.length === 1
      ? workspace.nodes.find((n) => n.id === ui.selection.nodeIds[0])
      : null;
  const multiNodes =
    ui.selection.kind === "node" && ui.selection.nodeIds.length > 1
      ? workspace.nodes.filter((n) => ui.selection.nodeIds.includes(n.id))
      : [];
  const selectedGroup =
    ui.selection.kind === "group" ? workspace.groups.find((g) => g.id === ui.selection.groupId) : null;
  const selectedConnection =
    ui.selection.kind === "connection"
      ? workspace.connections.find((c) => c.id === ui.selection.connectionId)
      : null;

  const hasSelection = Boolean(selectedNode || multiNodes.length || selectedGroup || selectedConnection);

  useEffect(() => {
    if (hasSelection) ui.setInspectorOpen(true);
  }, [hasSelection, ui]);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!resizing) return;
      const next = clamp(window.innerWidth - e.clientX, 300, 620);
      widthRef.current = next;
      ui.setInspectorWidth(next);
    }
    function onUp() {
      setResizing(false);
    }
    if (resizing) {
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizing, ui]);

  if (!ui.inspectorOpen) {
    return (
      <button
        type="button"
        onClick={() => ui.setInspectorOpen(true)}
        className="pvw-fade-in fixed right-4 top-1/2 z-30 flex -translate-y-1/2 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-3 text-[var(--ink-muted)] shadow-[var(--shadow-soft)] transition hover:text-[var(--ink)]"
        aria-label="Open inspector"
      >
        <ChevronIcon direction="left" />
      </button>
    );
  }

  return (
    <aside
      className="pvw-fade-in fixed right-0 top-0 z-30 flex h-dvh flex-col border-l border-[var(--border)] bg-[var(--surface-1)] shadow-[var(--shadow-elevated)]"
      style={{ width: ui.inspectorCollapsed ? 56 : ui.inspectorWidth }}
    >
      <div
        className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-[var(--accent-soft)]"
        onPointerDown={(e) => {
          e.preventDefault();
          setResizing(true);
        }}
      />

      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        {!ui.inspectorCollapsed && <span className="text-xs font-medium uppercase tracking-wide text-[var(--ink-faint)]">Inspector</span>}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--ink-faint)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
            onClick={() => ui.setInspectorCollapsed(!ui.inspectorCollapsed)}
            aria-label="Collapse"
          >
            <ChevronIcon direction={ui.inspectorCollapsed ? "left" : "right"} />
          </button>
          {!ui.inspectorCollapsed && (
            <button
              type="button"
              className="rounded-lg p-1.5 text-[var(--ink-faint)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
              onClick={() => {
                ui.setInspectorOpen(false);
                ui.clearSelection();
              }}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {ui.inspectorCollapsed ? null : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedNode && (
            <NodeInspector node={selectedNode} tab={tab} setTab={setTab} />
          )}
          {multiNodes.length > 0 && <MultiSelectionPanel nodes={multiNodes} />}
          {selectedGroup && <GroupInspector groupId={selectedGroup.id} />}
          {selectedConnection && <ConnectionInspector connectionId={selectedConnection.id} />}
          {!hasSelection && <EmptyInspector />}
        </div>
      )}
    </aside>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path
        d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmptyInspector() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-20 text-center text-[var(--ink-faint)]">
      <div className="text-3xl">✦</div>
      <p className="text-sm">Select a node, group or connection to see its details here.</p>
    </div>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "media", label: "Media" },
  { id: "links", label: "Links" },
  { id: "metadata", label: "Metadata" },
  { id: "connections", label: "Connections" },
];

function NodeInspector({
  node,
  tab,
  setTab,
}: {
  node: ReturnType<typeof useWorkspace>["nodes"][number];
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const workspace = useWorkspace();
  const [title, setTitle] = useState(node.title);
  const [content, setContent] = useState(node.content);
  const [previewMarkdown, setPreviewMarkdown] = useState(true);

  useEffect(() => {
    setTitle(node.title);
    setContent(node.content);
  }, [node.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const attachments = workspace.attachmentsForNode(node.id);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b border-[var(--border)] px-4 py-4">
        <div className="flex items-center gap-2">
          <select
            value={node.type}
            onChange={(e) => workspace.updateNode(node.id, { type: e.target.value as NodeType })}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          >
            {NODE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-1">
            {NODE_COLORS.map((c) => (
              <button
                key={c}
                aria-label={c}
                className={clsx(
                  "h-5 w-5 rounded-full border-2 transition",
                  node.color === c ? "border-[var(--accent)]" : "border-transparent",
                )}
                style={{ background: `var(--node-${c})` }}
                onClick={() => workspace.updateNode(node.id, { color: c as NodeColor })}
              />
            ))}
          </div>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => workspace.updateNode(node.id, { title })}
          placeholder="Untitled"
          className="w-full bg-transparent text-lg font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
        />
        <p className="text-[11px] text-[var(--ink-faint)]">
          Updated {new Date(node.updatedAt).toLocaleString()}
        </p>

        <button
          type="button"
          onClick={() => {
            if (confirm("Delete this node? This cannot be undone.")) workspace.deleteNode(node.id);
          }}
          className="text-xs font-medium text-[var(--danger)] hover:underline"
        >
          Delete node
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-3 py-2 no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
              tab === t.id
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]",
            )}
          >
            {t.label}
            {t.id === "media" && attachments.filter((a) => a.kind !== "link").length > 0
              ? ` · ${attachments.filter((a) => a.kind !== "link").length}`
              : ""}
            {t.id === "links" && attachments.filter((a) => a.kind === "link").length > 0
              ? ` · ${attachments.filter((a) => a.kind === "link").length}`
              : ""}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {tab === "content" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--ink-faint)]">
                Markdown supported
              </span>
              <button
                className="text-xs text-[var(--accent)] hover:underline"
                onClick={() => setPreviewMarkdown((v) => !v)}
              >
                {previewMarkdown ? "Edit" : "Preview"}
              </button>
            </div>
            {previewMarkdown ? (
              <div
                className="markdown-body min-h-[200px] rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-sm text-[var(--ink)]"
                onClick={() => setPreviewMarkdown(false)}
              >
                {content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                ) : (
                  <span className="text-[var(--ink-faint)]">Click to add content…</span>
                )}
              </div>
            ) : (
              <textarea
                autoFocus
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onBlur={() => {
                  workspace.updateNode(node.id, { content });
                  setPreviewMarkdown(true);
                }}
                rows={12}
                placeholder="Write freely — headings, lists, links…"
                className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
            )}
          </div>
        )}

        {tab === "media" && <MediaTab nodeId={node.id} attachments={attachments.filter((a) => a.kind !== "link")} />}
        {tab === "links" && <LinksTab nodeId={node.id} attachments={attachments.filter((a) => a.kind === "link")} />}
        {tab === "metadata" && <MetadataTab nodeId={node.id} metadata={node.metadata} />}
        {tab === "connections" && <ConnectionsTab nodeId={node.id} />}
      </div>
    </div>
  );
}

function MediaTab({ nodeId, attachments }: { nodeId: string; attachments: ReturnType<typeof useWorkspace>["attachments"] }) {
  const workspace = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const images = attachments.filter((a) => a.kind === "image");
  const files = attachments.filter((a) => a.kind === "file");
  const audio = attachments.filter((a) => a.kind === "audio");

  return (
    <div className="space-y-6">
      <section>
        <header className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">Images</h4>
          <label className="cursor-pointer text-xs text-[var(--accent)] hover:underline">
            + Add
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const list = Array.from(e.target.files ?? []);
                for (const file of list) await workspace.uploadAttachment(nodeId, "image", file);
                e.target.value = "";
              }}
            />
          </label>
        </header>
        {images.length === 0 ? (
          <EmptyHint text="No images yet." />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img) => (
              <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                <button
                  onClick={() => workspace.removeAttachment(img.id)}
                  className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white group-hover:flex"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <header className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">Files & Documents</h4>
          <label className="cursor-pointer text-xs text-[var(--accent)] hover:underline">
            + Add
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={async (e) => {
                const list = Array.from(e.target.files ?? []);
                for (const file of list) await workspace.uploadAttachment(nodeId, "file", file);
                e.target.value = "";
              }}
            />
          </label>
        </header>
        {files.length === 0 ? (
          <EmptyHint text="No files yet." />
        ) : (
          <ul className="space-y-1.5">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs"
              >
                <span>📄</span>
                <a href={f.url} target="_blank" rel="noreferrer" className="truncate text-[var(--ink)] hover:underline">
                  {f.name}
                </a>
                <button onClick={() => workspace.removeAttachment(f.id)} className="ml-auto text-[var(--ink-faint)] hover:text-[var(--danger)]">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <header className="mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">Audio</h4>
        </header>
        <AudioRecorderControl nodeId={nodeId} />
        {audio.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {audio.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                <audio controls src={a.url} className="h-8 flex-1" />
                <button onClick={() => workspace.removeAttachment(a.id)} className="text-[var(--ink-faint)] hover:text-[var(--danger)]">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LinksTab({ nodeId, attachments }: { nodeId: string; attachments: ReturnType<typeof useWorkspace>["attachments"] }) {
  const workspace = useWorkspace();
  const [url, setUrl] = useState("");

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!url.trim()) return;
          await workspace.addLinkAttachment(nodeId, url.trim());
          setUrl("");
        }}
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button type="submit" className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-ink)]">
          Add
        </button>
      </form>
      {attachments.length === 0 ? (
        <EmptyHint text="No links yet." />
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs">
              <span>🔗</span>
              <a href={l.url} target="_blank" rel="noreferrer" className="truncate text-[var(--accent)] hover:underline">
                {l.name || l.url}
              </a>
              <button onClick={() => workspace.removeAttachment(l.id)} className="ml-auto text-[var(--ink-faint)] hover:text-[var(--danger)]">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MetadataTab({ nodeId, metadata }: { nodeId: string; metadata: Record<string, string> }) {
  const workspace = useWorkspace();
  const entries = useMemo(() => Object.entries(metadata ?? {}), [metadata]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {entries.length === 0 && <EmptyHint text="No custom properties yet." />}
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs">
            <span className="font-medium text-[var(--ink)]">{k}</span>
            <span className="truncate text-[var(--ink-muted)]">{v}</span>
            <button
              className="ml-auto text-[var(--ink-faint)] hover:text-[var(--danger)]"
              onClick={() => {
                const next = { ...metadata };
                delete next[k];
                workspace.updateNode(nodeId, { metadata: next });
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!key.trim()) return;
          workspace.updateNode(nodeId, { metadata: { ...metadata, [key.trim()]: value } });
          setKey("");
          setValue("");
        }}
      >
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Key"
          className="w-24 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-2 text-xs outline-none focus:border-[var(--accent)]"
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-2 text-xs outline-none focus:border-[var(--accent)]"
        />
        <button type="submit" className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-ink)]">
          Add
        </button>
      </form>
    </div>
  );
}

function ConnectionsTab({ nodeId }: { nodeId: string }) {
  const workspace = useWorkspace();
  const ui = useCanvasUI();
  const related = workspace.connections.filter((c) => c.sourceId === nodeId || c.targetId === nodeId);
  const [targetId, setTargetId] = useState("");

  const candidates = workspace.nodes.filter(
    (n) => n.id !== nodeId && !related.some((c) => c.sourceId === n.id || c.targetId === n.id),
  );

  return (
    <div className="space-y-3">
      {related.length === 0 ? (
        <EmptyHint text="No connections yet." />
      ) : (
        <ul className="space-y-1.5">
          {related.map((c) => {
            const otherId = c.sourceId === nodeId ? c.targetId : c.sourceId;
            const other = workspace.nodes.find((n) => n.id === otherId);
            return (
              <li key={c.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs">
                <span>⤳</span>
                <button className="truncate text-[var(--ink)] hover:underline" onClick={() => ui.focusNode(otherId)}>
                  {other?.title || "Untitled"}
                </button>
                <button onClick={() => workspace.deleteConnection(c.id)} className="ml-auto text-[var(--ink-faint)] hover:text-[var(--danger)]">
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {candidates.length > 0 && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!targetId) return;
            workspace.createConnection(nodeId, targetId);
            setTargetId("");
          }}
        >
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-2 text-xs outline-none focus:border-[var(--accent)]"
          >
            <option value="">Connect to…</option>
            {candidates.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title || "Untitled"}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-ink)]">
            Link
          </button>
        </form>
      )}
    </div>
  );
}

function MultiSelectionPanel({ nodes }: { nodes: ReturnType<typeof useWorkspace>["nodes"] }) {
  const workspace = useWorkspace();
  const ui = useCanvasUI();
  const [groupTitle, setGroupTitle] = useState("New Group");

  return (
    <div className="space-y-4 p-4">
      <p className="text-sm text-[var(--ink)]">{nodes.length} nodes selected</p>
      <div className="flex flex-wrap gap-2">
        {NODE_COLORS.map((c) => (
          <button
            key={c}
            className="h-6 w-6 rounded-full border border-[var(--border)]"
            style={{ background: `var(--node-${c})` }}
            onClick={() => nodes.forEach((n) => workspace.updateNode(n.id, { color: c as NodeColor }))}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={groupTitle}
          onChange={(e) => setGroupTitle(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button
          className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-ink)]"
          onClick={() => {
            const minX = Math.min(...nodes.map((n) => n.x)) - 48;
            const minY = Math.min(...nodes.map((n) => n.y)) - 72;
            const maxX = Math.max(...nodes.map((n) => n.x + n.width)) + 48;
            const maxY = Math.max(...nodes.map((n) => n.y + n.height)) + 48;
            const group = workspace.createGroup({
              title: groupTitle,
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            });
            nodes.forEach((n) => workspace.updateNode(n.id, { groupId: group.id }));
            ui.selectGroup(group.id);
          }}
        >
          Group
        </button>
      </div>
      <button
        className="text-xs font-medium text-[var(--danger)] hover:underline"
        onClick={() => {
          if (confirm(`Delete ${nodes.length} nodes?`)) {
            nodes.forEach((n) => workspace.deleteNode(n.id));
            ui.clearSelection();
          }
        }}
      >
        Delete all selected
      </button>
    </div>
  );
}

function GroupInspector({ groupId }: { groupId: string }) {
  const workspace = useWorkspace();
  const ui = useCanvasUI();
  const group = workspace.groups.find((g) => g.id === groupId);
  const [title, setTitle] = useState(group?.title ?? "");
  const members = workspace.nodes.filter((n) => n.groupId === groupId);

  useEffect(() => setTitle(group?.title ?? ""), [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!group) return null;

  return (
    <div className="space-y-4 p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => workspace.updateGroup(groupId, { title })}
        className="w-full bg-transparent text-lg font-semibold text-[var(--ink)] outline-none"
      />
      <div className="flex flex-wrap gap-2">
        {NODE_COLORS.map((c) => (
          <button
            key={c}
            className={clsx("h-6 w-6 rounded-full border-2", group.color === c ? "border-[var(--accent)]" : "border-transparent")}
            style={{ background: `var(--node-${c})` }}
            onClick={() => workspace.updateGroup(groupId, { color: c as NodeColor })}
          />
        ))}
      </div>
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
          Members ({members.length})
        </h4>
        {members.length === 0 ? (
          <EmptyHint text="Drag nodes onto this group to add them." />
        ) : (
          <ul className="space-y-1.5">
            {members.map((n) => (
              <li key={n.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs">
                <button className="truncate text-[var(--ink)] hover:underline" onClick={() => ui.focusNode(n.id)}>
                  {n.title || "Untitled"}
                </button>
                <button
                  className="ml-auto text-[var(--ink-faint)] hover:text-[var(--danger)]"
                  onClick={() => workspace.updateNode(n.id, { groupId: null })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        className="text-xs font-medium text-[var(--danger)] hover:underline"
        onClick={() => {
          if (confirm("Delete this group? Nodes inside will not be deleted.")) {
            workspace.deleteGroup(groupId);
            ui.clearSelection();
          }
        }}
      >
        Delete group
      </button>
    </div>
  );
}

function ConnectionInspector({ connectionId }: { connectionId: string }) {
  const workspace = useWorkspace();
  const ui = useCanvasUI();
  const connection = workspace.connections.find((c) => c.id === connectionId);
  const [label, setLabel] = useState(connection?.label ?? "");

  useEffect(() => setLabel(connection?.label ?? ""), [connectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!connection) return null;
  const source = workspace.nodes.find((n) => n.id === connection.sourceId);
  const target = workspace.nodes.find((n) => n.id === connection.targetId);

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-semibold text-[var(--ink)]">Connection</h3>
      <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
        <button className="truncate rounded-full bg-[var(--surface-2)] px-2.5 py-1 hover:underline" onClick={() => ui.focusNode(source?.id ?? "")}>
          {source?.title || "Untitled"}
        </button>
        <span>→</span>
        <button className="truncate rounded-full bg-[var(--surface-2)] px-2.5 py-1 hover:underline" onClick={() => ui.focusNode(target?.id ?? "")}>
          {target?.title || "Untitled"}
        </button>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--ink-faint)]">Label (optional)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => workspace.updateConnection(connectionId, { label })}
          placeholder="e.g. depends on, supports…"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
        <input
          type="checkbox"
          checked={Boolean(connection.style?.dashed)}
          onChange={(e) =>
            workspace.updateConnection(connectionId, { style: { ...connection.style, dashed: e.target.checked } })
          }
        />
        Dashed line
      </label>
      <button
        className="text-xs font-medium text-[var(--danger)] hover:underline"
        onClick={() => {
          workspace.deleteConnection(connectionId);
          ui.clearSelection();
        }}
      >
        Delete connection
      </button>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-3 text-xs text-[var(--ink-faint)]">{text}</p>;
}
