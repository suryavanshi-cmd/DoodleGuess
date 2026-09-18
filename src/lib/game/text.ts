/** Text normalisation + edit distance. Pure, dependency-free, unit-tested. */

const LEADING_ARTICLE = /^(?:the|a|an)\s+/;

/**
 * Canonical form used for every guess/word comparison:
 * lowercase, accents stripped, punctuation dropped, whitespace collapsed,
 * and a leading article removed ("the moon" -> "moon").
 */
export function normalizeWord(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base.replace(LEADING_ARTICLE, "").trim();
}

/**
 * Damerau-Levenshtein (optimal string alignment) distance with an early exit
 * once `max` is exceeded. Transposition counts as one edit because "hosue"
 * for "house" is the single most common way a rushed guesser mistypes.
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let twoAgo: number[] = new Array<number>(b.length + 1).fill(0);
  let prev: number[] = new Array<number>(b.length + 1);
  let curr: number[] = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, twoAgo[j - 2] + 1);
      }
      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    twoAgo = prev;
    prev = curr;
    curr = new Array<number>(b.length + 1);
  }
  return prev[b.length];
}

/** Deterministic, seedable RNG so word draws and hint schedules are testable. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
