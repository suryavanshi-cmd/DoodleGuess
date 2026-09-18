import { describe, expect, it } from "vitest";
import { canonicalize, containsProfanity, containsSecretWord, sanitizeName, screenMessage } from "@/lib/game/filter";

describe("profanity filter", () => {
  it("sees through leetspeak and padding", () => {
    expect(canonicalize("f_u_c_k")).toBe("fuck");
    expect(containsProfanity("sh1t")).toBe(true);
    expect(containsProfanity("$hit")).toBe(true);
  });

  it("blocks mild words only in strict mode (the mixed-age default)", () => {
    expect(containsProfanity("that's stupid", true)).toBe(true);
    expect(containsProfanity("that's stupid", false)).toBe(false);
  });

  it("blocks severe words even when the host relaxes the filter", () => {
    expect(containsProfanity("f u c k", false)).toBe(true);
  });

  it("leaves ordinary guesses alone", () => {
    expect(containsProfanity("helicopter")).toBe(false);
    expect(containsProfanity("class assignment")).toBe(false);
  });
});

describe("word-leak filter", () => {
  it("catches the word hidden inside a sentence", () => {
    expect(containsSecretWord("i think it is a rocket", "rocket")).toBe(true);
    expect(containsSecretWord("ROCKET!!", "rocket")).toBe(true);
  });

  it("does not flag unrelated chatter", () => {
    expect(containsSecretWord("nice drawing", "rocket")).toBe(false);
  });

  it("withholds a leaking message from the room", () => {
    const result = screenMessage("its obviously a rocket guys", { strict: true, secretWord: "rocket" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("word-leak");
    expect(result.publicText).toBe("");
  });

  it("lets the same message through once the round has ended", () => {
    const result = screenMessage("its obviously a rocket guys", { strict: true, secretWord: null });
    expect(result.allowed).toBe(true);
  });
});

describe("screenMessage", () => {
  it("rejects empty and oversized messages", () => {
    expect(screenMessage("   ", { strict: true }).reason).toBe("spam");
    expect(screenMessage("x".repeat(200), { strict: true }).reason).toBe("spam");
  });

  it("collapses whitespace on the way through", () => {
    expect(screenMessage("  nice   one  ", { strict: true }).publicText).toBe("nice one");
  });
});

describe("sanitizeName", () => {
  it("keeps friendly names and trims to length", () => {
    expect(sanitizeName("  Ana-Maria ")).toBe("Ana-Maria");
    expect(sanitizeName("x".repeat(40))).toHaveLength(16);
  });

  it("rejects profane or empty names", () => {
    expect(sanitizeName("sh1thead")).toBe("");
    expect(sanitizeName("!!!")).toBe("");
  });
});
