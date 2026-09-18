"use client";

import { useEffect, useRef, useState } from "react";
import { CANVAS_H, CANVAS_W, canvasBackground, renderAll } from "@/lib/draw";
import type { Stroke } from "@/lib/game/types";

/** Redraws the finished picture stroke by stroke during the break. */
export function Replay({ strokes, className = "" }: { strokes: Stroke[]; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [upTo, setUpTo] = useState(0);

  useEffect(() => {
    if (!strokes.length) return;
    const stepMs = Math.max(45, Math.min(220, 2600 / strokes.length));
    const timer = setInterval(() => {
      setUpTo((current) => {
        if (current >= strokes.length) {
          clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, stepMs);
    return () => clearInterval(timer);
  }, [strokes]);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    if (context) renderAll(context, strokes, upTo);
  }, [strokes, upTo]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      className={`block w-full rounded-xl border border-line ${className}`}
      style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, background: canvasBackground() }}
      aria-label="Replay of the drawing"
    />
  );
}
