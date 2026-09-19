// GENERATED from src/lib/game/phonetics.ts by scripts/build-edge-function.mjs.
// Do not edit — change the original and run `npm run build:edge`.

const CODES: Record<string, string> = {
  b: "1", f: "1", p: "1", v: "1",
  c: "2", g: "2", j: "2", k: "2", q: "2", s: "2", x: "2", z: "2",
  d: "3", t: "3",
  l: "4",
  m: "5", n: "5",
  r: "6",
};

export function soundex(input: string): string {
  const word = input.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return "";
  const first = word[0];
  let previous = CODES[first] ?? "";
  let out = first.toUpperCase();
  for (const ch of word.slice(1)) {
    const code = CODES[ch] ?? "";
    if (code && code !== previous) out += code;

    if (ch !== "h" && ch !== "w") previous = code;
    if (out.length === 4) break;
  }
  return out.padEnd(4, "0");
}

const VOWELS = "aeiouy";

export function rhymeKey(input: string): string {
  const word = input.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length < 2) return word;
  let lastVowel = -1;
  for (let i = word.length - 1; i >= 0; i--) {
    if (VOWELS.includes(word[i])) {
      lastVowel = i;
      break;
    }
  }
  if (lastVowel === -1) return word.slice(-2);

  let start = lastVowel;
  while (start > 0 && VOWELS.includes(word[start - 1])) start--;
  return word.slice(start);
}

const GENERIC_TAILS = new Set(["ing", "ed", "er", "ers", "es", "ly", "ion", "ions", "y", "ies", "al"]);

export function rhymes(candidate: string, word: string): boolean {
  const left = candidate.toLowerCase().replace(/[^a-z]/g, "");
  const right = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!left || !right || left === right) return false;
  if (left.length !== right.length || left.length < 3) return false;

  const tail = rhymeKey(left);
  if (tail.length < 2 || tail !== rhymeKey(right) || GENERIC_TAILS.has(tail)) return false;

  let differences = 0;
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) differences++;
  return differences > 0 && differences <= 2;
}

export function announcesSound(clue: string): boolean {
  return /\b(rhymes?\s+with|sounds?\s+like|starts?\s+with|begins?\s+with|ends?\s+with)\b/i.test(clue);
}
