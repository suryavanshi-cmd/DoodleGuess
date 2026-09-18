import { describe, expect, it } from "vitest";
import {
  BASE_POINTS, accuracyPct, canAfford, computeRecap, drawerPoints, guesserPoints, nextStreak,
  spendPoints, streakMultiplier,
} from "@/lib/game/scoring";

describe("guesserPoints", () => {
  it("pays the full base plus first-guesser bonus for an instant guess", () => {
    const points = guesserPoints({ difficulty: "medium", timeLeftRatio: 1, correctRank: 1, priorStreak: 0 });
    expect(points).toBe(Math.round(BASE_POINTS.medium * 1 * 1.15));
  });

  it("pays less the longer a guess takes", () => {
    const fast = guesserPoints({ difficulty: "easy", timeLeftRatio: 0.9, correctRank: 2, priorStreak: 0 });
    const slow = guesserPoints({ difficulty: "easy", timeLeftRatio: 0.1, correctRank: 2, priorStreak: 0 });
    expect(fast).toBeGreaterThan(slow);
    expect(slow).toBeGreaterThan(0);
  });

  it("never pays less than the floor, even at zero seconds left", () => {
    const points = guesserPoints({ difficulty: "hard", timeLeftRatio: 0, correctRank: 4, priorStreak: 0 });
    expect(points).toBe(Math.round(BASE_POINTS.hard * 0.35));
  });

  it("rewards harder words more", () => {
    const base = { timeLeftRatio: 0.5, correctRank: 1, priorStreak: 0 } as const;
    expect(guesserPoints({ ...base, difficulty: "hard" }))
      .toBeGreaterThan(guesserPoints({ ...base, difficulty: "easy" }));
  });

  it("ranks earlier guessers above later ones at the same clock", () => {
    const base = { difficulty: "medium", timeLeftRatio: 0.5, priorStreak: 0 } as const;
    const first = guesserPoints({ ...base, correctRank: 1 });
    const third = guesserPoints({ ...base, correctRank: 3 });
    const fifth = guesserPoints({ ...base, correctRank: 5 });
    expect(first).toBeGreaterThan(third);
    expect(third).toBeGreaterThan(fifth);
  });

  it("doubles the payout on a double-points turn", () => {
    const input = { difficulty: "medium", timeLeftRatio: 0.5, correctRank: 2, priorStreak: 0 } as const;
    expect(guesserPoints({ ...input, doublePoints: true })).toBe(guesserPoints(input) * 2);
  });

  it("clamps a nonsense time ratio instead of paying out nonsense", () => {
    const over = guesserPoints({ difficulty: "easy", timeLeftRatio: 5, correctRank: 1, priorStreak: 0 });
    const exact = guesserPoints({ difficulty: "easy", timeLeftRatio: 1, correctRank: 1, priorStreak: 0 });
    const under = guesserPoints({ difficulty: "easy", timeLeftRatio: -3, correctRank: 1, priorStreak: 0 });
    expect(over).toBe(exact);
    expect(under).toBe(guesserPoints({ difficulty: "easy", timeLeftRatio: 0, correctRank: 1, priorStreak: 0 }));
  });
});

describe("streaks", () => {
  it("gives no bonus below three in a row", () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(1)).toBe(1);
  });

  it("kicks in on the third consecutive correct guess", () => {
    expect(streakMultiplier(2)).toBeCloseTo(1.1);
    expect(streakMultiplier(3)).toBeCloseTo(1.2);
  });

  it("caps the bonus at +50%", () => {
    expect(streakMultiplier(20)).toBe(1.5);
  });

  it("builds on a correct guess, resets on a miss, and ignores drawing turns", () => {
    expect(nextStreak(2, "correct")).toBe(3);
    expect(nextStreak(4, "missed")).toBe(0);
    expect(nextStreak(4, "drew")).toBe(4);
  });
});

describe("drawerPoints", () => {
  it("pays nothing when nobody guesses", () => {
    expect(drawerPoints({ difficulty: "hard", correctCount: 0, avgTimeLeftRatio: 0.9 })).toBe(0);
  });

  it("pays more as more players get it", () => {
    const one = drawerPoints({ difficulty: "medium", correctCount: 1, avgTimeLeftRatio: 0.5 });
    const three = drawerPoints({ difficulty: "medium", correctCount: 3, avgTimeLeftRatio: 0.5 });
    expect(three).toBeGreaterThan(one);
  });

  it("caps the drawer payout so a big room is not a jackpot", () => {
    const huge = drawerPoints({ difficulty: "easy", correctCount: 15, avgTimeLeftRatio: 1 });
    expect(huge).toBe(Math.round(BASE_POINTS.easy * 1.5));
  });

  it("doubles on a double-points turn", () => {
    const input = { difficulty: "easy", correctCount: 2, avgTimeLeftRatio: 0.5 } as const;
    expect(drawerPoints({ ...input, doublePoints: true })).toBe(drawerPoints(input) * 2);
  });
});

describe("power-up costs", () => {
  it("blocks a purchase the player cannot afford and never goes negative", () => {
    expect(canAfford(10, "hint")).toBe(false);
    expect(canAfford(25, "hint")).toBe(true);
    expect(spendPoints(30, "freeze")).toBe(0);
    expect(spendPoints(100, "hint")).toBe(75);
  });
});

describe("recap", () => {
  const stats = [
    { playerId: "a", guesses: 10, correct: 5, totalGuessMs: 50_000, bestStreak: 3, drawnTurns: 2, pointsFromDrawing: 300 },
    { playerId: "b", guesses: 8, correct: 4, totalGuessMs: 16_000, bestStreak: 2, drawnTurns: 2, pointsFromDrawing: 120 },
    { playerId: "c", guesses: 4, correct: 0, totalGuessMs: 0, bestStreak: 0, drawnTurns: 1, pointsFromDrawing: 0 },
  ];

  it("names the MVP artist by points earned while drawing", () => {
    expect(computeRecap(stats, []).mvpArtistId).toBe("a");
  });

  it("names the fastest guesser by average time, not total", () => {
    expect(computeRecap(stats, []).fastestGuesserId).toBe("b");
  });

  it("finds the most repeated wrong guess, ignoring one-offs", () => {
    const awards = computeRecap(stats, ["banana", "Banana ", "sock", "banana", "hat"]);
    expect(awards.funniestGuess).toEqual({ text: "banana", count: 3 });
  });

  it("returns no funny guess when nothing repeats", () => {
    expect(computeRecap(stats, ["sock", "hat"]).funniestGuess).toBeNull();
  });

  it("computes accuracy safely for a player who never guessed", () => {
    expect(accuracyPct(0, 0)).toBe(0);
    expect(accuracyPct(3, 4)).toBe(75);
  });
});
