export type Difficulty = "easy" | "medium" | "hard";

/** Base value of a word, before speed / streak / power-up multipliers. */
export const BASE_POINTS: Record<Difficulty, number> = {
  easy: 100,
  medium: 150,
  hard: 220,
};

/** Multiplier for being early on the buzzer, on top of the raw clock bonus. */
const RANK_BONUS = [1.15, 1.08, 1.03];

/** Streak bonus starts once a correct guess makes it 3 in a row, caps at +50%. */
export const STREAK_MIN = 3;
const STREAK_STEP = 0.1;
const STREAK_CAP = 1.5;

export interface GuesserScoreInput {
  difficulty: Difficulty;
  /** Fraction of the turn clock still remaining, 0..1. */
  timeLeftRatio: number;
  /** 1 = first correct guesser this turn. */
  correctRank: number;
  /** Consecutive correct rounds *before* this one. */
  priorStreak: number;
  doublePoints?: boolean;
  /** Points already spent on power-ups this turn are not refunded here. */
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function streakMultiplier(priorStreak: number): number {
  const streakAfterThisGuess = priorStreak + 1;
  if (streakAfterThisGuess < STREAK_MIN) return 1;
  const steps = streakAfterThisGuess - STREAK_MIN + 1;
  return Math.min(STREAK_CAP, 1 + STREAK_STEP * steps);
}

export function guesserPoints(input: GuesserScoreInput): number {
  const base = BASE_POINTS[input.difficulty];
  const speed = 0.35 + 0.65 * clamp01(input.timeLeftRatio);
  const rank = RANK_BONUS[Math.max(0, input.correctRank - 1)] ?? 1;
  const raw = base * speed * rank * streakMultiplier(input.priorStreak);
  const points = Math.round(raw);
  return input.doublePoints ? points * 2 : points;
}

export interface DrawerScoreInput {
  difficulty: Difficulty;
  correctCount: number;
  /** Mean `timeLeftRatio` across the players who got it. */
  avgTimeLeftRatio: number;
  doublePoints?: boolean;
}

/**
 * The drawer is paid per correct guesser, so a clear drawing that everyone
 * gets beats an unguessable one — capped so a huge room is not a jackpot.
 */
export function drawerPoints(input: DrawerScoreInput): number {
  if (input.correctCount <= 0) return 0;
  const base = BASE_POINTS[input.difficulty];
  const perGuesser = base * 0.25 * (0.5 + 0.5 * clamp01(input.avgTimeLeftRatio));
  const cap = base * 1.5;
  const points = Math.round(Math.min(perGuesser * input.correctCount, cap));
  return input.doublePoints ? points * 2 : points;
}

/** A turn a player sat out as drawer neither builds nor breaks their streak. */
export function nextStreak(priorStreak: number, outcome: "correct" | "missed" | "drew"): number {
  if (outcome === "drew") return priorStreak;
  return outcome === "correct" ? priorStreak + 1 : 0;
}

/**
 * A synonym shows you had the idea without landing the word, so it scores —
 * but not as much as saying it.
 */
export const SYNONYM_POINTS_FACTOR = 0.6;

export function synonymPoints(fullPoints: number): number {
  return Math.max(1, Math.round(fullPoints * SYNONYM_POINTS_FACTOR));
}

export const POWER_UP_COSTS = {
  hint: 25,
  freeze: 40,
} as const;

export type PowerUpKind = keyof typeof POWER_UP_COSTS;

/** Power-ups are paid for out of banked points and can never bankrupt a player. */
export function canAfford(score: number, kind: PowerUpKind): boolean {
  return score >= POWER_UP_COSTS[kind];
}

export function spendPoints(score: number, kind: PowerUpKind): number {
  return Math.max(0, score - POWER_UP_COSTS[kind]);
}

export interface PlayerRoundStat {
  playerId: string;
  guesses: number;
  correct: number;
  totalGuessMs: number;
  bestStreak: number;
  drawnTurns: number;
  pointsFromDrawing: number;
}

export interface RecapAwards {
  mvpArtistId: string | null;
  fastestGuesserId: string | null;
  funniestGuess: { text: string; count: number } | null;
}

/** Post-game recap: who drew best, who buzzed fastest, and the running joke. */
export function computeRecap(
  stats: readonly PlayerRoundStat[],
  wrongGuessTexts: readonly string[],
): RecapAwards {
  let mvp: PlayerRoundStat | null = null;
  for (const s of stats) {
    if (s.drawnTurns === 0) continue;
    if (!mvp || s.pointsFromDrawing > mvp.pointsFromDrawing) mvp = s;
  }

  let fastest: PlayerRoundStat | null = null;
  for (const s of stats) {
    if (s.correct === 0) continue;
    if (!fastest || s.totalGuessMs / s.correct < fastest.totalGuessMs / fastest.correct) fastest = s;
  }

  const tally = new Map<string, number>();
  for (const text of wrongGuessTexts) {
    const key = text.trim().toLowerCase();
    if (!key) continue;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  let funniest: { text: string; count: number } | null = null;
  for (const [text, count] of tally) {
    if (count < 2) continue;
    if (!funniest || count > funniest.count) funniest = { text, count };
  }

  return {
    mvpArtistId: mvp?.playerId ?? null,
    fastestGuesserId: fastest?.playerId ?? null,
    funniestGuess: funniest,
  };
}

export function accuracyPct(correct: number, guesses: number): number {
  if (guesses <= 0) return 0;
  return Math.round((correct / guesses) * 100);
}
