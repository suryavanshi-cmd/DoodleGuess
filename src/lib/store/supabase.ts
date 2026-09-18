import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  FeedRow, GameStore, GuessRow, PlayerRow, RoomRow, RoundRow, RoundSecretRow, StrokeRow, WordPackRow,
} from "./types";

const TABLES = {
  rooms: "rooms",
  players: "players",
  rounds: "rounds",
  secrets: "round_secrets",
  guesses: "guesses",
  feed: "feed_entries",
  strokes: "strokes",
  packs: "word_packs",
} as const;

/**
 * Service-role client. Server-only: it bypasses RLS, so it must never be
 * constructed in code that ships to the browser.
 */
export function createServiceClient(url: string, serviceKey: string): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-doodleguess-server": "1" } },
  });
}

function unwrap<T>(result: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}: no data returned`);
  return result.data;
}

export class SupabaseStore implements GameStore {
  constructor(private readonly db: SupabaseClient) {}

  async createRoom(row: RoomRow) {
    return unwrap(await this.db.from(TABLES.rooms).insert(row).select().single(), "createRoom") as RoomRow;
  }
  async getRoomByCode(code: string) {
    const { data, error } = await this.db.from(TABLES.rooms).select("*").eq("code", code).maybeSingle();
    if (error) throw new Error(`getRoomByCode: ${error.message}`);
    return (data as RoomRow) ?? null;
  }
  async getRoomById(id: string) {
    const { data, error } = await this.db.from(TABLES.rooms).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`getRoomById: ${error.message}`);
    return (data as RoomRow) ?? null;
  }
  async updateRoom(id: string, patch: Partial<RoomRow>, expect?: Partial<RoomRow>) {
    let q = this.db.from(TABLES.rooms).update(patch).eq("id", id);
    for (const [key, value] of Object.entries(expect ?? {})) q = q.eq(key, value as never);
    const { data, error } = await q.select().maybeSingle();
    if (error) throw new Error(`updateRoom: ${error.message}`);
    return (data as RoomRow) ?? null;
  }
  async listPublicRooms(limit: number) {
    const { data, error } = await this.db
      .from(TABLES.rooms)
      .select("*")
      .eq("settings->>isPublic", "true")
      .neq("status", "finished")
      .order("last_activity_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`listPublicRooms: ${error.message}`);
    return (data ?? []) as RoomRow[];
  }

  async createPlayer(row: PlayerRow) {
    return unwrap(await this.db.from(TABLES.players).insert(row).select().single(), "createPlayer") as PlayerRow;
  }
  async getPlayer(id: string) {
    const { data, error } = await this.db.from(TABLES.players).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`getPlayer: ${error.message}`);
    return (data as PlayerRow) ?? null;
  }
  async listPlayers(roomId: string) {
    const { data, error } = await this.db
      .from(TABLES.players).select("*").eq("room_id", roomId).order("joined_at", { ascending: true });
    if (error) throw new Error(`listPlayers: ${error.message}`);
    return (data ?? []) as PlayerRow[];
  }
  async updatePlayer(id: string, patch: Partial<PlayerRow>) {
    const { data, error } = await this.db.from(TABLES.players).update(patch).eq("id", id).select().maybeSingle();
    if (error) throw new Error(`updatePlayer: ${error.message}`);
    return (data as PlayerRow) ?? null;
  }

  async createRound(row: RoundRow) {
    return unwrap(await this.db.from(TABLES.rounds).insert(row).select().single(), "createRound") as RoundRow;
  }
  async getRound(id: string) {
    const { data, error } = await this.db.from(TABLES.rounds).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`getRound: ${error.message}`);
    return (data as RoundRow) ?? null;
  }
  async updateRound(id: string, patch: Partial<RoundRow>, expect?: Partial<RoundRow>) {
    let q = this.db.from(TABLES.rounds).update(patch).eq("id", id);
    for (const [key, value] of Object.entries(expect ?? {})) q = q.eq(key, value as never);
    const { data, error } = await q.select().maybeSingle();
    if (error) throw new Error(`updateRound: ${error.message}`);
    return (data as RoundRow) ?? null;
  }
  async listRounds(roomId: string) {
    const { data, error } = await this.db
      .from(TABLES.rounds).select("*").eq("room_id", roomId).order("created_at", { ascending: true });
    if (error) throw new Error(`listRounds: ${error.message}`);
    return (data ?? []) as RoundRow[];
  }

  async setSecret(row: RoundSecretRow) {
    const { error } = await this.db.from(TABLES.secrets).upsert(row);
    if (error) throw new Error(`setSecret: ${error.message}`);
  }
  async getSecret(roundId: string) {
    const { data, error } = await this.db.from(TABLES.secrets).select("*").eq("round_id", roundId).maybeSingle();
    if (error) throw new Error(`getSecret: ${error.message}`);
    return (data as RoundSecretRow) ?? null;
  }
  async updateSecret(roundId: string, patch: Partial<RoundSecretRow>) {
    const { error } = await this.db.from(TABLES.secrets).update(patch).eq("round_id", roundId);
    if (error) throw new Error(`updateSecret: ${error.message}`);
  }

  async insertGuess(row: GuessRow) {
    return unwrap(await this.db.from(TABLES.guesses).insert(row).select().single(), "insertGuess") as GuessRow;
  }
  async listGuesses(roundId: string) {
    const { data, error } = await this.db
      .from(TABLES.guesses).select("*").eq("round_id", roundId).order("guessed_at", { ascending: true });
    if (error) throw new Error(`listGuesses: ${error.message}`);
    return (data ?? []) as GuessRow[];
  }
  async listRoomGuesses(roomId: string) {
    const { data, error } = await this.db
      .from(TABLES.guesses).select("*").eq("room_id", roomId).order("guessed_at", { ascending: true });
    if (error) throw new Error(`listRoomGuesses: ${error.message}`);
    return (data ?? []) as GuessRow[];
  }
  async countRecentGuesses(playerId: string, sinceIso: string) {
    const { count, error } = await this.db
      .from(TABLES.guesses)
      .select("id", { count: "exact", head: true })
      .eq("player_id", playerId)
      .gte("guessed_at", sinceIso);
    if (error) throw new Error(`countRecentGuesses: ${error.message}`);
    return count ?? 0;
  }

  async appendFeed(row: FeedRow) {
    return unwrap(await this.db.from(TABLES.feed).insert(row).select().single(), "appendFeed") as FeedRow;
  }
  async listFeed(roomId: string, limit: number) {
    const { data, error } = await this.db
      .from(TABLES.feed)
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`listFeed: ${error.message}`);
    return ((data ?? []) as FeedRow[]).reverse();
  }

  async appendStrokes(rows: StrokeRow[]) {
    if (!rows.length) return;
    const { error } = await this.db.from(TABLES.strokes).insert(rows);
    if (error) throw new Error(`appendStrokes: ${error.message}`);
  }
  async listStrokes(roundId: string) {
    const { data, error } = await this.db
      .from(TABLES.strokes).select("round_id, seq, data").eq("round_id", roundId).order("seq", { ascending: true });
    if (error) throw new Error(`listStrokes: ${error.message}`);
    return (data ?? []) as StrokeRow[];
  }
  async replaceStrokes(roundId: string, rows: StrokeRow[]) {
    const { error } = await this.db.from(TABLES.strokes).delete().eq("round_id", roundId);
    if (error) throw new Error(`replaceStrokes: ${error.message}`);
    await this.appendStrokes(rows);
  }

  async createWordPack(row: WordPackRow) {
    return unwrap(await this.db.from(TABLES.packs).insert(row).select().single(), "createWordPack") as WordPackRow;
  }
  async getWordPack(id: string) {
    const { data, error } = await this.db.from(TABLES.packs).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`getWordPack: ${error.message}`);
    return (data as WordPackRow) ?? null;
  }
}
