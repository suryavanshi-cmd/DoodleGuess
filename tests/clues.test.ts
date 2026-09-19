import { describe, expect, it } from "vitest";
import { CLUE_BANK, bankCluesFor } from "@/lib/game/clueBank";
import { CLUE_MAX_LENGTH, validateClue } from "@/lib/game/clues";
import { rhymeKey, rhymes, soundex } from "@/lib/game/phonetics";
import { isSynonym, synonymsOf } from "@/lib/game/synonyms";
import { SIMPLE_PACK, TRICKY_PACK } from "@/lib/game/words";

describe("phonetics", () => {
  it("codes similar-sounding words the same", () => {
    expect(soundex("robert")).toBe(soundex("rupert"));
    expect(soundex("cat")).not.toBe(soundex("dog"));
  });

  it("finds the rhyming tail of a word", () => {
    expect(rhymeKey("cat")).toBe("at");
    expect(rhymeKey("rocket")).toBe("et");
  });

  it("spots rhymes without matching a word to itself", () => {
    expect(rhymes("bat", "cat")).toBe(true);
    expect(rhymes("cat", "cat")).toBe(false);
    expect(rhymes("cat", "dog")).toBe(false);
  });
});

describe("validateClue", () => {
  it("accepts a fair descriptive clue", () => {
    const result = validateClue("Purrs and naps in sunbeams", "cat");
    expect(result.ok).toBe(true);
  });

  it("rejects an empty or overlong clue", () => {
    expect(validateClue("   ", "cat").reason).toBe("empty");
    expect(validateClue("x".repeat(CLUE_MAX_LENGTH + 1), "cat").reason).toBe("too-long");
  });

  it("rejects the word itself, inside other words, and its plural", () => {
    expect(validateClue("a small cat", "cat").reason).toBe("contains-word");
    expect(validateClue("think concatenate", "cat").reason).toBe("contains-word");
    expect(validateClue("lots of rockets fly", "rocket").reason).toBe("contains-word");
  });

  it("rejects a rhyme", () => {
    expect(validateClue("rhymes with bat", "cat").reason).toBe("rhymes");
  });

  it("rejects letter-by-letter spelling", () => {
    expect(validateClue("c a t animal", "cat").reason).toBe("spells-it-out");
  });

  it("rejects an acrostic that hides the word", () => {
    expect(validateClue("Curious Agile Tiger", "cat").reason).toBe("spells-it-out");
  });

  it("rejects profanity", () => {
    expect(validateClue("a bloody stupid animal", "cat").reason).toBe("profanity");
  });

  it("guards each part of a multi-word answer", () => {
    expect(validateClue("nervous feet before a wedding", "cold feet").reason).toBe("contains-word");
    expect(validateClue("Nerves before the big day", "cold feet").ok).toBe(true);
  });
});

describe("bundled clue bank", () => {
  const allWords = [...SIMPLE_PACK, ...TRICKY_PACK].map((entry) => entry.word);

  it("covers every word in the built-in packs with at least two clues", () => {
    const missing = allWords.filter((word) => bankCluesFor(word).length < 2);
    expect(missing).toEqual([]);
  });

  it("never gives its own word away", () => {
    const offenders: string[] = [];
    for (const [word, clues] of Object.entries(CLUE_BANK)) {
      for (const clue of clues) {
        const result = validateClue(clue, word);
        if (!result.ok) offenders.push(`${word}: "${clue}" -> ${result.reason}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps every clue within the character limit", () => {
    const tooLong = Object.entries(CLUE_BANK)
      .flatMap(([word, clues]) => clues.filter((c) => c.length > CLUE_MAX_LENGTH).map((c) => `${word}: ${c.length}`));
    expect(tooLong).toEqual([]);
  });
});

describe("offline synonyms", () => {
  it("matches in both directions", () => {
    expect(isSynonym("puppy", "dog")).toBe(true);
    expect(isSynonym("dog", "puppy")).toBe(true);
  });

  it("does not call a word a synonym of itself", () => {
    expect(isSynonym("dog", "dog")).toBe(false);
  });

  it("rejects unrelated words", () => {
    expect(isSynonym("helicopter", "dog")).toBe(false);
  });

  it("normalises case and spacing", () => {
    expect(isSynonym("  Bunny ", "rabbit")).toBe(true);
  });

  it("exposes the synonyms of a word", () => {
    expect(synonymsOf("bicycle")).toContain("bike");
  });
});
