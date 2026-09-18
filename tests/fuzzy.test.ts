import { describe, expect, it } from "vitest";
import { evaluateGuess, fuzzyThreshold } from "@/lib/game/fuzzy";
import { editDistance, normalizeWord } from "@/lib/game/text";

describe("editDistance", () => {
  it("counts a transposition as a single edit", () => {
    expect(editDistance("hosue", "house")).toBe(1);
    expect(editDistance("teh", "the")).toBe(1);
  });

  it("measures single edits", () => {
    expect(editDistance("cat", "cat")).toBe(0);
    expect(editDistance("cat", "cot")).toBe(1);
    expect(editDistance("cat", "cats")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
  });

  it("handles empty strings", () => {
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("abc", "")).toBe(3);
  });

  it("exits early past the cap instead of doing the full matrix", () => {
    expect(editDistance("elephant", "xyz", 2)).toBeGreaterThan(2);
  });
});

describe("normalizeWord", () => {
  it("strips case, accents, punctuation and a leading article", () => {
    expect(normalizeWord("  The Café!  ")).toBe("cafe");
    expect(normalizeWord("ice-cream")).toBe("ice cream");
    expect(normalizeWord("a Robot")).toBe("robot");
  });
});

describe("fuzzyThreshold", () => {
  it("forgives nothing on short words and up to two edits on long ones", () => {
    expect(fuzzyThreshold(3)).toBe(0);
    expect(fuzzyThreshold(4)).toBe(0);
    expect(fuzzyThreshold(5)).toBe(1);
    expect(fuzzyThreshold(7)).toBe(1);
    expect(fuzzyThreshold(8)).toBe(2);
    expect(fuzzyThreshold(14)).toBe(2);
  });
});

describe("evaluateGuess", () => {
  it("accepts the exact word", () => {
    expect(evaluateGuess("rocket", "rocket").verdict).toBe("correct");
  });

  it("accepts a typo in a long word", () => {
    expect(evaluateGuess("elefant", "elephant").verdict).toBe("correct");
    expect(evaluateGuess("helicoptor", "helicopter").verdict).toBe("correct");
  });

  it("accepts two typos only once the word is long", () => {
    expect(evaluateGuess("stroberry", "strawberry").verdict).toBe("correct");
    expect(evaluateGuess("hosue", "house").verdict).toBe("correct");
  });

  it("refuses to guess for the player on short words, but says almost", () => {
    const result = evaluateGuess("cot", "cat");
    expect(result.verdict).toBe("close");
    expect(result.distance).toBe(1);
  });

  it("accepts plural and singular variants", () => {
    expect(evaluateGuess("dogs", "dog").verdict).toBe("correct");
    expect(evaluateGuess("box", "boxes").verdict).toBe("correct");
    expect(evaluateGuess("butterflies", "butterfly").verdict).toBe("correct");
  });

  it("ignores case, accents, punctuation and articles", () => {
    expect(evaluateGuess("  THE Café! ", "cafe").verdict).toBe("correct");
    expect(evaluateGuess("ice cream", "ice-cream").verdict).toBe("correct");
  });

  it("treats a sentence containing the word as a near miss, not a win", () => {
    const result = evaluateGuess("is it a rocket ship", "rocket");
    expect(result.verdict).toBe("close");
  });

  it("rejects unrelated words", () => {
    expect(evaluateGuess("banana", "rocket").verdict).toBe("wrong");
    expect(evaluateGuess("", "rocket").verdict).toBe("wrong");
  });

  it("does not let a one-letter word length trick through", () => {
    expect(evaluateGuess("a", "cat").verdict).toBe("wrong");
  });
});
