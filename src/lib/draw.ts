import type { Stroke, StrokePoint } from "@/lib/game/types";

export const CANVAS_W = 960;
export const CANVAS_H = 640;

export const PALETTE = [
  "#111827", "#ffffff", "#ef4444", "#f97316", "#facc15", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#a16207", "#94a3b8",
];

export const BRUSH_SIZES = [3, 6, 12, 24, 40];

export function canvasBackground(): string {
  return "#ffffff";
}

function drawPath(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = stroke.points;
  if (!pts.length) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.size;
  ctx.strokeStyle = stroke.erase ? canvasBackground() : stroke.color;
  ctx.beginPath();
  if (pts.length === 1) {
    // A tap should leave a dot, not nothing.
    ctx.arc(pts[0].x, pts[0].y, Math.max(0.5, stroke.size / 2), 0, Math.PI * 2);
    ctx.fillStyle = stroke.erase ? canvasBackground() : stroke.color;
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mid.x, mid.y);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const [a, b] = stroke.points;
  if (!a || !b) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = stroke.size;
  ctx.strokeStyle = stroke.erase ? canvasBackground() : stroke.color;
  ctx.beginPath();
  if (stroke.kind === "line") {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  } else if (stroke.kind === "rect") {
    ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  } else {
    const rx = Math.abs(b.x - a.x) / 2;
    const ry = Math.abs(b.y - a.y) / 2;
    ctx.ellipse(Math.min(a.x, b.x) + rx, Math.min(a.y, b.y) + ry, rx, ry, 0, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.restore();
}

function hexToRgba(hex: string): [number, number, number, number] {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
    255,
  ];
}

/** Scanline flood fill — the bucket tool, replayed the same way on every client. */
export function floodFill(ctx: CanvasRenderingContext2D, seed: StrokePoint, color: string) {
  const { width, height } = ctx.canvas;
  const x0 = Math.round(seed.x);
  const y0 = Math.round(seed.y);
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return;

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const at = (x: number, y: number) => (y * width + x) * 4;
  const start = at(x0, y0);
  const target = [data[start], data[start + 1], data[start + 2], data[start + 3]];
  const fill = hexToRgba(color);
  if (target.every((c, i) => c === fill[i])) return;

  const tolerance = 32;
  const matches = (idx: number) =>
    Math.abs(data[idx] - target[0]) <= tolerance &&
    Math.abs(data[idx + 1] - target[1]) <= tolerance &&
    Math.abs(data[idx + 2] - target[2]) <= tolerance &&
    Math.abs(data[idx + 3] - target[3]) <= tolerance;

  const stack: [number, number][] = [[x0, y0]];
  while (stack.length) {
    const [sx, sy] = stack.pop()!;
    let x = sx;
    while (x >= 0 && matches(at(x, sy))) x--;
    x++;
    let spanUp = false;
    let spanDown = false;
    while (x < width && matches(at(x, sy))) {
      const idx = at(x, sy);
      data[idx] = fill[0];
      data[idx + 1] = fill[1];
      data[idx + 2] = fill[2];
      data[idx + 3] = fill[3];
      if (sy > 0) {
        const up = matches(at(x, sy - 1));
        if (up && !spanUp) { stack.push([x, sy - 1]); spanUp = true; }
        else if (!up) spanUp = false;
      }
      if (sy < height - 1) {
        const down = matches(at(x, sy + 1));
        if (down && !spanDown) { stack.push([x, sy + 1]); spanDown = true; }
        else if (!down) spanDown = false;
      }
      x++;
    }
  }
  ctx.putImageData(image, 0, 0);
}

export function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.kind === "fill") {
    if (stroke.points[0]) floodFill(ctx, stroke.points[0], stroke.erase ? canvasBackground() : stroke.color);
    return;
  }
  if (stroke.kind === "free") drawPath(ctx, stroke);
  else drawShape(ctx, stroke);
}

/** Repaint the whole board. `upTo` drives the stroke-by-stroke replay. */
export function renderAll(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[], upTo = strokes.length) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = canvasBackground();
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  for (let i = 0; i < Math.min(upTo, strokes.length); i++) renderStroke(ctx, strokes[i]);
}
