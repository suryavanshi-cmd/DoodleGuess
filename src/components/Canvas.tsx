"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BRUSH_SIZES, CANVAS_H, CANVAS_W, PALETTE, canvasBackground, renderAll, renderStroke } from "@/lib/draw";
import type { ShapeKind, Stroke, StrokePoint } from "@/lib/game/types";

type Tool = ShapeKind | "eraser";

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: "free", label: "Brush", icon: "🖌️" },
  { id: "line", label: "Line", icon: "📏" },
  { id: "rect", label: "Rectangle", icon: "▭" },
  { id: "circle", label: "Circle", icon: "⭕" },
  { id: "fill", label: "Fill", icon: "🪣" },
  { id: "eraser", label: "Eraser", icon: "🧽" },
];

/** Undo/redo depth, matching the spec's "last 20 strokes". */
const HISTORY_LIMIT = 20;

export function Canvas({ strokes, canDraw, onStroke, onCanvas }: {
  strokes: Stroke[];
  canDraw: boolean;
  onStroke: (stroke: Stroke, all: Stroke[]) => void;
  onCanvas: (action: "clear" | "undo" | "redo", all: Stroke[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<Tool>("free");
  const [color, setColor] = useState(PALETTE[0]);
  const [size, setSize] = useState(BRUSH_SIZES[1]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);

  const ctx = () => canvasRef.current?.getContext("2d", { willReadFrequently: true }) ?? null;

  const repaint = useCallback((preview?: Stroke | null) => {
    const context = ctx();
    if (!context) return;
    renderAll(context, strokes);
    if (preview) renderStroke(context, preview);
  }, [strokes]);

  useEffect(() => { repaint(); }, [repaint]);

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  };

  const commit = (stroke: Stroke) => {
    const next = [...strokes, stroke];
    setRedoStack([]);
    onStroke(stroke, next);
  };

  const handleDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFrom(event);

    if (tool === "fill") {
      commit({ id: crypto.randomUUID(), kind: "fill", color, size, points: [point] });
      return;
    }
    drawing.current = {
      id: crypto.randomUUID(),
      kind: tool === "eraser" ? "free" : tool,
      color,
      size: tool === "eraser" ? Math.max(size, 16) : size,
      points: [point],
      erase: tool === "eraser",
    };
    repaint(drawing.current);
  };

  const handleMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drawing.current;
    if (!canDraw || !current) return;
    const point = pointFrom(event);
    if (current.kind === "free") current.points.push(point);
    else current.points[1] = point;
    repaint(current);
  };

  const handleUp = () => {
    const current = drawing.current;
    drawing.current = null;
    if (!current) return;
    if (current.kind !== "free" && current.points.length < 2) {
      repaint();
      return;
    }
    commit(current);
  };

  const undo = () => {
    if (!strokes.length) return;
    const next = strokes.slice(0, -1);
    setRedoStack((previous) => [...previous, strokes[strokes.length - 1]].slice(-HISTORY_LIMIT));
    onCanvas("undo", next);
  };

  const redo = () => {
    if (!redoStack.length) return;
    const restored = redoStack[redoStack.length - 1];
    setRedoStack((previous) => previous.slice(0, -1));
    onCanvas("redo", [...strokes, restored]);
  };

  const clear = () => {
    setRedoStack([]);
    onCanvas("clear", []);
  };

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl border border-line shadow-sm" style={{ background: canvasBackground() }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="canvas-surface block w-full"
          style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, cursor: canDraw ? "crosshair" : "default" }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          onPointerLeave={handleUp}
          aria-label={canDraw ? "Drawing canvas" : "The drawing appears here"}
        />
      </div>

      {canDraw ? (
        <div className="card space-y-3 p-3">
          <div className="flex flex-wrap gap-2">
            {TOOLS.map((item) => (
              <button
                key={item.id} type="button" onClick={() => setTool(item.id)}
                aria-pressed={tool === item.id} title={item.label}
                className={`btn min-w-11 px-3 ${tool === item.id ? "bg-brand text-brand-fg" : "border border-line bg-surface-2"}`}
              >
                <span aria-hidden>{item.icon}</span>
                <span className="sr-only">{item.label}</span>
              </button>
            ))}
            <span className="ml-auto flex gap-2">
              <button type="button" className="btn-ghost px-3" onClick={undo} disabled={!strokes.length} title="Undo">↩️</button>
              <button type="button" className="btn-ghost px-3" onClick={redo} disabled={!redoStack.length} title="Redo">↪️</button>
              <button type="button" className="btn-ghost px-3" onClick={clear} title="Clear the canvas">🗑️</button>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PALETTE.map((swatch) => (
              <button
                key={swatch} type="button" onClick={() => { setColor(swatch); if (tool === "eraser") setTool("free"); }}
                aria-label={`Colour ${swatch}`} aria-pressed={color === swatch}
                className={`h-9 w-9 rounded-lg border-2 ${color === swatch ? "border-fg scale-110" : "border-line"}`}
                style={{ background: swatch }}
              />
            ))}
            <label className="chip cursor-pointer gap-2">
              <span aria-hidden>🎨</span>
              <span className="sr-only">Custom colour</span>
              <input
                type="color" value={color} className="h-6 w-8 cursor-pointer bg-transparent"
                onChange={(e) => { setColor(e.target.value); if (tool === "eraser") setTool("free"); }}
              />
            </label>
            <label className="ml-auto flex min-w-40 flex-1 items-center gap-2">
              <span className="label whitespace-nowrap">Size {size}</span>
              <input
                type="range" min={2} max={48} value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full accent-[var(--brand)]"
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
