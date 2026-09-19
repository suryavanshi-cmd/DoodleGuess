"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AiGuessOverlay, DoodleModelCredit, useAiGuesses } from "./AiGuess";
import { Canvas } from "./Canvas";
import { Confetti } from "./Confetti";
import { labelMatches, promptableLabels } from "@/lib/doodle/labels";
import { loadDoodleModel, type DoodleModel, type Prediction } from "@/lib/doodle/model";
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
/** Long enough to read what the AI said and enjoy it. */
const WIN_MS = 2_600;
/** Shorter: there is nothing to celebrate, and the next word is the point. */
const LOSS_MS = 1_800;

type Phase = "loading" | "ready" | "drawing" | "won" | "lost" | "over";

/** A game's worth of prompts, drawn from what the classifier can recognise. */
function pickWords(model: DoodleModel): string[] {
  const pool = promptableLabels(model.labels);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, ROUNDS);
}

interface Round {
  word: string;
  won: boolean;
  /** The label the model actually said, which is not always the word. */
  said?: string;
  seconds?: number;
}

/** What the AI said at the moment it got it, kept for the win screen. */
interface Verdict {
  said: string;
  score: number;
  seconds: number;
}

export function SoloGame() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [words, setWords] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Round[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [left, setLeft] = useState(SECONDS);
  const [celebrations, setCelebrations] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

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
      setWords(pickWords(model));
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
    // Any of the three it offers counts, matching what the bubble says.
    const hit = target ? guesses.find((guess) => labelMatches(guess.label, target)) : undefined;
    if (!hit) return;
    phaseRef.current = "won";
    // Kept rather than recomputed: by the time this renders the sampler has
    // moved on, and the words it won with are the whole moment.
    setVerdict({ said: hit.label, score: hit.score, seconds: Math.max(1, SECONDS - left) });
    setPhase("won");
    setCelebrations((count) => count + 1);
  }, [words, index, left]);

  const { guesses, thinking, available } = useAiGuesses(strokes, phase === "drawing", { onGuess, target: word });

  // Record the round and move on, once the verdict has been on screen a moment.
  useEffect(() => {
    if (phase !== "won" && phase !== "lost") return;
    const won = phase === "won";
    const timer = setTimeout(() => {
      setResults((current) => [
        ...current,
        { word: words[index], won, said: verdict?.said, seconds: verdict?.seconds },
      ]);
      setStrokes([]);
      setLeft(SECONDS);
      setVerdict(null);
      if (index + 1 >= ROUNDS) setPhase("over");
      else {
        setIndex((current) => current + 1);
        setPhase("ready");
      }
    }, won ? WIN_MS : LOSS_MS);
    return () => clearTimeout(timer);
  }, [phase, index, words, verdict]);

  const restart = () => {
    setResults([]);
    setIndex(0);
    setStrokes([]);
    setLeft(SECONDS);
    setVerdict(null);
    setPhase("loading");
    void loadDoodleModel().then((model) => {
      if (!model) return;
      setWords(pickWords(model));
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
                {phase === "won" ? <WinCard verdict={verdict} /> : null}
                {phase === "lost" ? <LossCard word={word} /> : null}
                <Confetti trigger={celebrations} />
              </>
            }
          />

        </>
      ) : null}

      {phase === "over" ? (
        <div className="animate-pop-in flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-lg text-muted">The classifier recognised</p>
          <p className="text-5xl font-black">{wins} of {results.length}</p>
          <ul className="mt-2 flex flex-wrap justify-center gap-2">
            {results.map((round, position) => (
              <li
                // Position, not the word: a word can repeat across a run, and
                // two chips sharing a key reconcile into each other.
                key={`${position}-${round.word}`}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold
                  ${round.won ? "border-success/50 bg-success/15 text-success" : "border-line bg-surface text-muted"}`}
              >
                {round.won ? "✓" : "✕"} {round.word}
                {/* The dataset's name for it, when that is not the word. */}
                {round.won && round.said && normalize(round.said) !== normalize(round.word)
                  ? <span className="font-normal opacity-80"> — &ldquo;{round.said}&rdquo;</span>
                  : null}
                {round.won && round.seconds
                  ? <span className="font-hud ml-1.5 text-xs opacity-70">{round.seconds}s</span>
                  : null}
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

/* --------------------------------------------------------------- verdicts */

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

/**
 * The winning moment.
 *
 * The point of solo is the second the machine recognises your scribble, so
 * that second gets the screen: its own words, in its own voice, and how long
 * it took. Confetti alone said something happened without saying what.
 */
function WinCard({ verdict }: { verdict: Verdict | null }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4">
      <div className="animate-pop-in w-full max-w-sm rounded-2xl border border-success/50 bg-surface/95 p-5 text-center shadow-2xl backdrop-blur-md">
        <p className="font-hud text-[11px] uppercase tracking-[0.3em] text-success">Got it</p>
        {verdict ? (
          <>
            <p className="font-hero mt-2 text-xl font-semibold leading-snug text-fg">
              &ldquo;Oh I know, it&rsquo;s {verdict.said}!&rdquo;
            </p>
            <p className="mt-2 text-sm text-muted">
              in {verdict.seconds} {verdict.seconds === 1 ? "second" : "seconds"}
              <span aria-hidden> · </span>
              {Math.round(verdict.score * 100)}% sure
            </p>
          </>
        ) : (
          <p className="font-hero mt-2 text-xl font-semibold text-fg">The AI got it.</p>
        )}
      </div>
    </div>
  );
}

/** The other outcome, in the same place, so a round always ends somewhere. */
function LossCard({ word }: { word: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4">
      <div className="animate-pop-in w-full max-w-sm rounded-2xl border border-line bg-surface/95 p-5 text-center shadow-2xl backdrop-blur-md">
        <p className="font-hud text-[11px] uppercase tracking-[0.3em] text-warning">Time</p>
        <p className="font-hero mt-2 text-xl font-semibold leading-snug text-fg">
          It never saw {word}.
        </p>
        <p className="mt-2 text-sm text-muted">Next one.</p>
      </div>
    </div>
  );
}
