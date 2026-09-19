"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AiGuessOverlay, DoodleModelCredit, useAiGuesses } from "./AiGuess";
import { Canvas } from "./Canvas";
import { Confetti } from "./Confetti";
import { loadDoodleModel, type Prediction } from "@/lib/doodle/model";
import type { Stroke } from "@/lib/game/types";

/**
 * Solo mode: you draw, the classifier guesses, no room and no second player.
 *
 * Every round of this runs in the browser. There is no server call, no
 * database row and no room code — which also means it works while the rest of
 * the game is waiting for someone else to join, and offline once the page and
 * the model are cached.
 *
 * The words come from the model's own label set rather than the game's word
 * packs. Handing someone "wheelbarrow" when the classifier has never seen one
 * would make the round unwinnable through no fault of theirs.
 */

const ROUNDS = 6;
const SECONDS = 20;
/** A breath to read the verdict before the next word. */
const VERDICT_MS = 1_600;

type Phase = "loading" | "ready" | "drawing" | "won" | "lost" | "over";

interface Round {
  word: string;
  won: boolean;
}

export function SoloGame() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [words, setWords] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Round[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [left, setLeft] = useState(SECONDS);
  const [celebrations, setCelebrations] = useState(0);

  const word = words[index] ?? "";
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Words are whatever the model actually knows, shuffled once per game.
  useEffect(() => {
    let cancelled = false;
    void loadDoodleModel().then((model) => {
      if (cancelled) return;
      if (!model || model.labels.length < ROUNDS) {
        setPhase("over");
        return;
      }
      const pool = [...model.labels];
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      setWords(pool.slice(0, ROUNDS));
      setPhase("ready");
    });
    return () => { cancelled = true; };
  }, []);

  // The clock only runs while drawing, and running out ends the round.
  useEffect(() => {
    if (phase !== "drawing") return;
    const interval = setInterval(() => {
      setLeft((current) => {
        if (current <= 1) {
          clearInterval(interval);
          setPhase("lost");
          return 0;
        }
        return current - 1;
      });
    }, 1_000);
    return () => clearInterval(interval);
  }, [phase]);

  // Called from the sampler, so the win lands the moment the model sees it.
  const onGuess = useCallback((guesses: Prediction[]) => {
    if (phaseRef.current !== "drawing") return;
    const target = words[index];
    if (!target || !guesses[0]) return;
    const clean = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");
    if (clean(guesses[0].label) !== clean(target)) return;
    phaseRef.current = "won";
    setPhase("won");
    setCelebrations((count) => count + 1);
  }, [words, index]);

  const { guesses, thinking, available } = useAiGuesses(strokes, phase === "drawing", onGuess);

  // Record the round and move on, once the verdict has been on screen a moment.
  useEffect(() => {
    if (phase !== "won" && phase !== "lost") return;
    const won = phase === "won";
    const timer = setTimeout(() => {
      setResults((current) => [...current, { word: words[index], won }]);
      setStrokes([]);
      setLeft(SECONDS);
      if (index + 1 >= ROUNDS) setPhase("over");
      else {
        setIndex((current) => current + 1);
        setPhase("ready");
      }
    }, VERDICT_MS);
    return () => clearTimeout(timer);
  }, [phase, index, words]);

  const restart = () => {
    setResults([]);
    setIndex(0);
    setStrokes([]);
    setLeft(SECONDS);
    setPhase("loading");
    void loadDoodleModel().then((model) => {
      if (!model) return;
      const pool = [...model.labels];
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      setWords(pool.slice(0, ROUNDS));
      setPhase("ready");
    });
  };

  const wins = results.filter((round) => round.won).length;

  return (
    <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col gap-2 overflow-hidden px-3 py-2 sm:px-4 sm:py-3">
      <header className="flex items-center gap-3">
        <Link href="/" className="font-display text-lg font-black tracking-tight">
          <span className="text-gradient">Doodle</span>Guess
        </Link>
        <span className="font-hud ml-auto text-[11px] uppercase tracking-widest text-muted">
          {phase === "over" ? "Done" : `Drawing ${Math.min(index + 1, ROUNDS)}/${ROUNDS}`}
        </span>
        <Link href="/play" className="btn-ghost px-3 text-sm">Multiplayer</Link>
      </header>

      {phase === "loading" ? (
        <p className="py-20 text-center text-muted">Loading the classifier…</p>
      ) : null}

      {phase === "ready" ? (
        <div className="animate-pop-in flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-lg text-muted">Draw</p>
          <p className="text-4xl font-black sm:text-5xl">{word}</p>
          <p className="text-muted">in under {SECONDS} seconds</p>
          <button type="button" className="btn-primary mt-2 px-10 text-lg" onClick={() => setPhase("drawing")}>
            Got it!
          </button>
          {!available ? (
            <p className="max-w-sm text-sm text-warning">
              The classifier could not start on this device, so nothing will be guessing. The
              multiplayer game is unaffected.
            </p>
          ) : null}
        </div>
      ) : null}

      {phase === "drawing" || phase === "won" || phase === "lost" ? (
        <>
          <div className="flex items-baseline gap-3">
            <p className="font-hud text-sm uppercase tracking-widest text-muted">Draw</p>
            <p className="text-2xl font-black">{word}</p>
            <p className={`font-hud ml-auto text-2xl ${left <= 5 ? "text-danger" : ""}`}>
              {String(left).padStart(2, "0")}
            </p>
          </div>

          {/* Portrait and sized to the screen, like the reference. These strokes
              never leave the browser, so this surface can pick its own shape
              without touching the coordinate space the shared board uses. */}
          <Canvas
            strokes={strokes}
            canDraw={phase === "drawing"}
            onStroke={(_stroke, all) => setStrokes(all)}
            onCanvas={(_action, all) => setStrokes(all)}
            width={750}
            height={1250}
            className="flex min-h-0 flex-1 flex-col gap-2"
            boxClassName="flex min-h-0 flex-1 items-center justify-center"
            surfaceClassName="block h-auto max-h-full w-auto max-w-full"
            overlay={
              <>
                <AiGuessOverlay guesses={guesses} thinking={thinking} target={word} />
                <Confetti trigger={celebrations} />
              </>
            }
          />

          {phase === "lost" ? (
            <p className="animate-pop-in text-center text-lg font-bold text-warning">
              Time! It never got {word}.
            </p>
          ) : null}
        </>
      ) : null}

      {phase === "over" ? (
        <div className="animate-pop-in flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-lg text-muted">The classifier recognised</p>
          <p className="text-5xl font-black">{wins} of {results.length}</p>
          <ul className="mt-2 flex flex-wrap justify-center gap-2">
            {results.map((round) => (
              <li
                key={round.word}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold
                  ${round.won ? "border-success/50 bg-success/15 text-success" : "border-line bg-surface text-muted"}`}
              >
                {round.won ? "✓" : "✕"} {round.word}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-primary px-8" onClick={restart}>Play again</button>
            <Link href="/play" className="btn-ghost px-6">Play with friends</Link>
          </div>
        </div>
      ) : null}

      <DoodleModelCredit className="shrink-0 text-center" />
    </main>
  );
}
