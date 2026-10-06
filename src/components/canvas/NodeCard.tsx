"use client";

import { memo } from "react";
import clsx from "clsx";
import type { Attachment, GraphNode } from "@/types/graph";
import { NODE_TYPES } from "@/types/graph";

interface NodeCardProps {
  node: GraphNode;
  attachments: Attachment[];
  selected: boolean;
  scale: number;
  connectionCount: number;
  onPointerDownBody: (event: React.PointerEvent) => void;
  onPointerDownResize: (event: React.PointerEvent) => void;
  onPointerDownConnector: (event: React.PointerEvent, edge: "top" | "right" | "bottom" | "left") => void;
  onClick: (event: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

const EDGES: Array<"top" | "right" | "bottom" | "left"> = ["top", "right", "bottom", "left"];

const edgeStyle: Record<string, React.CSSProperties> = {
  top: { top: -6, left: "50%", transform: "translateX(-50%)" },
  bottom: { bottom: -6, left: "50%", transform: "translateX(-50%)" },
  left: { left: -6, top: "50%", transform: "translateY(-50%)" },
  right: { right: -6, top: "50%", transform: "translateY(-50%)" },
};

function plainPreview(markdown: string) {
  return markdown
    .replace(/[#>*_`~-]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export const NodeCard = memo(function NodeCard({
  node,
  attachments,
  selected,
  scale,
  connectionCount,
  onPointerDownBody,
  onPointerDownResize,
  onPointerDownConnector,
  onClick,
  onDoubleClick,
}: NodeCardProps) {
  const typeMeta = NODE_TYPES.find((t) => t.value === node.type) ?? NODE_TYPES[0];
  const coverImage = attachments.find((a) => a.kind === "image");
  const imageCount = attachments.filter((a) => a.kind === "image").length;
  const fileCount = attachments.filter((a) => a.kind === "file").length;
  const audioCount = attachments.filter((a) => a.kind === "audio").length;
  const linkCount = attachments.filter((a) => a.kind === "link").length;
  const isOverview = scale < 0.38;
  const preview = plainPreview(node.content);

  return (
    <div
      className={clsx(
        "pvw-node group absolute flex select-none flex-col overflow-hidden rounded-2xl border bg-[var(--surface-2)] transition-shadow",
        `node-color-${node.color}`,
        selected
          ? "border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft),var(--shadow-elevated)]"
          : "border-[var(--border)] shadow-[var(--shadow-soft)] hover:border-[var(--border-strong)]",
      )}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
      onPointerDown={onPointerDownBody}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      data-node-id={node.id}
    >
      {coverImage && !isOverview ? (
        <div className="relative h-[46%] w-full shrink-0 overflow-hidden bg-[var(--surface-3)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverImage.url} alt="" className="h-full w-full object-cover" draggable={false} />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-3.5 py-3">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]"
            style={{ background: "var(--node-accent)", color: "var(--surface-0)" }}
          >
            {typeMeta.icon}
          </span>
          <span className="truncate text-[10px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
            {typeMeta.label}
          </span>
        </div>

        <h3
          className={clsx(
            "truncate font-semibold leading-snug text-[var(--ink)]",
            isOverview ? "text-[13px]" : "text-[15px]",
          )}
        >
          {node.title || "Untitled"}
        </h3>

        {!isOverview && preview ? (
          <p className="line-clamp-3 flex-1 text-[12.5px] leading-relaxed text-[var(--ink-muted)]">
            {preview}
          </p>
        ) : null}

        {!isOverview && (imageCount || fileCount || audioCount || linkCount || connectionCount) ? (
          <div className="mt-auto flex flex-wrap gap-2 pt-1 text-[10.5px] text-[var(--ink-faint)]">
            {imageCount > 0 && <span>🖼 {imageCount}</span>}
            {fileCount > 0 && <span>📄 {fileCount}</span>}
            {audioCount > 0 && <span>🎙 {audioCount}</span>}
            {linkCount > 0 && <span>🔗 {linkCount}</span>}
            {connectionCount > 0 && <span>⤳ {connectionCount}</span>}
          </div>
        ) : null}
      </div>

      {EDGES.map((edge) => (
        <button
          key={edge}
          type="button"
          aria-label={`Connect from ${edge}`}
          className="absolute z-10 hidden h-3 w-3 rounded-full border border-[var(--surface-0)] bg-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100 md:block"
          style={edgeStyle[edge]}
          onPointerDown={(e) => {
            e.stopPropagation();
            onPointerDownConnector(e, edge);
          }}
        />
      ))}

      <div
        className="absolute bottom-0.5 right-0.5 h-4 w-4 cursor-se-resize opacity-0 transition-opacity group-hover:opacity-100"
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDownResize(e);
        }}
      >
        <svg viewBox="0 0 16 16" className="h-full w-full text-[var(--ink-faint)]">
          <path d="M14 2 L2 14 M14 8 L8 14" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </div>
    </div>
  );
});
