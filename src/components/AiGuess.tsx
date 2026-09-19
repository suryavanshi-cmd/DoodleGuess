"use client";

import { useEffect, useRef, useState } from "react";
import { labelMatches, modelKnows } from "@/lib/doodle/labels";
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

/**
 * How often to look at the board.
 *
 * Inference costs 0.21ms and the preprocessing a little more, so the interval
 * is not set by what the device can afford — it is set by how quickly the
 * answer should arrive. Solo passes a much shorter one: there, the whole point
 * is the machine reacting to your hand, and a second of silence after the line
 * that finishes the drawing reads as lag rather than thought.
 *
 * The board is hashed before any work happens, so a short interval on an
 * unchanged drawing costs nothing but the hash.
 */
const SAMPLE_MS = 1_200;
/** Past this, sampling is costing the drawer frames, so it stops. */
const SLOW_BUDGET_MS = 90;
const SLOW_STRIKES = 3;
/** Below this the model is really just guessing, so say nothing. */
const MIN_SCORE = 0.12;
/** How long to wait for an idle moment before sampling anyway. */
const IDLE_TIMEOUT_MS = 400;

export interface AiGuessState {
  guesses: Prediction[];
  /** False once the model is unavailable or the device cannot keep up. */
  available: boolean;
  /** There is ink on the board but nothing the model will commit to yet. */
  thinking: boolean;
  /**
   * False when the word being drawn is not one the model has a label for, so
   * anything it said would be noise. The overlay renders nothing in that case.
   */
  knowsWord: boolean;
}

export interface AiGuessOptions {
  /** Milliseconds between looks at the board. Defaults to the shared 1.2s. */
  intervalMs?: number;
  /**
   * The word being drawn.
   *
   * Passing this key at all is the caller saying "there is a right answer
   * here": the model then speaks only when it has a label for that word, and
   * a null — the word not loaded yet, or briefly missing from a state update —
   * counts as not knowing. Silence is the safe direction. Omit the key
   * entirely for a surface with no word to be right about.
   */
  target?: string | null;
  /** Fired on every sample, so a caller can act without watching state. */
  onGuess?: (guesses: Prediction[]) => void;
}

/** Cheap change detector: strokes only ever grow, shrink or reset wholesale. */
function signatureOf(strokes: readonly Stroke[]): number {
  let signature = strokes.length;
  for (const stroke of strokes) signature = (signature * 31 + stroke.points.length) | 0;
  return signature;
}

export function useAiGuesses(
  strokes: readonly Stroke[],
  enabled: boolean,
  options: AiGuessOptions = {},
): AiGuessState {
  const { target = null, onGuess, intervalMs = SAMPLE_MS } = options;
  const scored = "target" in options;
  const [guesses, setGuesses] = useState<Prediction[]>([]);
  const [available, setAvailable] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [labels, setLabels] = useState<readonly string[] | null>(null);
  // The sampler reads the latest strokes without restarting on every stroke,
  // so the interval is not torn down and rebuilt mid-drawing.
  const strokesRef = useRef<readonly Stroke[]>(strokes);
  const onGuessRef = useRef(onGuess);
  const targetRef = useRef(target);
  const scoredRef = useRef(scored);
  const intervalRef = useRef(intervalMs);
  // Read by the sampler without making it a dependency of the effect.
  const guessesRef = useRef(guesses);
  useEffect(() => {
    strokesRef.current = strokes;
    onGuessRef.current = onGuess;
    targetRef.current = target;
    scoredRef.current = scored;
    intervalRef.current = intervalMs;
    guessesRef.current = guesses;
  }, [strokes, onGuess, target, scored, intervalMs, guesses]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let strikes = 0;
    let lastSignature = -1;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idle = 0;
    const scratch = document.createElement("canvas");

    void loadDoodleModel().then((model) => {
      if (cancelled) return;
      if (!model) {
        setAvailable(false);
        return;
      }
      setLabels(model.labels);

      const sample = () => {
        if (cancelled) return;

        // Two cheap exits before any real work. Neither the pixels nor the
        // network are touched when the board has not changed since the last
        // look, or when the word is not one this model could ever name.
        const signature = signatureOf(strokesRef.current);
        const known = !scoredRef.current || modelKnows(model.labels, targetRef.current);
        if (!known || signature === lastSignature) {
          if (!known && guessesRef.current.length) {
            setGuesses([]);
            setThinking(false);
          }
          schedule();
          return;
        }
        lastSignature = signature;

        const started = performance.now();
        const input = strokesToInput(strokesRef.current, model.inputWidth, scratch);
        const next = input ? model.predict(input).filter((p) => p.score >= MIN_SCORE) : [];
        setThinking(Boolean(input) && next.length === 0);
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
        onGuessRef.current?.(next);
        schedule();
      };

      // Sampling waits for a gap between frames, so it never lands in the
      // middle of the browser painting a stroke the player is still drawing.
      // The timeout keeps it honest if the gap never comes.
      const run = () => {
        if (cancelled) return;
        if (typeof requestIdleCallback === "function") {
          // The wait for an idle moment is capped at the interval itself, so a
          // fast sampler is never held back longer than its own period.
          idle = requestIdleCallback(sample, {
            timeout: Math.min(IDLE_TIMEOUT_MS, intervalRef.current),
          });
        } else {
          sample();
        }
      };
      const schedule = () => { timer = setTimeout(run, intervalRef.current); };

      schedule();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (idle && typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
    };
  }, [enabled]);

  // Derived rather than cleared in the effect: switching off should hide the
  // overlay on the same render, not one cascade later.
  const knowsWord = !scored || (labels !== null && modelKnows(labels, target));
  const show = enabled && knowsWord;
  return {
    guesses: show ? guesses : [],
    available,
    thinking: show && thinking,
    knowsWord,
  };
}

/**
 * The AI talking to the drawer, the way Quick, Draw! talks to its player.
 *
 * Only ever rendered for the person drawing. They already know the word, so
 * naming it costs nothing and tells them their sketch is reading correctly —
 * but shown to a guesser the same bubble would simply hand over the answer,
 * which is the whole game.
 */
export function AiGuessOverlay({ guesses, thinking, target, className = "" }: {
  guesses: Prediction[];
  thinking?: boolean;
  /** The word being drawn, so the AI can say when it has got it. */
  target?: string | null;
  className?: string;
}) {
  if (guesses.length === 0 && !thinking) return null;

  // Any of the three, not just the first. The model is often right with its
  // second thought, and a game that ignored that would feel meaner than it is.
  const got = guesses.find((guess) => labelMatches(guess.label, target ?? null));
  const message = got
    ? `Oh I know, it's ${got.label}!`
    : guesses.length > 0
      ? `I see ${guesses.map((guess) => `${guess.label}?`).join(" ")}`
      : "...";

  return (
    <div className={`pointer-events-none absolute left-2 top-2 z-20 max-w-[72%] ${className}`} aria-live="off">
      <div
        className={`rounded-xl border px-3 py-2 text-sm font-semibold leading-tight
          ${got ? "border-success/50 bg-success/15 text-success" : "border-line bg-surface/95 text-fg"}`}
      >
        {message}
      </div>
      {/* The tail is what makes it read as someone speaking rather than a chip. */}
      <div
        className={`ml-4 h-0 w-0 border-x-8 border-t-8 border-x-transparent
          ${got ? "border-t-success/40" : "border-t-line"}`}
        aria-hidden
      />
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
