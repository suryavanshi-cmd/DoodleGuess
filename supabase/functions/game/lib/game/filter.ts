// GENERATED from src/lib/game/filter.ts by scripts/build-edge-function.mjs.
// Do not edit — change the original and run `npm run build:edge`.

import { normalizeWord } from "./text.ts";

const SEVERE_PARTS = [
  "fuck", "shit", "cunt", "nigger", "nigga", "faggot", "whore", "dildo", "blowjob",
  "handjob", "jizz", "wanker", "pussy", "bitch", "bastard", "asshole", "arsehole",
  "cocksuck", "slut", "twat", "retard", "chink", "tranny", "dickhead",
];

const SEVERE_WORDS = [
  "rape", "anus", "cum", "penis", "vagina", "boobs", "tits", "porn", "kys",
  "cock", "dick", "milf", "nsfw", "sex", "spic",
];

const MILD_WORDS = [
  "damn", "hell", "crap", "piss", "arse", "ass", "douche", "sucks", "idiot", "stupid", "dumb",
];

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

  const strays = words.filter((w) => w.length <= 2).length;
  if (strays >= 3) {
    const collapsed = words.join("");
    if (SEVERE_PARTS.some((bad) => collapsed.includes(bad))) return true;
    if (SEVERE_WORDS.includes(collapsed)) return true;
  }
  return false;
}

export function containsSecretWord(text: string, secretWord: string): boolean {
  const word = normalizeWord(secretWord);
  if (word.length < 3) return false;
  const haystack = normalizeWord(text);
  if (haystack === word) return true;
  return haystack.split(" ").length > 1 && haystack.includes(word);
}

export interface ScreenOptions {
  strict: boolean;

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

export function sanitizeName(raw: string): string {
  const cleaned = raw.replace(/[^\p{L}\p{N} _.-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 16);
  if (!cleaned || containsProfanity(cleaned, true)) return "";
  return cleaned;
}
