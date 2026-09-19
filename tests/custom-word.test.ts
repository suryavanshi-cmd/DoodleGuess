import { beforeEach, describe, expect, it } from "vitest";
import { GameEngine, type AuthInput } from "@/lib/game/engine";
import { MemoryStore } from "@/lib/store/memory";
import { TIMING } from "@/lib/game/settings";
import { CUSTOM_WORD_MAX, validateCustomWord, wordAlreadySaid } from "@/lib/game/customWord";

let clock = Date.parse("2026-01-01T12:00:00.000Z");
const advance = (ms: number) => { clock += ms; };

function makeEngine() {
  clock = Date.parse("2026-01-01T12:00:00.000Z");
  let seed = 23;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  return new GameEngine(new MemoryStore(), { now: () => clock, random });
}

async function room(engine: GameEngine, settings: Record<string, unknown> = {}) {
  const host = await engine.createRoom({ name: "Ana", settings: { rounds: 3, turnSeconds: 60, ...settings } });
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
  return { code, auth, hostId: host.playerId, roundId: state.round!.id, drawerId: state.round!.drawerId! };
}

/** Roll on to the next turn so the drawer is somebody other than the host. */
async function nextTurn(engine: GameEngine, code: string) {
  advance(TIMING.pickSeconds * 1000 + 1_000);
  await engine.reconcile(code);
  advance(61_000);
  await engine.reconcile(code);
  advance(TIMING.intermissionSeconds * 1000 + 500);
  await engine.reconcile(code);
  const state = await engine.publicState(code, null);
  return { roundId: state.round!.id, drawerId: state.round!.drawerId! };
}

describe("validateCustomWord", () => {
  it("accepts a plain word", () => {
    expect(validateCustomWord("space rocket", { strict: true }).ok).toBe(true);
    expect(validateCustomWord("  ice-cream  ", { strict: true }).cleaned).toBe("ice-cream");
  });

  it("enforces the length limits", () => {
    expect(validateCustomWord("ok", { strict: true }).reason).toBe("too-short");
    expect(validateCustomWord("x".repeat(CUSTOM_WORD_MAX + 1), { strict: true }).reason).toBe("too-long");
  });

  it("allows letters, spaces and hyphens only", () => {
    expect(validateCustomWord("rocket9", { strict: true }).reason).toBe("charset");
    expect(validateCustomWord("rocket!", { strict: true }).reason).toBe("charset");
    expect(validateCustomWord("🚀 rocket", { strict: true }).reason).toBe("charset");
    expect(validateCustomWord("-rocket", { strict: true }).reason).toBe("charset");
  });

  it("runs the same filter as chat", () => {
    // Leetspeak never reaches the filter — digits fail the character set first.
    expect(validateCustomWord("sh1thead", { strict: true }).reason).toBe("charset");
    expect(validateCustomWord("shithead", { strict: true }).reason).toBe("profanity");
    expect(validateCustomWord("stupid", { strict: true }).reason).toBe("profanity");
    expect(validateCustomWord("stupid", { strict: false }).ok).toBe(true);
  });
});

describe("wordAlreadySaid", () => {
  it("catches the word already in the feed", () => {
    expect(wordAlreadySaid(["is it a rocket?"], "rocket")).toBe(true);
    expect(wordAlreadySaid(["rocket"], "rocket")).toBe(true);
  });

  it("leaves unrelated chatter alone", () => {
    expect(wordAlreadySaid(["nice drawing", "hello"], "rocket")).toBe(false);
  });
});

describe("custom words", () => {
  let engine: GameEngine;
  beforeEach(() => { engine = makeEngine(); });

  it("lets the drawer play their own word", async () => {
    const { code, auth, roundId, drawerId } = await room(engine);
    const result = await engine.submitCustomWord(roundId, auth[drawerId], "space rocket");
    expect(result.status).toBe("approved");

    const drawerView = await engine.publicState(code, drawerId);
    expect(drawerView.status).toBe("drawing");
    expect(drawerView.yourWord).toBe("space rocket");

    const guesserId = Object.keys(auth).find((id) => id !== drawerId)!;
    const guesserView = await engine.publicState(code, guesserId);
    expect(guesserView.yourWord).toBeNull();
    expect(guesserView.round?.maskedWord).toMatch(/^[_\s]+$/);
  });

  it("looks exactly like a normal round to guessers", async () => {
    const { code, auth, roundId, drawerId } = await room(engine);
    await engine.submitCustomWord(roundId, auth[drawerId], "space rocket");
    const guesserId = Object.keys(auth).find((id) => id !== drawerId)!;
    const view = await engine.publicState(code, guesserId);
    // Room settings mention custom words; the round must not say where the
    // word came from, which is the part that would change how people play.
    expect(JSON.stringify(view.round)).not.toContain("custom");
    expect(JSON.stringify(view)).not.toContain("word_source");
    expect(view.yourCustomWord).toBeNull();
    expect(view.hostApproval).toBeNull();
  });

  it("scores a custom word like any other", async () => {
    const { code, auth, roundId, drawerId } = await room(engine);
    await engine.submitCustomWord(roundId, auth[drawerId], "space rocket");
    const guesserId = Object.keys(auth).find((id) => id !== drawerId)!;
    advance(3_000);
    expect((await engine.submitGuess(code, auth[guesserId], "space rocket")).verdict).toBe("correct");
    const state = await engine.publicState(code, null);
    expect(state.players.find((p) => p.id === guesserId)!.score).toBeGreaterThan(0);
  });

  it("refuses a word from anyone but the drawer", async () => {
    const { auth, roundId, drawerId } = await room(engine);
    const otherId = Object.keys(auth).find((id) => id !== drawerId)!;
    await expect(engine.submitCustomWord(roundId, auth[otherId], "space rocket"))
      .rejects.toThrow(/not your turn/i);
  });

  it("refuses when the host has custom words switched off", async () => {
    const { auth, roundId, drawerId } = await room(engine, { allowCustomWords: false });
    await expect(engine.submitCustomWord(roundId, auth[drawerId], "space rocket"))
      .rejects.toThrow(/off in this room/i);
  });

  it("blocks an inappropriate word", async () => {
    const { auth, roundId, drawerId } = await room(engine);
    await expect(engine.submitCustomWord(roundId, auth[drawerId], "shithead"))
      .rejects.toThrow(/friendlier/i);
    // Digits are refused outright, so leetspeak never gets a second chance.
    await expect(engine.submitCustomWord(roundId, auth[drawerId], "sh1thead"))
      .rejects.toThrow(/letters, spaces and hyphens/i);
  });

  it("blocks a word already said in the room", async () => {
    const { code, auth, roundId, drawerId } = await room(engine);
    const talkerId = Object.keys(auth).find((id) => id !== drawerId)!;
    await engine.sendChat(code, auth[talkerId], "maybe a rocket next time");
    await expect(engine.submitCustomWord(roundId, auth[drawerId], "rocket"))
      .rejects.toThrow(/already been said/i);
  });

  it("defaults custom words off in public rooms, on in private", async () => {
    const publicHost = await engine.createRoom({ name: "Pub", settings: { isPublic: true } });
    expect(publicHost.room.settings.allowCustomWords).toBe(false);
    const privateHost = await engine.createRoom({ name: "Priv", settings: { isPublic: false } });
    expect(privateHost.room.settings.allowCustomWords).toBe(true);
  });

  it("saves and reuses a player's own words", async () => {
    const { code, auth, roundId, drawerId } = await room(engine);
    await engine.submitCustomWord(roundId, auth[drawerId], "space rocket", { save: true });
    const saved = await engine.listMyWords(code, auth[drawerId]);
    expect(saved.words).toContain("space rocket");
  });
});

describe("host approval", () => {
  let engine: GameEngine;
  beforeEach(() => { engine = makeEngine(); });

  async function pendingRoom() {
    const base = await room(engine, { requireHostApproval: true });
    // Turn one is the host's own turn, which needs no approval.
    const turn = await nextTurn(engine, base.code);
    return { ...base, ...turn };
  }

  it("holds the word for the host and tells nobody else", async () => {
    const { code, auth, roundId, drawerId, hostId } = await pendingRoom();
    expect(drawerId).not.toBe(hostId);
    const result = await engine.submitCustomWord(roundId, auth[drawerId], "space rocket");
    expect(result.status).toBe("pending");

    const hostView = await engine.publicState(code, hostId);
    expect(hostView.hostApproval?.word).toBe("space rocket");

    const guesserId = Object.keys(auth).find((id) => id !== drawerId && id !== hostId)!;
    const guesserView = await engine.publicState(code, guesserId);
    expect(guesserView.hostApproval).toBeNull();
    expect(JSON.stringify(guesserView)).not.toContain("space rocket");
    expect(guesserView.status).toBe("picking");

    const drawerView = await engine.publicState(code, drawerId);
    expect(drawerView.yourCustomWord).toEqual({ word: "space rocket", status: "pending" });
  });

  it("starts the turn once the host approves", async () => {
    const { code, auth, roundId, drawerId, hostId } = await pendingRoom();
    await engine.submitCustomWord(roundId, auth[drawerId], "space rocket");
    await engine.resolveCustomWord(roundId, auth[hostId], true);

    const state = await engine.publicState(code, drawerId);
    expect(state.status).toBe("drawing");
    expect(state.yourWord).toBe("space rocket");
  });

  it("returns the drawer to the pick screen when the host says no", async () => {
    const { code, auth, roundId, drawerId, hostId } = await pendingRoom();
    await engine.submitCustomWord(roundId, auth[drawerId], "space rocket");
    await engine.resolveCustomWord(roundId, auth[hostId], false);

    const state = await engine.publicState(code, drawerId);
    expect(state.status).toBe("picking");
    expect(state.yourCustomWord?.status).toBe("rejected");
    expect(state.yourChoices).toHaveLength(3);
    // There is still clock left to choose again.
    expect(Date.parse(state.round!.endsAt ?? state.serverTime)).toBeGreaterThanOrEqual(0);
  });

  it("only the host decides", async () => {
    const { auth, roundId, drawerId, hostId } = await pendingRoom();
    await engine.submitCustomWord(roundId, auth[drawerId], "space rocket");
    const otherId = Object.keys(auth).find((id) => id !== hostId)!;
    await expect(engine.resolveCustomWord(roundId, auth[otherId], true)).rejects.toThrow(/host/i);
  });

  it("falls back to a suggestion if the host never answers", async () => {
    const { code, auth, roundId, drawerId } = await pendingRoom();
    await engine.submitCustomWord(roundId, auth[drawerId], "space rocket");

    advance(TIMING.customApprovalSeconds * 1000 + 1_000);
    await engine.reconcile(code);

    const state = await engine.publicState(code, drawerId);
    expect(state.status).toBe("drawing");
    expect(state.yourWord).toBeTruthy();
    expect(state.yourWord).not.toBe("space rocket");
  });

  it("needs no approval when the host is the one drawing", async () => {
    const { auth, roundId, drawerId, hostId } = await room(engine, { requireHostApproval: true });
    expect(drawerId).toBe(hostId);
    const result = await engine.submitCustomWord(roundId, auth[drawerId], "space rocket");
    expect(result.status).toBe("approved");
  });
});
