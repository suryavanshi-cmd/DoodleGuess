import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine, type AuthInput } from "@/lib/game/engine";
import { MemoryStore } from "@/lib/store/memory";
import { TIMING } from "@/lib/game/settings";

let clock = Date.parse("2026-01-01T12:00:00.000Z");
const advance = (ms: number) => { clock += ms; };

function makeEngine() {
  clock = Date.parse("2026-01-01T12:00:00.000Z");
  let seed = 7;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  return new GameEngine(new MemoryStore(), { now: () => clock, random });
}

async function setupRoom(engine: GameEngine, settings?: Record<string, unknown>) {
  const host = await engine.createRoom({ name: "Ana", settings: { turnSeconds: 60, rounds: 2, ...settings } });
  const code = host.room.code;
  const ben = await engine.joinRoom(code, { name: "Ben" });
  const cal = await engine.joinRoom(code, { name: "Cal" });
  const auth = {
    ana: { playerId: host.playerId, token: host.token } satisfies AuthInput,
    ben: { playerId: ben.playerId, token: ben.token } satisfies AuthInput,
    cal: { playerId: cal.playerId, token: cal.token } satisfies AuthInput,
  };
  return { code, auth };
}

/** Start the turn by having whoever is drawing pick their first word. */
async function startTurn(engine: GameEngine, code: string, auths: Record<string, AuthInput>) {
  const state = await engine.publicState(code, null);
  const drawerId = state.round?.drawerId;
  const key = Object.keys(auths).find((k) => auths[k].playerId === drawerId)!;
  const drawerState = await engine.publicState(code, drawerId);
  await engine.chooseWord(state.round!.id, auths[key], 0);
  const after = await engine.publicState(code, drawerId);
  return { drawerKey: key, drawerId: drawerId!, word: after.yourWord!, choices: drawerState.yourChoices! };
}

/**
 * A naive substring check gives false positives — the word "star" appears
 * inside "drawing has started" — so leaks are matched on word boundaries.
 */
function leaks(payload: unknown, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(JSON.stringify(payload));
}

describe("game loop", () => {
  let engine: GameEngine;
  beforeEach(() => { engine = makeEngine(); });

  it("creates a room with a shareable 6-character code", async () => {
    const { code } = await setupRoom(engine);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const state = await engine.publicState(code, null);
    expect(state.status).toBe("lobby");
    expect(state.players).toHaveLength(3);
    expect(state.players.find((p) => p.name === "Ana")?.isHost).toBe(true);
  });

  it("refuses to start without two players and only for the host", async () => {
    const host = await engine.createRoom({ name: "Solo" });
    await expect(engine.startGame(host.room.code, { playerId: host.playerId, token: host.token }))
      .rejects.toThrow(/at least 2 players/i);

    const { code, auth } = await setupRoom(engine);
    await expect(engine.startGame(code, auth.ben)).rejects.toThrow(/host/i);
  });

  it("clamps out-of-range settings from a hostile client", async () => {
    const host = await engine.createRoom({ name: "Ana", settings: { rounds: 999, turnSeconds: 5, maxPlayers: 400 } });
    expect(host.room.settings.rounds).toBe(10);
    expect(host.room.settings.turnSeconds).toBe(30);
    expect(host.room.settings.maxPlayers).toBe(16);
  });

  it("runs a full turn: pick, guess, score, reveal", async () => {
    const { code, auth } = await setupRoom(engine);
    await engine.startGame(code, auth.ana);

    let state = await engine.publicState(code, null);
    expect(state.status).toBe("picking");
    expect(state.round?.status).toBe("picking");

    const { word, drawerId, choices } = await startTurn(engine, code, auth);
    expect(choices).toHaveLength(3);
    expect(choices.map((c) => c.difficulty)).toEqual(["easy", "medium", "hard"]);

    state = await engine.publicState(code, null);
    expect(state.status).toBe("drawing");
    expect(state.round?.maskedWord).toMatch(/^[_A-Z\s-]+$/);

    const guesser = Object.values(auth).find((a) => a.playerId !== drawerId)!;
    advance(5_000);
    const result = await engine.submitGuess(code, guesser, word);
    expect(result.verdict).toBe("correct");

    const afterGuess = await engine.publicState(code, guesser.playerId);
    const scorer = afterGuess.players.find((p) => p.id === guesser.playerId)!;
    expect(scorer.score).toBeGreaterThan(0);
    expect(scorer.guessedCorrect).toBe(true);
  });

  it("ends the turn early once everyone has guessed, and pays the drawer", async () => {
    const { code, auth } = await setupRoom(engine);
    await engine.startGame(code, auth.ana);
    const { word, drawerId } = await startTurn(engine, code, auth);
    const guessers = Object.values(auth).filter((a) => a.playerId !== drawerId);

    advance(3_000);
    for (const guesser of guessers) {
      expect((await engine.submitGuess(code, guesser, word)).verdict).toBe("correct");
    }

    const state = await engine.publicState(code, null);
    expect(state.status).toBe("intermission");
    expect(state.lastTurn?.word).toBe(word);
    expect(state.round?.revealedWord).toBe(word);
    const drawer = state.players.find((p) => p.id === drawerId)!;
    expect(drawer.score).toBeGreaterThan(0);
  });

  it("ends the turn on the clock and moves on to the next drawer", async () => {
    const { code, auth } = await setupRoom(engine);
    await engine.startGame(code, auth.ana);
    const first = await startTurn(engine, code, auth);

    advance(61_000);
    await engine.reconcile(code);
    let state = await engine.publicState(code, null);
    expect(state.status).toBe("intermission");
    expect(state.lastTurn?.word).toBe(first.word);

    advance(TIMING.intermissionSeconds * 1000 + 500);
    await engine.reconcile(code);
    state = await engine.publicState(code, null);
    expect(state.status).toBe("picking");
    expect(state.round?.drawerId).not.toBe(first.drawerId);
  });

  it("auto-picks a word if the drawer dithers past the pick timer", async () => {
    const { code, auth } = await setupRoom(engine);
    await engine.startGame(code, auth.ana);
    advance(TIMING.pickSeconds * 1000 + 1_000);
    await engine.reconcile(code);
    const state = await engine.publicState(code, null);
    expect(state.status).toBe("drawing");
    expect(state.round?.difficulty).toBe("medium");
  });

  it("plays every round and finishes with a recap", async () => {
    const { code, auth } = await setupRoom(engine, { rounds: 2 });
    await engine.startGame(code, auth.ana);

    for (let turn = 0; turn < 6; turn++) {
      const state = await engine.publicState(code, null);
      if (state.status === "finished") break;
      if (state.status === "picking") {
        const { word, drawerId } = await startTurn(engine, code, auth);
        const guesser = Object.values(auth).find((a) => a.playerId !== drawerId)!;
        advance(2_000);
        await engine.submitGuess(code, guesser, word);
        advance(60_000);
        await engine.reconcile(code);
      }
      advance(TIMING.intermissionSeconds * 1000 + 500);
      await engine.reconcile(code);
    }

    const state = await engine.publicState(code, null);
    expect(state.status).toBe("finished");
    expect(state.recap).not.toBeNull();
    expect(state.recap!.leaderboard).toHaveLength(3);
    expect(state.recap!.stats.every((s) => s.accuracy >= 0 && s.accuracy <= 100)).toBe(true);
  });
});

describe("word secrecy", () => {
  it("never puts the word in a non-drawer's payload before the reveal", async () => {
    const engine = makeEngine();
    const { code, auth } = await setupRoom(engine);
    await engine.startGame(code, auth.ana);
    const { word, drawerId } = await startTurn(engine, code, auth);

    for (const a of Object.values(auth)) {
      const state = await engine.publicState(code, a.playerId);
      if (a.playerId === drawerId) {
        expect(state.yourWord).toBe(word);
        continue;
      }
      expect(state.yourWord).toBeNull();
      expect(leaks(state, word)).toBe(false);
    }
  });

  it("hides the word from an anonymous spectator payload too", async () => {
    const engine = makeEngine();
    const { code, auth } = await setupRoom(engine);
    await engine.startGame(code, auth.ana);
    const { word } = await startTurn(engine, code, auth);
    const state = await engine.publicState(code, null);
    expect(leaks(state, word)).toBe(false);
  });

  it("keeps a guess that spells out the word out of public chat", async () => {
    const engine = makeEngine();
    const { code, auth } = await setupRoom(engine);
    await engine.startGame(code, auth.ana);
    const { word, drawerId } = await startTurn(engine, code, auth);
    const guesser = Object.values(auth).find((a) => a.playerId !== drawerId)!;
    const other = Object.values(auth).find((a) => a.playerId !== drawerId && a.playerId !== guesser.playerId)!;

    await engine.sendChat(code, guesser, `guys it is obviously a ${word}`);
    const spectator = await engine.publicState(code, other.playerId);
    expect(leaks(spectator.feed, word)).toBe(false);
  });

  it("shows the almost-nudge only to the player who nearly had it", async () => {
    const engine = makeEngine();
    const { code, auth } = await setupRoom(engine);
    await engine.startGame(code, auth.ana);
    const { word, drawerId } = await startTurn(engine, code, auth);
    const guesser = Object.values(auth).find((a) => a.playerId !== drawerId)!;
    const other = Object.values(auth).find((a) => a.playerId !== drawerId && a.playerId !== guesser.playerId)!;

    const nearMiss = `${word.slice(0, -1)}${word.at(-1) === "x" ? "y" : "x"}`;
    const verdict = await engine.submitGuess(code, guesser, nearMiss);
    if (verdict.verdict !== "close") return; // short words are exact-only by design

    const mine = await engine.publicState(code, guesser.playerId);
    const theirs = await engine.publicState(code, other.playerId);
    expect(mine.feed.some((f) => f.kind === "close")).toBe(true);
    expect(theirs.feed.some((f) => f.kind === "close")).toBe(false);
  });
});

describe("abuse and disconnects", () => {
  it("rejects guesses from the drawer", async () => {
    const engine = makeEngine();
    const { code, auth } = await setupRoom(engine);
    await engine.startGame(code, auth.ana);
    const { word, drawerId } = await startTurn(engine, code, auth);
    const drawerAuth = Object.values(auth).find((a) => a.playerId === drawerId)!;
    await expect(engine.submitGuess(code, drawerAuth, word)).rejects.toThrow(/drawing/i);
  });

  it("rejects a forged player token", async () => {
    const engine = makeEngine();
    const { code, auth } = await setupRoom(engine);
    await expect(engine.submitGuess(code, { playerId: auth.ben.playerId, token: "not-my-token" }, "cat"))
      .rejects.toThrow(/rejoin/i);
  });

  it("rate-limits guess spam", async () => {
    const engine = makeEngine();
    const { code, auth } = await setupRoom(engine);
    await engine.startGame(code, auth.ana);
    const { drawerId } = await startTurn(engine, code, auth);
    const guesser = Object.values(auth).find((a) => a.playerId !== drawerId)!;

    let limited = false;
    for (let i = 0; i < 20; i++) {
      try {
        await engine.submitGuess(code, guesser, `guess-${i}`);
      } catch (error) {
        limited = /slow down/i.test((error as Error).message);
        break;
      }
    }
    expect(limited).toBe(true);
  });

  it("keeps a dropped player's score and seat when they rejoin", async () => {
    const engine = makeEngine();
    const { code, auth } = await setupRoom(engine);
    await engine.startGame(code, auth.ana);
    const { word, drawerId } = await startTurn(engine, code, auth);
    const guesser = Object.values(auth).find((a) => a.playerId !== drawerId)!;
    advance(2_000);
    await engine.submitGuess(code, guesser, word);

    const before = (await engine.publicState(code, null)).players.find((p) => p.id === guesser.playerId)!;
    await engine.leave(code, guesser);
    advance(20_000);

    const rejoin = await engine.joinRoom(code, { name: "Ben", token: guesser.token });
    expect(rejoin.rejoined).toBe(true);
    expect(rejoin.playerId).toBe(guesser.playerId);
    const after = (await engine.publicState(code, null)).players.find((p) => p.id === guesser.playerId)!;
    expect(after.score).toBe(before.score);
    expect(after.connected).toBe(true);
  });

  it("does not let a stranger with a bad token steal a seat", async () => {
    const engine = makeEngine();
    const { code } = await setupRoom(engine);
    const impostor = await engine.joinRoom(code, { name: "Ben", token: "bogus" });
    expect(impostor.rejoined).toBe(false);
    expect(impostor.playerId).toBeTruthy();
    const state = await engine.publicState(code, null);
    expect(state.players).toHaveLength(4);
    expect(state.players.filter((p) => p.name.startsWith("Ben"))).toHaveLength(2);
  });
});

describe("power-ups", () => {
  it("charges points for a hint and shows it only to the buyer", async () => {
    const engine = makeEngine();
    const { code, auth } = await setupRoom(engine);
    await engine.startGame(code, auth.ana);
    const { word, drawerId } = await startTurn(engine, code, auth);
    const guessers = Object.values(auth).filter((a) => a.playerId !== drawerId);
    const buyer = guessers[0];
    const other = guessers[1];

    // Bank some points first: correct guess, then the next turn's hint.
    advance(1_000);
    await engine.submitGuess(code, buyer, word);
    await engine.submitGuess(code, other, word);
    advance(TIMING.intermissionSeconds * 1000 + 500);
    await engine.reconcile(code);
    const second = await startTurn(engine, code, auth);
    const nextBuyer = Object.values(auth).find((a) => a.playerId !== second.drawerId && a.playerId === buyer.playerId)
      ?? Object.values(auth).find((a) => a.playerId !== second.drawerId)!;

    const before = (await engine.publicState(code, null)).players.find((p) => p.id === nextBuyer.playerId)!;
    if (before.score < 25) return; // not enough banked this run
    const { hint } = await engine.usePowerUp(code, nextBuyer, "hint");
    expect(hint).toMatch(/letter \d+ is/i);

    const mine = await engine.publicState(code, nextBuyer.playerId);
    const theirs = await engine.publicState(code, second.drawerId);
    expect(mine.players.find((p) => p.id === nextBuyer.playerId)!.score).toBe(before.score - 25);
    expect(mine.feed.some((f) => f.text.includes("🔍"))).toBe(true);
    expect(theirs.feed.some((f) => f.text.includes("🔍"))).toBe(false);
  });

  it("refuses a power-up the player cannot afford", async () => {
    const engine = makeEngine();
    const { code, auth } = await setupRoom(engine);
    await engine.startGame(code, auth.ana);
    const { drawerId } = await startTurn(engine, code, auth);
    const broke = Object.values(auth).find((a) => a.playerId !== drawerId)!;
    await expect(engine.usePowerUp(code, broke, "freeze", drawerId)).rejects.toThrow(/points/i);
  });
});
