"use client";

import type { Stroke } from "@/lib/game/types";

/**
 * Turns the live strokes into the 28x28 input the classifier was trained on.
 *
 * Quick, Draw! bitmaps are the drawing cropped to its ink, scaled to fill the
 * box with a small margin, and rendered white-on-black. Feeding the model
 * anything else — the raw canvas, or the drawing at its original scale —
 * changes the input distribution enough to make the output noise, so this
 * mirrors that pipeline exactly.
 *
 * The strokes are re-rendered into a 28x28 offscreen canvas rather than read
 * back from the visible one: reading a 960x640 canvas is about 2.5 MB of pixel
 * copying per sample, while this is 784 pixels and needs no readback of the
 * board the player is actually drawing on.
 */

/** Quick, Draw! leaves roughly a pixel of air around the ink. */
const MARGIN = 1;

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boundsOf(strokes: readonly Stroke[]): Bounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stroke of strokes) {
    if (stroke.erase || stroke.kind === "fill") continue;
    for (const point of stroke.points) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }
  return Number.isFinite(minX) && maxX > minX - 1 && maxY > minY - 1
    ? { minX, minY, maxX, maxY }
    : null;
}

/**
 * Returns the model input, or null when there is not enough ink to judge —
 * a single dot says nothing and would only produce a confident wrong answer.
 */
export function strokesToInput(
  strokes: readonly Stroke[],
  size: number,
  scratch: HTMLCanvasElement,
): Float32Array | null {
  const drawable = strokes.filter((stroke) => !stroke.erase && stroke.kind !== "fill");
  const points = drawable.reduce((total, stroke) => total + stroke.points.length, 0);
  if (drawable.length === 0 || points < 8) return null;

  const bounds = boundsOf(drawable);
  if (!bounds) return null;

  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  const inner = size - MARGIN * 2;
  // One scale for both axes, so a tall drawing is not squashed into a square.
  const scale = inner / Math.max(width, height);
  const offsetX = MARGIN + (inner - width * scale) / 2;
  const offsetY = MARGIN + (inner - height * scale) / 2;

  scratch.width = size;
  scratch.height = size;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // The dataset's strokes are a consistent weight whatever the source brush,
  // so line width is fixed here rather than scaled from the player's tool.
  ctx.lineWidth = Math.max(1.4, size / 16);

  const px = (x: number) => offsetX + (x - bounds.minX) * scale;
  const py = (y: number) => offsetY + (y - bounds.minY) * scale;

  for (const stroke of drawable) {
    const [first, ...rest] = stroke.points;
    if (!first) continue;
    ctx.beginPath();

    if (stroke.kind === "rect" && rest.length) {
      const last = rest[rest.length - 1];
      ctx.rect(px(first.x), py(first.y), px(last.x) - px(first.x), py(last.y) - py(first.y));
    } else if (stroke.kind === "circle" && rest.length) {
      const last = rest[rest.length - 1];
      const cx = (px(first.x) + px(last.x)) / 2;
      const cy = (py(first.y) + py(last.y)) / 2;
      ctx.ellipse(cx, cy, Math.abs(px(last.x) - cx), Math.abs(py(last.y) - cy), 0, 0, Math.PI * 2);
    } else {
      ctx.moveTo(px(first.x), py(first.y));
      for (const point of rest) ctx.lineTo(px(point.x), py(point.y));
      if (rest.length === 0) ctx.lineTo(px(first.x) + 0.6, py(first.y) + 0.6);
    }
    ctx.stroke();
  }

  const { data } = ctx.getImageData(0, 0, size, size);
  const input = new Float32Array(size * size);
  // Ink is high and background zero, matching the dataset's polarity. Red alone
  // is enough: everything drawn here is greyscale.
  for (let i = 0; i < input.length; i += 1) input[i] = data[i * 4] / 255;
  return input;
}
