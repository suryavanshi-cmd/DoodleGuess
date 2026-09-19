// GENERATED from src/lib/game/clues.ts by scripts/build-edge-function.mjs.
// Do not edit — change the original and run `npm run build:edge`.

import { normalizeWord } from "./text.ts";
import { containsProfanity } from "./filter.ts";
import { announcesSound, rhymes } from "./phonetics.ts";

export const CLUE_MAX_LENGTH = 60;

export type ClueRejection =
  | "empty"
  | "too-long"
  | "contains-word"
  | "rhymes"
  | "spells-it-out"
  | "profanity";

export interface ClueCheck {
  ok: boolean;
  reason: ClueRejection | null;

  message: string;
  cleaned: string;
}

const MESSAGES: Record<ClueRejection, string> = {
  empty: "Write a clue first.",
  "too-long": `Keep it under ${CLUE_MAX_LENGTH} characters.`,
  "contains-word": "That gives the word away — try describing it instead.",
  rhymes: "Clue the meaning, not the sound of the word.",
  "spells-it-out": "No spelling it out letter by letter!",
  profanity: "Let's keep it friendly.",
};

function reject(reason: ClueRejection, cleaned = ""): ClueCheck {
  return { ok: false, reason, message: MESSAGES[reason], cleaned };
}

const STOPWORDS = new Set(["the", "a", "an", "and", "of", "in", "on", "at", "to", "for", "with", "is", "it"]);

function spellsAcrostic(clue: string, word: string): boolean {
  const target = normalizeWord(word).replace(/\s/g, "");
  if (target.length < 3) return false;
  const initials = clue
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z]/gi, "")[0])
    .filter(Boolean)
    .join("")
    .toLowerCase();
  return initials.includes(target);
}

function spellsSpaced(clue: string, word: string): boolean {
  const target = normalizeWord(word).replace(/\s/g, "");
  if (target.length < 3) return false;
  const collapsed = clue.toLowerCase().replace(/[^a-z]/g, "");
  const singles = clue.split(/[\s\-.]+/).filter((t) => t.replace(/[^a-z]/gi, "").length === 1).length;
  return singles >= 3 && collapsed.includes(target);
}

export function validateClue(rawClue: string, secretWord: string): ClueCheck {
  const clue = rawClue.replace(/\s+/g, " ").trim();
  if (!clue) return reject("empty");
  if (clue.length > CLUE_MAX_LENGTH) return reject("too-long");
  if (containsProfanity(clue, true)) return reject("profanity");

  const word = normalizeWord(secretWord);
  const normalizedClue = normalizeWord(clue);
  const clueWords = normalizedClue.split(" ").filter(Boolean);

  if (spellsSpaced(clue, word) || spellsAcrostic(clue, word)) return reject("spells-it-out", clue);

  const parts = word.split(" ").filter((part) => part.length >= 3 && !STOPWORDS.has(part));
  const targets = [word.replace(/\s/g, ""), ...parts].filter((t) => t.length >= 3);

  for (const target of targets) {
    if (normalizedClue.replace(/\s/g, "").includes(target)) return reject("contains-word", clue);
  }

  for (const token of clueWords) {
    const stem = token.replace(/(ies|es|s)$/, "");
    for (const target of targets) {
      const targetStem = target.replace(/(ies|es|s)$/, "");
      if (stem.length >= 3 && targetStem.length >= 3 && stem === targetStem) {
        return reject("contains-word", clue);
      }
    }
  }

  if (announcesSound(clue)) return reject("rhymes", clue);
  for (const token of clueWords) {
    for (const target of targets) {
      if (rhymes(token, target)) return reject("rhymes", clue);
    }
  }

  return { ok: true, reason: null, message: "Looks good!", cleaned: clue };
}
