import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine, GameError, type AuthInput } from "@/lib/game/engine";
import { MemoryStore } from "@/lib/store/memory";
import { TIMING } from "@/lib/game/settings";
import { SYNONYM_POINTS_FACTOR } from "@/lib/game/scoring";
import { synonymsOf } from "@/lib/game/synonyms";

let clock = Date.parse("2026-01-01T12:00:00.000Z");
const advance = (ms: number) => { clock += ms; };

function makeEngine() {
  clock = Date.parse("2026-01-01T12:00:00.000Z");
  let seed = 11;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  return new GameEngine(new MemoryStore(), { now: () => clock, random });
}

async function textRoom(engine: GameEngine) {
  const host = await engine.createRoom({
    name: "Ana",
    settings: { gameMode: "text_clue", rounds: 2, turnSeconds: 60 },
  });
  const code = host.room.code;
  const ben = await engine.joinRoom(code, { name: "Ben" });
  const cal = await engine.joinRoom(code, { name: "Cal" });
  const auth: Record<string, AuthInput> = {
    [host.playerId]: { playerId: host.playerId, token: host.token },
    [ben.playerId]: { playerId: ben.playerId, token: ben.token },
    [cal.playerId]: { playerId: cal.playerId, token: cal.token },
  };
  await engine.startGame(code, auth[host.playerId]);
  const state = await engine.publicState(code, null);
  const giverId = state.round!.drawerId!;
  await engine.chooseWord(state.round!.id, auth[giverId], 0);
  const giverView = await engine.publicState(code, giverId);
  const guessers = Object.keys(auth).filter((id) => id !== giverId);
  return { code, auth, giverId, guessers, roundId: state.round!.id, word: giverView.yourWord! };
}

describe("text-clue mode", () => {
  let engine: GameEngine;
  beforeEach(() => { engine = makeEngine(); });

  it("waits for a clue before opening guessing", async () => {
    const { code, word } = await textRoom(engine);
    const state = await engine.publicState(code, null);
    expect(state.status).toBe("clue");
    expect(state.round?.status).toBe("clue");
    expect(state.round?.clueText).toBeNull();
    expect(state.round?.endsAt).toBeNull();
    expect(word).toBeTruthy();
  });

  it("refuses a guess while the clue is still being written", async () => {
    const { code, auth, guessers, word } = await textRoom(engine);
    await expect(engine.submitGuess(code, auth[guessers[0]], word)).rejects.toThrow(/nothing to guess/i);
  });

  it("rejects a clue that gives the word away, and says why", async () => {
    const { auth, giverId, roundId, word } = await textRoom(engine);
    await expect(engine.submitClue(roundId, auth[giverId], `it is a ${word}`))
      .rejects.toThrow(/gives the word away/i);
    await expect(engine.submitClue(roundId, auth[giverId], "rhymes with something"))
      .rejects.toThrow(/sound of the word/i);
  });

  it("only lets the Clue-Giver write the clue", async () => {
    const { auth, guessers, roundId } = await textRoom(engine);
    await expect(engine.submitClue(roundId, auth[guessers[0]], "A thing you know"))
      .rejects.toThrow(/Clue-Giver/i);
  });

  it("opens guessing once a valid clue lands, and shows it to everyone", async () => {
    const { code, auth, giverId, guessers, roundId, word } = await textRoom(engine);
    await engine.submitClue(roundId, auth[giverId], "Something you might find nearby");

    const state = await engine.publicState(code, guessers[0]);
    expect(state.status).toBe("drawing");
    expect(state.round?.clueText).toBe("Something you might find nearby");
    expect(state.round?.clueSource).toBe("human");
    expect(state.round?.endsAt).not.toBeNull();
    // The clue is public; the answer still is not.
    expect(state.yourWord).toBeNull();
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(new RegExp(`\\b${escaped}\\b`, "i").test(JSON.stringify(state))).toBe(false);
  });

  it("scores an exact guess in full", async () => {
    const { code, auth, giverId, guessers, roundId, word } = await textRoom(engine);
    await engine.submitClue(roundId, auth[giverId], "Something you might find nearby");
    advance(3_000);
    expect((await engine.submitGuess(code, auth[guessers[0]], word)).verdict).toBe("correct");
    const state = await engine.publicState(code, null);
    expect(state.players.find((p) => p.id === guessers[0])!.score).toBeGreaterThan(0);
  });

  it("gives a synonym reduced points and tags it as very close", async () => {
    const engineWithSynonym = makeEngine();
    // Keep drawing words until the chosen one has a synonym to test with.
    let room = await textRoom(engineWithSynonym);
    for (let attempt = 0; attempt < 12 && synonymsOf(room.word).length === 0; attempt++) {
      await engineWithSynonym.submitClue(room.roundId, room.auth[room.giverId], "A thing that exists");
      advance(61_000);
      await engineWithSynonym.reconcile(room.code);
      advance(TIMING.intermissionSeconds * 1000 + 500);
      await engineWithSynonym.reconcile(room.code);
      const next = await engineWithSynonym.publicState(room.code, null);
      if (next.status !== "picking") break;
      const giverId = next.round!.drawerId!;
      await engineWithSynonym.chooseWord(next.round!.id, room.auth[giverId], 0);
      const view = await engineWithSynonym.publicState(room.code, giverId);
      room = { ...room, giverId, roundId: next.round!.id, word: view.yourWord!,
        guessers: Object.keys(room.auth).filter((id) => id !== giverId) };
    }
    const synonym = synonymsOf(room.word)[0];
    if (!synonym) return; // no synonym came up in this run

    await engineWithSynonym.submitClue(room.roundId, room.auth[room.giverId], "Guess what this might be");

    // Compare what this turn paid, not career totals: the loop above may have
    // banked points in earlier turns, which made this assertion flaky.
    const before = await engineWithSynonym.publicState(room.code, null);
    const scoreOf = (state: { players: { id: string; score: number }[] }, id: string) =>
      state.players.find((p) => p.id === id)!.score;

    advance(2_000);
    const verdict = await engineWithSynonym.submitGuess(room.code, room.auth[room.guessers[0]], synonym);
    expect(verdict.verdict).toBe("correct");

    const mid = await engineWithSynonym.publicState(room.code, room.guessers[0]);
    expect(mid.feed.some((f) => f.kind === "synonym")).toBe(true);

    // The exact answer from the other guesser must pay more than the synonym.
    const exact = await engineWithSynonym.submitGuess(room.code, room.auth[room.guessers[1]], room.word);
    expect(exact.verdict).toBe("correct");

    const after = await engineWithSynonym.publicState(room.code, null);
    const synonymGain = scoreOf(after, room.guessers[0]) - scoreOf(before, room.guessers[0]);
    const exactGain = scoreOf(after, room.guessers[1]) - scoreOf(before, room.guessers[1]);
    expect(synonymGain).toBeGreaterThan(0);
    expect(synonymGain).toBeLessThan(exactGain);
    expect(synonymGain / exactGain).toBeLessThanOrEqual(SYNONYM_POINTS_FACTOR + 0.2);
  });

  it("falls back to the bundled clue bank if the Clue-Giver runs out of time", async () => {
    const { code } = await textRoom(engine);
    advance(TIMING.clueSeconds * 1000 + 1_000);
    await engine.reconcile(code);
    const state = await engine.publicState(code, null);
    expect(state.status).toBe("drawing");
    expect(state.round?.clueSource).toBe("clue_bank");
    expect(state.round?.clueText).toBeTruthy();
  });

  it("offers bank suggestions to the Clue-Giver only", async () => {
    const { auth, giverId, guessers, roundId } = await textRoom(engine);
    const { clues } = await engine.clueSuggestions(roundId, auth[giverId]);
    expect(clues.length).toBeGreaterThan(0);
    await expect(engine.clueSuggestions(roundId, auth[guessers[0]])).rejects.toThrow(GameError);
  });

  it("keeps the clue and match types in the round summary", async () => {
    const { code, auth, giverId, guessers, roundId, word } = await textRoom(engine);
    await engine.submitClue(roundId, auth[giverId], "Have a think about this one");
    advance(2_000);
    await engine.submitGuess(code, auth[guessers[0]], word);
    await engine.submitGuess(code, auth[guessers[1]], word);

    const state = await engine.publicState(code, null);
    expect(state.status).toBe("intermission");
    expect(state.lastTurn?.clueText).toBe("Have a think about this one");
    expect(state.lastTurn?.clueSource).toBe("human");
    expect(state.lastTurn?.matches?.every((m) => m.matchType === "exact")).toBe(true);
  });

  it("remembers a human clue that worked, so the bank grows from play", async () => {
    const { code, auth, giverId, guessers, roundId, word } = await textRoom(engine);
    await engine.submitClue(roundId, auth[giverId], "Have a think about this one");
    advance(2_000);
    await engine.submitGuess(code, auth[guessers[0]], word);
    await engine.submitGuess(code, auth[guessers[1]], word);

    const { clues } = await engine.clueSuggestions(roundId, auth[giverId]);
    expect(clues).toContain("Have a think about this one");
  });

  it("leaves drawing mode untouched: no synonym credit there", async () => {
    const drawEngine = makeEngine();
    const host = await drawEngine.createRoom({ name: "Ana", settings: { rounds: 2, turnSeconds: 60 } });
    const code = host.room.code;
    const ben = await drawEngine.joinRoom(code, { name: "Ben" });
    const auth: Record<string, AuthInput> = {
      [host.playerId]: { playerId: host.playerId, token: host.token },
      [ben.playerId]: { playerId: ben.playerId, token: ben.token },
    };
    await drawEngine.startGame(code, auth[host.playerId]);
    const state = await drawEngine.publicState(code, null);
    expect(state.status).toBe("picking");
    const drawerId = state.round!.drawerId!;
    await drawEngine.chooseWord(state.round!.id, auth[drawerId], 0);
    const after = await drawEngine.publicState(code, null);
    expect(after.status).toBe("drawing");
    expect(after.round?.clueText).toBeNull();
  });
});
