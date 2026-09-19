// GENERATED from src/lib/game/scoring.ts by scripts/build-edge-function.mjs.
// Do not edit — change the original and run `npm run build:edge`.

export type Difficulty = "easy" | "medium" | "hard";

export const BASE_POINTS: Record<Difficulty, number> = {
  easy: 100,
  medium: 150,
  hard: 220,
};

const RANK_BONUS = [1.15, 1.08, 1.03];

export const STREAK_MIN = 3;
const STREAK_STEP = 0.1;
const STREAK_CAP = 1.5;

export interface GuesserScoreInput {
  difficulty: Difficulty;

  timeLeftRatio: number;

  correctRank: number;

  priorStreak: number;
  doublePoints?: boolean;

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

  avgTimeLeftRatio: number;
  doublePoints?: boolean;
}

export function drawerPoints(input: DrawerScoreInput): number {
  if (input.correctCount <= 0) return 0;
  const base = BASE_POINTS[input.difficulty];
  const perGuesser = base * 0.25 * (0.5 + 0.5 * clamp01(input.avgTimeLeftRatio));
  const cap = base * 1.5;
  const points = Math.round(Math.min(perGuesser * input.correctCount, cap));
  return input.doublePoints ? points * 2 : points;
}

export function nextStreak(priorStreak: number, outcome: "correct" | "missed" | "drew"): number {
  if (outcome === "drew") return priorStreak;
  return outcome === "correct" ? priorStreak + 1 : 0;
}

export const POWER_UP_COSTS = {
  hint: 25,
  freeze: 40,
} as const;

export type PowerUpKind = keyof typeof POWER_UP_COSTS;

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
