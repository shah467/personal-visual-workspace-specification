import { clamp, type Rect } from "./geometry";
import type { Viewport } from "@/state/canvas-ui-provider";

export function fitViewport(
  rects: Rect[],
  containerWidth: number,
  containerHeight: number,
  padding = 140,
): Viewport {
  if (rects.length === 0) {
    return { x: containerWidth / 2, y: containerHeight / 2, scale: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }

  const boundsWidth = Math.max(1, maxX - minX);
  const boundsHeight = Math.max(1, maxY - minY);

  const scale = clamp(
    Math.min(
      (containerWidth - padding * 2) / boundsWidth,
      (containerHeight - padding * 2) / boundsHeight,
    ),
    0.15,
    1.1,
  );

  const centerX = minX + boundsWidth / 2;
  const centerY = minY + boundsHeight / 2;

  return {
    x: containerWidth / 2 - centerX * scale,
    y: containerHeight / 2 - centerY * scale,
    scale,
  };
}

export function focusViewport(
  rect: Rect,
  containerWidth: number,
  containerHeight: number,
  currentScale: number,
): Viewport {
  const scale = clamp(Math.max(currentScale, 0.85), 0.15, 2.5);
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  return {
    x: containerWidth / 2 - centerX * scale,
    y: containerHeight / 2 - centerY * scale,
    scale,
  };
}
