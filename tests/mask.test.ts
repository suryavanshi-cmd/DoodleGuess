import { describe, expect, it } from "vitest";
import { maskWord, revealBudget, revealTimeline, revealedAt, wordShape } from "@/lib/game/mask";

describe("maskWord", () => {
  it("hides every letter before anything is revealed", () => {
    expect(maskWord("cat")).toBe("_ _ _");
  });

  it("keeps word shape visible for multi-word answers", () => {
    expect(maskWord("ice cream")).toBe("_ _ _   _ _ _ _ _");
    expect(wordShape("ice cream")).toEqual([3, 5]);
  });

  it("shows only the revealed indices", () => {
    expect(maskWord("rocket", [0, 5])).toBe("R _ _ _ _ T");
  });
});

describe("hint schedule", () => {
  it("never gives away more than 40% of the letters", () => {
    expect(revealBudget("helicopter", true)).toBe(4);
    expect(revealBudget("cat", true)).toBe(1);
  });

  it("reveals nothing when hints are off (hardcore mode)", () => {
    expect(revealBudget("helicopter", false)).toBe(0);
    expect(revealTimeline("helicopter", 60, { hintsEnabled: false, seed: "r1" })).toEqual([]);
  });

  it("is deterministic for a given round so every client agrees", () => {
    const a = revealTimeline("helicopter", 80, { hintsEnabled: true, seed: "round-1" });
    const b = revealTimeline("helicopter", 80, { hintsEnabled: true, seed: "round-1" });
    const other = revealTimeline("helicopter", 80, { hintsEnabled: true, seed: "round-2" });
    expect(a).toEqual(b);
    expect(a).not.toEqual(other);
  });

  it("holds the first hint back until the turn is nearly half gone", () => {
    const timeline = revealTimeline("helicopter", 80, { hintsEnabled: true, seed: "round-1" });
    expect(timeline[0].atMs).toBeGreaterThanOrEqual(80_000 * 0.45);
    expect(timeline.at(-1)!.atMs).toBeLessThanOrEqual(80_000 * 0.9);
    expect(revealedAt(timeline, 0)).toEqual([]);
    expect(revealedAt(timeline, 80_000)).toHaveLength(timeline.length);
  });
});
