"use client";

import { useEffect, useRef, useState } from "react";
import { loadDoodleModel, type Prediction } from "@/lib/doodle/model";
import { strokesToInput } from "@/lib/doodle/preprocess";
import type { Stroke } from "@/lib/game/types";

/**
 * "AI thinks…" — a small classifier watching the board and saying what the
 * drawing looks like to it.
 *
 * It is decoration. Nothing here reaches the server, nothing here scores, and
 * every failure path ends in the overlay quietly not rendering: no model, slow
 * device, not enough ink, no canvas support. The drawing must never wait on it.
 */

const SAMPLE_MS = 1_200;
/** Past this, sampling is costing the drawer frames, so it stops. */
const SLOW_BUDGET_MS = 90;
const SLOW_STRIKES = 3;
/** Below this the model is really just guessing, so say nothing. */
const MIN_SCORE = 0.12;

export interface AiGuessState {
  guesses: Prediction[];
  /** False once the model is unavailable or the device cannot keep up. */
  available: boolean;
}

export function useAiGuesses(strokes: readonly Stroke[], enabled: boolean): AiGuessState {
  const [guesses, setGuesses] = useState<Prediction[]>([]);
  const [available, setAvailable] = useState(true);
  // The sampler reads the latest strokes without restarting on every stroke,
  // so the interval is not torn down and rebuilt mid-drawing.
  const strokesRef = useRef<readonly Stroke[]>(strokes);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let strikes = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scratch = document.createElement("canvas");

    void loadDoodleModel().then((model) => {
      if (cancelled) return;
      if (!model) {
        setAvailable(false);
        return;
      }

      const tick = () => {
        if (cancelled) return;
        const started = performance.now();
        const input = strokesToInput(strokesRef.current, model.inputWidth, scratch);
        const next = input ? model.predict(input).slice(0, 3).filter((p) => p.score >= MIN_SCORE) : [];
        const elapsed = performance.now() - started;

        // A phone that cannot sample inside the budget gives up rather than
        // stuttering the canvas for the rest of the turn.
        strikes = elapsed > SLOW_BUDGET_MS ? strikes + 1 : 0;
        if (strikes >= SLOW_STRIKES) {
          setAvailable(false);
          setGuesses([]);
          return;
        }

        setGuesses(next);
        timer = setTimeout(tick, SAMPLE_MS);
      };

      timer = setTimeout(tick, SAMPLE_MS);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);

  // Derived rather than cleared in the effect: switching off should hide the
  // overlay on the same render, not one cascade later.
  return { guesses: enabled ? guesses : [], available };
}

export function AiGuessOverlay({ guesses, className = "" }: {
  guesses: Prediction[];
  className?: string;
}) {
  if (guesses.length === 0) return null;

  return (
    <div
      className={`pointer-events-none absolute left-2 top-2 z-20 max-w-[70%] rounded-lg border border-line
        bg-surface/90 px-2.5 py-1.5 backdrop-blur-sm ${className}`}
      aria-live="off"
    >
      <p className="font-hud text-[10px] uppercase tracking-widest text-muted">AI thinks</p>
      <p className="mt-0.5 truncate text-sm font-semibold">
        {guesses.map((guess, index) => (
          <span key={guess.label}>
            {index > 0 ? <span className="text-muted"> · </span> : null}
            <span style={{ opacity: index === 0 ? 1 : 0.65 }}>{guess.label}?</span>
          </span>
        ))}
      </p>
    </div>
  );
}

/**
 * Attribution. The dataset is Google's and openly published; the model here was
 * trained on it. That is the whole claim — no partnership, nothing embedded.
 */
export function DoodleModelCredit({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted ${className}`}>
      Doodle recognition runs in your browser, trained on{" "}
      <a
        href="https://github.com/googlecreativelab/quickdraw-dataset"
        target="_blank"
        rel="noreferrer noopener"
        className="underline hover:text-fg"
      >
        Google&apos;s open Quick, Draw! dataset
      </a>
      .
    </p>
  );
}
