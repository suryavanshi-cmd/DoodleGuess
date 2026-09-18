import { normalizeWord } from "./text";

/**
 * Chat filter for a mixed-age room. Deliberately blunt: DoodleGuess assumes
 * kids may be in any room, so the strict list is on by default and the host
 * can only relax the "mild" tier, never the severe one.
 */

/**
 * Substring matches: strings that essentially never appear inside an innocent
 * English word, so "fuuuck" and "fuckk" are caught too.
 */
const SEVERE_PARTS = [
  "fuck", "shit", "cunt", "nigger", "nigga", "faggot", "whore", "dildo", "blowjob",
  "handjob", "jizz", "wanker", "pussy", "bitch", "bastard", "asshole", "arsehole",
  "cocksuck", "slut", "twat", "retard", "chink", "tranny", "dickhead",
];

/**
 * Whole-word matches only: these live inside perfectly ordinary words
 * ("grape", "manuscript", "document"), so substring matching would be a mess.
 */
const SEVERE_WORDS = [
  "rape", "anus", "cum", "penis", "vagina", "boobs", "tits", "porn", "kys",
  "cock", "dick", "milf", "nsfw", "sex", "spic",
];

/** Blocked only while the strict (default, mixed-age) filter is on. */
const MILD_WORDS = [
  "damn", "hell", "crap", "piss", "arse", "ass", "douche", "sucks", "idiot", "stupid", "dumb",
];

/** Innocent words that contain a blocked substring — kids draw cockroaches. */
const SAFE_WORDS = new Set([
  "cockroach", "cockpit", "cocktail", "peacock", "shuttlecock", "hancock", "hitchcock",
  "dickens", "dickinson", "shiitake", "scunthorpe", "titmouse", "assassin", "class",
  "classic", "assignment", "bass", "grass", "glass", "pass", "passage", "massive",
  "assist", "assemble", "compass", "embassy", "cassette", "grape", "drape", "trapeze",
  "manuscript", "document", "cucumber", "cumulus", "cumin", "vacuum", "circumstance",
  "sussex", "essex", "middlesex", "analysis", "shipment", "shiplap",
]);

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b",
  "@": "a", "$": "s", "!": "i", "|": "i", "+": "t",
};

/** Collapse leetspeak, padding and stutter: "f_u_u_c_k_3_r" -> "fucker". */
export function canonicalize(text: string): string {
  const swapped = text
    .toLowerCase()
    .split("")
    .map((ch) => LEET[ch] ?? ch)
    .join("")
    .replace(/[^a-z]/g, "");
  return swapped.replace(/(.)\1{2,}/g, "$1$1");
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => LEET[ch] ?? ch)
    .join("")
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map((t) => t.replace(/(.)\1{2,}/g, "$1$1"));
}

export type ScreenReason = "profanity" | "spam" | "word-leak" | null;

export interface ScreenResult {
  allowed: boolean;
  reason: ScreenReason;
  /** Message safe to show the room; empty when the message is withheld. */
  publicText: string;
}

export function containsProfanity(text: string, strict = true): boolean {
  const words = tokens(text);
  for (const word of words) {
    if (SAFE_WORDS.has(word)) continue;
    if (SEVERE_PARTS.some((bad) => word.includes(bad))) return true;
    if (SEVERE_WORDS.includes(word)) return true;
    if (strict && MILD_WORDS.includes(word)) return true;
  }
  // "f u c k" style evasion: only collapse when the text is mostly stray letters,
  // so "cocktail party" is not mangled into a false positive.
  const strays = words.filter((w) => w.length <= 2).length;
  if (strays >= 3) {
    const collapsed = words.join("");
    if (SEVERE_PARTS.some((bad) => collapsed.includes(bad))) return true;
    if (SEVERE_WORDS.includes(collapsed)) return true;
  }
  return false;
}

/**
 * Stops "i think its a rocket" from spoiling the word for everyone else.
 * Guesses that merely *are* the word go down the correct-guess path and are
 * never published as chat, so this only catches leaks in prose.
 */
export function containsSecretWord(text: string, secretWord: string): boolean {
  const word = normalizeWord(secretWord);
  if (word.length < 3) return false;
  const haystack = normalizeWord(text);
  if (haystack === word) return true;
  return haystack.split(" ").length > 1 && haystack.includes(word);
}

export interface ScreenOptions {
  strict: boolean;
  /** Withhold messages that spoil this word; omit once the round has ended. */
  secretWord?: string | null;
  maxLength?: number;
}

export function screenMessage(text: string, opts: ScreenOptions): ScreenResult {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const maxLength = opts.maxLength ?? 120;
  if (!trimmed) return { allowed: false, reason: "spam", publicText: "" };
  if (trimmed.length > maxLength) {
    return { allowed: false, reason: "spam", publicText: "" };
  }
  if (containsProfanity(trimmed, opts.strict)) {
    return { allowed: false, reason: "profanity", publicText: "" };
  }
  if (opts.secretWord && containsSecretWord(trimmed, opts.secretWord)) {
    return { allowed: false, reason: "word-leak", publicText: "" };
  }
  return { allowed: true, reason: null, publicText: trimmed };
}

/** Player names get the same treatment, plus a length clamp. */
export function sanitizeName(raw: string): string {
  const cleaned = raw.replace(/[^\p{L}\p{N} _.-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 16);
  if (!cleaned || containsProfanity(cleaned, true)) return "";
  return cleaned;
}
