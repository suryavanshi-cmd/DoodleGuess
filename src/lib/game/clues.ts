import { normalizeWord } from "./text";
import { containsProfanity } from "./filter";
import { announcesSound, rhymes } from "./phonetics";

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
  /** Shown to the Clue-Giver as they type — friendly, never scolding. */
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

/** "the", "of" and friends are not the answer, even inside a longer phrase. */
const STOPWORDS = new Set(["the", "a", "an", "and", "of", "in", "on", "at", "to", "for", "with", "is", "it"]);

/** Letters of the word hidden as an acrostic: "Cool Animal, Tiny" for CAT. */
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

/** "c a t" or "c-a-t" written out in sequence. */
function spellsSpaced(clue: string, word: string): boolean {
  const target = normalizeWord(word).replace(/\s/g, "");
  if (target.length < 3) return false;
  const collapsed = clue.toLowerCase().replace(/[^a-z]/g, "");
  const singles = clue.split(/[\s\-.]+/).filter((t) => t.replace(/[^a-z]/gi, "").length === 1).length;
  return singles >= 3 && collapsed.includes(target);
}

/**
 * Server-side gate on a human-written clue. Everything here is local string
 * work — no model call, no external service, no per-clue cost.
 */
export function validateClue(rawClue: string, secretWord: string): ClueCheck {
  const clue = rawClue.replace(/\s+/g, " ").trim();
  if (!clue) return reject("empty");
  if (clue.length > CLUE_MAX_LENGTH) return reject("too-long");
  if (containsProfanity(clue, true)) return reject("profanity");

  const word = normalizeWord(secretWord);
  const normalizedClue = normalizeWord(clue);
  const clueWords = normalizedClue.split(" ").filter(Boolean);

  // Spelling games are checked first: "c a t" also reads as containing "cat",
  // and the spelling message is the one that explains the actual problem.
  if (spellsSpaced(clue, word) || spellsAcrostic(clue, word)) return reject("spells-it-out", clue);

  // Meaningful parts of a multi-word answer — "the" in "spill the beans" is
  // not a giveaway, and treating it as one rejects almost every clue.
  const parts = word.split(" ").filter((part) => part.length >= 3 && !STOPWORDS.has(part));
  const targets = [word.replace(/\s/g, ""), ...parts].filter((t) => t.length >= 3);

  for (const target of targets) {
    if (normalizedClue.replace(/\s/g, "").includes(target)) return reject("contains-word", clue);
  }

  // Plural or simple stem of the answer.
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
