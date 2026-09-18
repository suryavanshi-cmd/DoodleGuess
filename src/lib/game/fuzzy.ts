import { editDistance, normalizeWord } from "./text";

export type GuessVerdict = "correct" | "close" | "wrong";

export interface GuessEvaluation {
  verdict: GuessVerdict;
  distance: number;
  /** Edit distance still counted as correct for this word length. */
  threshold: number;
  normalizedGuess: string;
}

/**
 * How many typos we forgive. Short words get no slack (too many real words sit
 * one edit apart: cat/cot/car), longer words get 1-2.
 */
export function fuzzyThreshold(length: number): 0 | 1 | 2 {
  if (length <= 4) return 0;
  if (length <= 7) return 1;
  return 2;
}

function isPluralVariant(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.length - short.length === 1 && long === short + "s") return true;
  if (long.length - short.length === 2 && (long === short + "es")) return true;
  if (short.length >= 3 && long === short.slice(0, -1) + "ies") return true;
  return false;
}

/**
 * Server-side guess check. `close` drives the private "almost!" nudge —
 * it is never broadcast to the room.
 */
export function evaluateGuess(rawGuess: string, secretWord: string): GuessEvaluation {
  const guess = normalizeWord(rawGuess);
  const word = normalizeWord(secretWord);
  const threshold = fuzzyThreshold(word.length);

  if (!guess) return { verdict: "wrong", distance: word.length, threshold, normalizedGuess: guess };
  if (guess === word) return { verdict: "correct", distance: 0, threshold, normalizedGuess: guess };
  if (isPluralVariant(guess, word)) {
    return { verdict: "correct", distance: 1, threshold, normalizedGuess: guess };
  }

  const distance = editDistance(guess, word, threshold + 1);
  if (distance <= threshold) return { verdict: "correct", distance, threshold, normalizedGuess: guess };
  if (distance <= threshold + 1) return { verdict: "close", distance, threshold, normalizedGuess: guess };

  // "is it a spaceship?" — the word is in there, treat as a near miss for the
  // guesser (and the leak filter keeps it out of public chat).
  if (word.length >= 4 && guess.includes(word)) {
    return { verdict: "close", distance, threshold, normalizedGuess: guess };
  }
  return { verdict: "wrong", distance, threshold, normalizedGuess: guess };
}
