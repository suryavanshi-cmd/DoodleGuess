import type {
  ClueBankRow, FeedRow, GameStore, GuessRow, PlayerRow, RoomRow, RoundRow, RoundSecretRow, StrokeRow, WordPackRow,
} from "./types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function matches<T extends object>(row: T, expect?: Partial<T>): boolean {
  if (!expect) return true;
  return Object.entries(expect).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
}

/**
 * Process-local store. Powers `npm test` and the no-Supabase local dev mode
 * (a single node process), so the whole game loop is playable offline.
 */
export class MemoryStore implements GameStore {
  private rooms = new Map<string, RoomRow>();
  private players = new Map<string, PlayerRow>();
  private rounds = new Map<string, RoundRow>();
  private secrets = new Map<string, RoundSecretRow>();
  private guesses: GuessRow[] = [];
  private feed: FeedRow[] = [];
  private strokes: StrokeRow[] = [];
  private packs = new Map<string, WordPackRow>();
  private clueBank: ClueBankRow[] = [];

  async createRoom(row: RoomRow) {
    this.rooms.set(row.id, clone(row));
    return clone(row);
  }
  async getRoomByCode(code: string) {
    for (const room of this.rooms.values()) if (room.code === code) return clone(room);
    return null;
  }
  async getRoomById(id: string) {
    const room = this.rooms.get(id);
    return room ? clone(room) : null;
  }
  async updateRoom(id: string, patch: Partial<RoomRow>, expect?: Partial<RoomRow>) {
    const room = this.rooms.get(id);
    if (!room || !matches(room, expect)) return null;
    Object.assign(room, clone(patch));
    return clone(room);
  }
  async listPublicRooms(limit: number) {
    return [...this.rooms.values()]
      .filter((r) => r.settings.isPublic && r.status !== "finished")
      .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
      .slice(0, limit)
      .map(clone);
  }

  async createPlayer(row: PlayerRow) {
    this.players.set(row.id, clone(row));
    return clone(row);
  }
  async getPlayer(id: string) {
    const p = this.players.get(id);
    return p ? clone(p) : null;
  }
  async listPlayers(roomId: string) {
    return [...this.players.values()]
      .filter((p) => p.room_id === roomId)
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
      .map(clone);
  }
  async updatePlayer(id: string, patch: Partial<PlayerRow>) {
    const p = this.players.get(id);
    if (!p) return null;
    Object.assign(p, clone(patch));
    return clone(p);
  }

  async createRound(row: RoundRow) {
    this.rounds.set(row.id, clone(row));
    return clone(row);
  }
  async getRound(id: string) {
    const r = this.rounds.get(id);
    return r ? clone(r) : null;
  }
  async updateRound(id: string, patch: Partial<RoundRow>, expect?: Partial<RoundRow>) {
    const r = this.rounds.get(id);
    if (!r || !matches(r, expect)) return null;
    Object.assign(r, clone(patch));
    return clone(r);
  }
  async listRounds(roomId: string) {
    return [...this.rounds.values()]
      .filter((r) => r.room_id === roomId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(clone);
  }

  async setSecret(row: RoundSecretRow) {
    this.secrets.set(row.round_id, clone(row));
  }
  async getSecret(roundId: string) {
    const s = this.secrets.get(roundId);
    return s ? clone(s) : null;
  }
  async updateSecret(roundId: string, patch: Partial<RoundSecretRow>) {
    const s = this.secrets.get(roundId);
    if (s) Object.assign(s, clone(patch));
  }

  async insertGuess(row: GuessRow) {
    this.guesses.push(clone(row));
    return clone(row);
  }
  async listGuesses(roundId: string) {
    return this.guesses.filter((g) => g.round_id === roundId).map(clone);
  }
  async listRoomGuesses(roomId: string) {
    return this.guesses.filter((g) => g.room_id === roomId).map(clone);
  }
  async countRecentGuesses(playerId: string, sinceIso: string) {
    return this.guesses.filter((g) => g.player_id === playerId && g.guessed_at >= sinceIso).length;
  }

  async appendFeed(row: FeedRow) {
    this.feed.push(clone(row));
    return clone(row);
  }
  async listFeed(roomId: string, limit: number) {
    return this.feed.filter((f) => f.room_id === roomId).slice(-limit).map(clone);
  }

  async appendStrokes(rows: StrokeRow[]) {
    for (const row of rows) this.strokes.push(clone(row));
  }
  async listStrokes(roundId: string) {
    return this.strokes.filter((s) => s.round_id === roundId).sort((a, b) => a.seq - b.seq).map(clone);
  }
  async replaceStrokes(roundId: string, rows: StrokeRow[]) {
    this.strokes = this.strokes.filter((s) => s.round_id !== roundId);
    await this.appendStrokes(rows);
  }

  async createWordPack(row: WordPackRow) {
    this.packs.set(row.id, clone(row));
    return clone(row);
  }
  async getWordPack(id: string) {
    const p = this.packs.get(id);
    return p ? clone(p) : null;
  }

  async addClueToBank(row: ClueBankRow) {
    this.clueBank.push(clone(row));
  }
  async listBankClues(word: string, limit: number) {
    return this.clueBank
      .filter((c) => c.word === word)
      .sort((a, b) => b.upvotes - a.upvotes)
      .slice(0, limit)
      .map(clone);
  }
  async upvoteClue(id: string) {
    const clue = this.clueBank.find((c) => c.id === id);
    if (clue) clue.upvotes += 1;
  }
}
