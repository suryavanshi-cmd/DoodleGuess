import { beforeAll, describe, expect, it } from "vitest";
import { GameEngine } from "@/lib/game/engine";
import { SupabaseStore, createServiceClient } from "@/lib/store/supabase";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && key);

/**
 * Runs the same loop as the in-memory tests, but against a real Supabase
 * project — it is the only way to catch column/type mismatches that the unit
 * tests cannot see. Skipped automatically when credentials are absent.
 */
describe.skipIf(!configured)("supabase store (integration)", () => {
  let engine: GameEngine;
  let db: ReturnType<typeof createServiceClient>;
  const createdRooms: string[] = [];

  beforeAll(() => {
    db = createServiceClient(url as string, key as string);
    engine = new GameEngine(new SupabaseStore(db));
  });

  it("plays a turn end to end against Postgres", async () => {
    const host = await engine.createRoom({ name: "IntAna", settings: { rounds: 2, turnSeconds: 60 } });
    createdRooms.push(host.room.id);
    const code = host.room.code;
    const ben = await engine.joinRoom(code, { name: "IntBen" });
    const cal = await engine.joinRoom(code, { name: "IntCal" });

    const auth = {
      [host.playerId]: { playerId: host.playerId, token: host.token },
      [ben.playerId]: { playerId: ben.playerId, token: ben.token },
      [cal.playerId]: { playerId: cal.playerId, token: cal.token },
    };

    await engine.startGame(code, auth[host.playerId]);
    const picking = await engine.publicState(code, null);
    expect(picking.status).toBe("picking");

    const drawerId = picking.round!.drawerId!;
    await engine.chooseWord(picking.round!.id, auth[drawerId], 0);

    const drawerView = await engine.publicState(code, drawerId);
    const word = drawerView.yourWord!;
    expect(word).toBeTruthy();

    const guesserIds = Object.keys(auth).filter((id) => id !== drawerId);
    const guesserView = await engine.publicState(code, guesserIds[0]);
    expect(guesserView.yourWord).toBeNull();
    // Word boundaries: "star" would otherwise match inside "started".
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(new RegExp(`\\b${escaped}\\b`, "i").test(JSON.stringify(guesserView))).toBe(false);

    expect((await engine.submitGuess(code, auth[guesserIds[0]], "definitely a banana")).verdict).toBe("wrong");
    expect((await engine.submitGuess(code, auth[guesserIds[0]], word)).verdict).toBe("correct");
    expect((await engine.submitGuess(code, auth[guesserIds[1]], word)).verdict).toBe("correct");

    const ended = await engine.publicState(code, null);
    expect(ended.status).toBe("intermission");
    expect(ended.lastTurn?.word).toBe(word);
    expect(ended.players.find((p) => p.id === drawerId)!.score).toBeGreaterThan(0);

    // The live word must never have been written anywhere a guesser can read.
    const { data: roundRows } = await db.from("rounds").select("id, revealed_word").eq("room_id", host.room.id);
    expect(roundRows?.every((r) => r.revealed_word === null || r.revealed_word === word)).toBe(true);

    await db.from("rooms").delete().eq("id", host.room.id);
  }, 60_000);

  it("persists and reads back strokes for the replay", async () => {
    const host = await engine.createRoom({ name: "IntDraw" });
    createdRooms.push(host.room.id);
    const guest = await engine.joinRoom(host.room.code, { name: "IntGuest" });
    await engine.startGame(host.room.code, { playerId: host.playerId, token: host.token });

    const state = await engine.publicState(host.room.code, null);
    const drawerId = state.round!.drawerId!;
    const drawerAuth = drawerId === host.playerId
      ? { playerId: host.playerId, token: host.token }
      : { playerId: guest.playerId, token: guest.token };
    await engine.chooseWord(state.round!.id, drawerAuth, 0);

    await engine.saveStrokes(host.room.code, drawerAuth, [
      { id: "s1", kind: "free", color: "#111827", size: 6, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] },
      { id: "s2", kind: "rect", color: "#ef4444", size: 4, points: [{ x: 5, y: 6 }, { x: 7, y: 8 }] },
    ], true);

    const strokes = await engine.listStrokes(state.round!.id);
    expect(strokes).toHaveLength(2);
    expect(strokes[1].kind).toBe("rect");

    await db.from("rooms").delete().eq("id", host.room.id);
  }, 60_000);
});
