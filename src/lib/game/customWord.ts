import { containsProfanity, containsSecretWord } from "./filter";
import { normalizeWord } from "./text";

export const CUSTOM_WORD_MIN = 3;
export const CUSTOM_WORD_MAX = 20;

export type CustomWordRejection = "too-short" | "too-long" | "charset" | "profanity" | "in-chat";

export interface CustomWordCheck {
  ok: boolean;
  reason: CustomWordRejection | null;
  /** Shown as the player types — friendly, never scolding. */
  message: string;
  cleaned: string;
}

const MESSAGES: Record<CustomWordRejection, string> = {
  "too-short": `Use at least ${CUSTOM_WORD_MIN} letters.`,
  "too-long": `Keep it under ${CUSTOM_WORD_MAX} characters.`,
  charset: "Letters, spaces and hyphens only — no numbers or symbols.",
  profanity: "Pick something friendlier.",
  "in-chat": "That word has already been said in the room — pick another.",
};

function reject(reason: CustomWordRejection, cleaned = ""): CustomWordCheck {
  return { ok: false, reason, message: MESSAGES[reason], cleaned };
}

/** Letters, spaces and hyphens. No digits, punctuation or emoji. */
const ALLOWED = /^[\p{L}][\p{L} -]*$/u;

/**
 * Checks a player's own word before it becomes the answer. Everything here is
 * length, character-set and word-list work — no model call, no per-word cost.
 * The chat check is applied separately by the server, which has the feed.
 */
export function validateCustomWord(raw: string, opts: { strict: boolean }): CustomWordCheck {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (cleaned.length < CUSTOM_WORD_MIN) return reject("too-short", cleaned);
  if (cleaned.length > CUSTOM_WORD_MAX) return reject("too-long", cleaned);
  if (!ALLOWED.test(cleaned)) return reject("charset", cleaned);
  if (containsProfanity(cleaned, opts.strict)) return reject("profanity", cleaned);
  return { ok: true, reason: null, message: "Good to go!", cleaned };
}

/**
 * Has the word already been said out loud? Choosing it after that would hand
 * the round to whoever happened to type it.
 */
export function wordAlreadySaid(recentMessages: readonly string[], word: string): boolean {
  const target = normalizeWord(word);
  if (!target) return false;
  return recentMessages.some((text) => {
    const haystack = normalizeWord(text);
    if (!haystack) return false;
    if (haystack === target) return true;
    return containsSecretWord(text, word);
  });
}
