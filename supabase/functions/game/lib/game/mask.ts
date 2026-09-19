// GENERATED from src/lib/game/mask.ts by scripts/build-edge-function.mjs.
// Do not edit — change the original and run `npm run build:edge`.

import { mulberry32, seedFrom } from "./text.ts";

export const MAX_REVEAL_FRACTION = 0.4;

function letterIndices(word: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < word.length; i++) {
    if (/[a-z0-9]/i.test(word[i])) out.push(i);
  }
  return out;
}

export function maskWord(word: string, revealed: readonly number[] = []): string {
  const set = new Set(revealed);
  return word
    .split("")
    .map((ch, i) => {
      if (!/[a-z0-9]/i.test(ch)) return ch;
      return set.has(i) ? ch.toUpperCase() : "_";
    })
    .join(" ");
}

export function wordShape(word: string): number[] {
  return word.split(/[\s-]+/).filter(Boolean).map((part) => part.length);
}

export function revealBudget(word: string, hintsEnabled: boolean): number {
  if (!hintsEnabled) return 0;
  const letters = letterIndices(word).length;
  if (letters <= 3) return letters > 2 ? 1 : 0;
  return Math.max(1, Math.floor(letters * MAX_REVEAL_FRACTION));
}

export interface RevealTick {
  atMs: number;
  index: number;
}

export function revealTimeline(
  word: string,
  turnSeconds: number,
  opts: { hintsEnabled: boolean; seed: string },
): RevealTick[] {
  const budget = revealBudget(word, opts.hintsEnabled);
  if (budget === 0) return [];
  const rng = mulberry32(seedFrom(opts.seed));
  const candidates = letterIndices(word);

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const picked = candidates.slice(0, budget).sort((a, b) => a - b);
  const totalMs = turnSeconds * 1000;
  const firstAt = totalMs * 0.45;
  const lastAt = totalMs * 0.9;
  const step = budget === 1 ? 0 : (lastAt - firstAt) / (budget - 1);
  return picked.map((index, i) => ({ atMs: Math.round(firstAt + step * i), index }));
}

export function revealedAt(timeline: readonly RevealTick[], elapsedMs: number): number[] {
  return timeline.filter((t) => t.atMs <= elapsedMs).map((t) => t.index);
}
