export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rectsIntersect(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function pointInRect(px: number, py: number, rect: Rect) {
  return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
}

export function rectCenter(rect: Rect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export const MIN_SCALE = 0.15;
export const MAX_SCALE = 2.5;

export const NODE_COLORS = ["neutral", "amber", "rose", "violet", "sky", "emerald", "slate"] as const;
