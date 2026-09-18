import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { GameStore } from "@/lib/store/types";
import type {
  FeedRow, GuessRow, PlayerRow, RoomRow, RoundRow, RoundSecretRow, StrokeRow,
} from "@/lib/store/types";
import { evaluateGuess } from "./fuzzy";
import { maskWord, revealTimeline, revealedAt, wordShape } from "./mask";
import { screenMessage, sanitizeName } from "./filter";
import {
  BASE_POINTS, POWER_UP_COSTS, accuracyPct, canAfford, computeRecap, drawerPoints, guesserPoints,
  nextStreak, spendPoints, type Difficulty, type PowerUpKind,
} from "./scoring";
import { DEFAULT_SETTINGS, TIMING, normalizeSettings } from "./settings";
import { mulberry32, seedFrom } from "./text";
import { builtinPack, drawWordChoices, entriesFromCustomWords, rotateCategories, type WordEntry } from "./words";
import type {
  Avatar, FeedEntry, PublicPlayer, PublicRound, PublicState, Recap, Stroke, TurnResult,
} from "./types";

export class GameError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "bad_request") {
    super(message);
  }
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
const FEED_LIMIT = 60;
const GUESS_WINDOW_MS = 10_000;
const GUESS_WINDOW_MAX = 12;
const AVATAR_EMOJI = ["🦊", "🐼", "🐸", "🐙", "🦖", "🐝", "🦄", "🐧", "🐨", "🦉", "🐳", "🍕"];
const AVATAR_COLORS = ["#f97316", "#14b8a6", "#6366f1", "#ec4899", "#22c55e", "#eab308", "#06b6d4", "#a855f7"];

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function sanitizeAvatar(input: unknown): Avatar {
  const raw = (input ?? {}) as Partial<Avatar>;
  const emoji = typeof raw.emoji === "string" && [...raw.emoji].length <= 2 && raw.emoji.trim()
    ? raw.emoji.trim()
    : AVATAR_EMOJI[Math.floor(Math.random() * AVATAR_EMOJI.length)];
  const color = typeof raw.color === "string" && /^#[0-9a-f]{6}$/i.test(raw.color)
    ? raw.color
    : AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  return { emoji, color };
}

export interface EngineOptions {
  now?: () => number;
  random?: () => number;
}

export interface JoinResult {
  playerId: string;
  token: string;
  rejoined: boolean;
}

export class GameEngine {
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(private readonly store: GameStore, opts: EngineOptions = {}) {
    this.now = opts.now ?? (() => Date.now());
    this.random = opts.random ?? Math.random;
  }

  // ---------------------------------------------------------------- rooms

  private generateCode(): string {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += CODE_ALPHABET[Math.floor(this.random() * CODE_ALPHABET.length)];
    }
    return code;
  }

  async createRoom(input: { name: string; avatar?: unknown; settings?: unknown }): Promise<{ room: RoomRow } & JoinResult> {
    const name = sanitizeName(input.name);
    if (!name) throw new GameError("Pick a friendly nickname (letters and numbers).", 400, "bad_name");

    let code = this.generateCode();
    for (let attempt = 0; attempt < 8 && (await this.store.getRoomByCode(code)); attempt++) {
      code = this.generateCode();
    }

    const nowMs = this.now();
    const roomId = randomUUID();
    const playerId = randomUUID();
    const token = newToken();
    const settings = normalizeSettings(input.settings, DEFAULT_SETTINGS);

    const room: RoomRow = {
      id: roomId,
      code,
      host_id: playerId,
      settings,
      status: "lobby",
      round_number: 0,
      turn_index: -1,
      turn_order: [],
      current_round_id: null,
      used_words: [],
      double_points_turn: null,
      phase_ends_at: null,
      last_turn: null,
      created_at: iso(nowMs),
      last_activity_at: iso(nowMs),
    };
    await this.store.createRoom(room);
    await this.store.createPlayer(this.newPlayerRow({ id: playerId, roomId, name, avatar: input.avatar, token, isHost: true }));
    await this.pushFeed(room, { kind: "system", text: `${name} opened the room. Share code ${code} to invite friends.` });
    return { room, playerId, token, rejoined: false };
  }

  /**
   * Two players who never opened the picker would otherwise be identical foxes.
   * Keep their choice when it is free, nudge it to a free slot when it is not.
   */
  private distinctAvatar(requested: unknown, players: PlayerRow[]): Avatar {
    const wanted = sanitizeAvatar(requested);
    const taken = new Set(players.filter((p) => p.connected).map((p) => `${p.avatar.emoji}|${p.avatar.color}`));
    if (!taken.has(`${wanted.emoji}|${wanted.color}`)) return wanted;
    for (const emoji of AVATAR_EMOJI) {
      for (const color of AVATAR_COLORS) {
        if (!taken.has(`${emoji}|${color}`)) return { emoji, color };
      }
    }
    return wanted;
  }

  private newPlayerRow(args: { id: string; roomId: string; name: string; avatar: unknown; token: string; isHost: boolean }): PlayerRow {
    const nowIso = iso(this.now());
    return {
      id: args.id,
      room_id: args.roomId,
      name: args.name,
      avatar: sanitizeAvatar(args.avatar),
      score: 0,
      is_host: args.isHost,
      is_drawing: false,
      token_hash: hashToken(args.token),
      connected: true,
      connected_at: nowIso,
      last_seen_at: nowIso,
      left_at: null,
      turns_drawn: 0,
      streak: 0,
      best_streak: 0,
      guesses_made: 0,
      correct_guesses: 0,
      total_guess_ms: 0,
      points_from_drawing: 0,
      frozen_until: null,
      joined_at: nowIso,
    };
  }

  async joinRoom(code: string, input: { name: string; avatar?: unknown; token?: string | null }): Promise<JoinResult> {
    const room = await this.requireRoom(code);
    const players = await this.store.listPlayers(room.id);

    // Reconnect: same token, same seat, same score.
    if (input.token) {
      const hash = hashToken(input.token);
      const existing = players.find((p) => p.token_hash === hash);
      if (existing) {
        await this.store.updatePlayer(existing.id, {
          connected: true,
          left_at: null,
          connected_at: iso(this.now()),
          last_seen_at: iso(this.now()),
        });
        await this.pushFeed(room, { kind: "join", text: `${existing.name} reconnected.`, playerId: existing.id, name: existing.name });
        await this.broadcastState(room.code);
        return { playerId: existing.id, token: input.token, rejoined: true };
      }
    }

    const name = sanitizeName(input.name);
    if (!name) throw new GameError("Pick a friendly nickname (letters and numbers).", 400, "bad_name");
    if (players.filter((p) => p.connected).length >= room.settings.maxPlayers) {
      throw new GameError("This room is full.", 409, "room_full");
    }
    if (room.status === "finished") throw new GameError("That game has already finished.", 409, "game_over");

    const uniqueName = players.some((p) => p.name.toLowerCase() === name.toLowerCase())
      ? `${name}${Math.floor(this.random() * 90 + 10)}`.slice(0, 16)
      : name;
    const avatar = this.distinctAvatar(input.avatar, players);

    const token = newToken();
    const playerId = randomUUID();
    await this.store.createPlayer(
      this.newPlayerRow({ id: playerId, roomId: room.id, name: uniqueName, avatar, token, isHost: false }),
    );
    await this.pushFeed(room, { kind: "join", text: `${uniqueName} joined.`, playerId, name: uniqueName });
    await this.broadcastState(room.code);
    return { playerId, token, rejoined: false };
  }

  async updateSettings(code: string, auth: AuthInput, settings: unknown): Promise<void> {
    const { room, player } = await this.authenticate(code, auth);
    if (!player.is_host) throw new GameError("Only the host can change settings.", 403, "not_host");
    if (room.status !== "lobby") throw new GameError("Settings are locked once the game starts.", 409, "in_progress");
    const next = normalizeSettings(settings, room.settings);
    await this.store.updateRoom(room.id, { settings: next, last_activity_at: iso(this.now()) });
    await this.broadcastState(code);
  }

  async heartbeat(code: string, auth: AuthInput): Promise<void> {
    const { player } = await this.authenticate(code, auth);
    await this.store.updatePlayer(player.id, { last_seen_at: iso(this.now()), connected: true, left_at: null });
  }

  async leave(code: string, auth: AuthInput): Promise<void> {
    const { room, player } = await this.authenticate(code, auth);
    await this.store.updatePlayer(player.id, { connected: false, left_at: iso(this.now()) });
    await this.pushFeed(room, { kind: "leave", text: `${player.name} left.`, playerId: player.id, name: player.name });
    await this.broadcastState(code);
  }

  // ------------------------------------------------------------ game loop

  async startGame(code: string, auth: AuthInput): Promise<void> {
    const { room, player } = await this.authenticate(code, auth);
    if (!player.is_host) throw new GameError("Only the host can start the game.", 403, "not_host");
    if (room.status !== "lobby" && room.status !== "finished") {
      throw new GameError("The game is already running.", 409, "in_progress");
    }
    const players = await this.store.listPlayers(room.id);
    const active = players.filter((p) => p.connected);
    if (active.length < 2) throw new GameError("You need at least 2 players.", 409, "need_players");

    const order = active.map((p) => p.id);
    const totalTurns = order.length * room.settings.rounds;
    const doubleTurn = room.settings.powerUpsEnabled && totalTurns > 1
      ? Math.floor(this.random() * totalTurns) + 1
      : null;

    for (const p of players) {
      await this.store.updatePlayer(p.id, {
        score: 0, streak: 0, best_streak: 0, guesses_made: 0, correct_guesses: 0,
        total_guess_ms: 0, points_from_drawing: 0, turns_drawn: 0, is_drawing: false, frozen_until: null,
      });
    }

    const updated = await this.store.updateRoom(room.id, {
      status: "picking",
      round_number: 1,
      turn_index: 0,
      turn_order: order,
      used_words: [],
      double_points_turn: doubleTurn,
      last_turn: null,
      last_activity_at: iso(this.now()),
    }, { status: room.status });
    if (!updated) return;

    await this.beginTurn(updated, order[0]);
  }

  /** Words for this room: built-in pack, or the host's uploaded list. */
  private async wordPool(room: RoomRow): Promise<WordEntry[]> {
    if (room.settings.pack === "custom" && room.settings.customPackId) {
      const pack = await this.store.getWordPack(room.settings.customPackId);
      const entries = entriesFromCustomWords(pack?.words ?? []);
      if (entries.length >= 3) return entries;
    }
    const pool = builtinPack(room.settings.pack === "custom" ? "simple" : room.settings.pack);
    // Categories rotate per game so a long session does not repeat itself.
    return rotateCategories(pool, mulberry32(seedFrom(room.id)), 5);
  }

  private absoluteTurn(room: RoomRow): number {
    const perRound = Math.max(1, room.turn_order.length);
    return (room.round_number - 1) * perRound + room.turn_index + 1;
  }

  private async beginTurn(room: RoomRow, drawerId: string): Promise<RoundRow> {
    const nowMs = this.now();
    const pool = await this.wordPool(room);
    const rng = mulberry32(seedFrom(`${room.id}:${room.round_number}:${room.turn_index}`));
    const choices = drawWordChoices(pool, rng, room.used_words);
    const roundId = randomUUID();
    const turnNumber = this.absoluteTurn(room);

    const round: RoundRow = {
      id: roundId,
      room_id: room.id,
      round_number: room.round_number,
      turn_number: turnNumber,
      drawer_id: drawerId,
      difficulty: null,
      status: "picking",
      word_length: null,
      shape: [],
      revealed: [],
      double_points: room.double_points_turn === turnNumber,
      started_at: null,
      ends_at: null,
      ended_at: null,
      revealed_word: null,
      created_at: iso(nowMs),
    };
    await this.store.createRound(round);
    await this.store.setSecret({
      round_id: roundId,
      word: "",
      choices: choices.map((c) => ({ word: c.word, difficulty: c.difficulty })),
      reveal_timeline: [],
    });

    for (const p of await this.store.listPlayers(room.id)) {
      if (p.is_drawing !== (p.id === drawerId)) {
        await this.store.updatePlayer(p.id, { is_drawing: p.id === drawerId });
      }
    }

    await this.store.updateRoom(room.id, {
      status: "picking",
      current_round_id: roundId,
      phase_ends_at: iso(nowMs + TIMING.pickSeconds * 1000),
      last_activity_at: iso(nowMs),
    });
    const drawer = await this.store.getPlayer(drawerId);
    await this.pushFeed(room, {
      kind: "system",
      text: `Round ${room.round_number} · ${drawer?.name ?? "Someone"} is choosing a word${round.double_points ? " · DOUBLE POINTS turn!" : ""}`,
    });
    await this.broadcastState(room.code);
    return round;
  }

  async chooseWord(roundId: string, auth: AuthInput, choiceIndex: number): Promise<void> {
    const round = await this.store.getRound(roundId);
    if (!round) throw new GameError("Round not found.", 404, "no_round");
    const room = await this.requireRoomById(round.room_id);
    const { player } = await this.authenticate(room.code, auth);
    if (round.drawer_id !== player.id) throw new GameError("Only the drawer picks the word.", 403, "not_drawer");
    if (round.status !== "picking") throw new GameError("The word was already chosen.", 409, "already_started");

    const secret = await this.store.getSecret(roundId);
    if (!secret) throw new GameError("Round is missing its words.", 500, "no_secret");
    const choice = secret.choices[choiceIndex];
    if (!choice) throw new GameError("That word choice does not exist.", 400, "bad_choice");
    await this.startDrawing(room, round, secret, choice);
  }

  private async startDrawing(
    room: RoomRow,
    round: RoundRow,
    secret: RoundSecretRow,
    choice: { word: string; difficulty: Difficulty },
  ): Promise<void> {
    const nowMs = this.now();
    const endsAt = nowMs + room.settings.turnSeconds * 1000;
    const timeline = revealTimeline(choice.word, room.settings.turnSeconds, {
      hintsEnabled: room.settings.hintsEnabled,
      seed: round.id,
    });

    const started = await this.store.updateRound(round.id, {
      status: "drawing",
      difficulty: choice.difficulty,
      word_length: choice.word.length,
      shape: wordShape(choice.word),
      started_at: iso(nowMs),
      ends_at: iso(endsAt),
    }, { status: "picking" });
    if (!started) return; // someone else already started this turn

    await this.store.updateSecret(round.id, { word: choice.word, reveal_timeline: timeline });
    await this.store.updateRoom(room.id, {
      status: "drawing",
      phase_ends_at: iso(endsAt),
      used_words: [...room.used_words, choice.word],
      last_activity_at: iso(nowMs),
    });
    await this.pushFeed(room, { kind: "system", text: `Drawing has started — ${choice.difficulty} word, ${choice.word.replace(/[^\s]/g, "•")}` });
    await this.broadcastState(room.code);
  }

  /**
   * Idempotent clock. Any request may call this; conditional updates make sure
   * only one caller performs each transition.
   */
  async reconcile(code: string): Promise<void> {
    const room = await this.requireRoom(code);
    const nowMs = this.now();
    if (room.status === "lobby" || room.status === "finished") return;
    if (!room.phase_ends_at || Date.parse(room.phase_ends_at) > nowMs) {
      if (room.status === "drawing") await this.maybeEndEarly(room);
      return;
    }

    if (room.status === "picking" && room.current_round_id) {
      const round = await this.store.getRound(room.current_round_id);
      const secret = round ? await this.store.getSecret(round.id) : null;
      if (round && secret && round.status === "picking") {
        // Out of time: the game picks for them (the middle tier is the fair default).
        const choice = secret.choices[1] ?? secret.choices[0];
        if (choice) await this.startDrawing(room, round, secret, choice);
      }
      return;
    }

    if (room.status === "drawing" && room.current_round_id) {
      const round = await this.store.getRound(room.current_round_id);
      if (round) await this.endTurn(room, round, "time");
      return;
    }

    if (room.status === "intermission") {
      await this.advanceTurn(room);
    }
  }

  private async maybeEndEarly(room: RoomRow): Promise<void> {
    if (!room.current_round_id) return;
    const round = await this.store.getRound(room.current_round_id);
    if (!round || round.status !== "drawing") return;
    const players = await this.store.listPlayers(room.id);
    const guessers = players.filter((p) => p.connected && p.id !== round.drawer_id);
    if (!guessers.length) return;
    const guesses = await this.store.listGuesses(round.id);
    const correct = new Set(guesses.filter((g) => g.is_correct).map((g) => g.player_id));
    if (guessers.every((p) => correct.has(p.id))) {
      await this.endTurn(room, round, "all-correct");
    }
  }

  private async endTurn(room: RoomRow, round: RoundRow, reason: "time" | "all-correct"): Promise<void> {
    const secret = await this.store.getSecret(round.id);
    const word = secret?.word ?? "";
    const nowMs = this.now();

    const ended = await this.store.updateRound(round.id, {
      status: "ended",
      ended_at: iso(nowMs),
      revealed_word: word,
    }, { status: "drawing" });
    if (!ended) return; // another request already closed this turn

    const players = await this.store.listPlayers(room.id);
    const guesses = await this.store.listGuesses(round.id);
    const correct = guesses.filter((g) => g.is_correct);
    const difficulty = round.difficulty ?? "medium";
    const turnMs = room.settings.turnSeconds * 1000;

    const ratios = correct.map((g) => Math.max(0, Math.min(1, 1 - (g.ms_elapsed ?? turnMs) / turnMs)));
    const avgRatio = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
    const drawerGain = drawerPoints({
      difficulty,
      correctCount: correct.length,
      avgTimeLeftRatio: avgRatio,
      doublePoints: round.double_points,
    });

    const scores: TurnResult["scores"] = [];
    const correctIds = new Set(correct.map((g) => g.player_id));

    for (const p of players) {
      const gainedFromGuess = guesses
        .filter((g) => g.player_id === p.id)
        .reduce((sum, g) => sum + g.points_awarded, 0);

      if (p.id === round.drawer_id) {
        const total = p.score + drawerGain;
        await this.store.updatePlayer(p.id, {
          score: total,
          points_from_drawing: p.points_from_drawing + drawerGain,
          turns_drawn: p.turns_drawn + 1,
          is_drawing: false,
        });
        if (drawerGain > 0) scores.push({ playerId: p.id, gained: drawerGain, total });
        continue;
      }

      if (!p.connected) continue;
      const outcome = correctIds.has(p.id) ? "correct" : "missed";
      const streak = nextStreak(p.streak, outcome);
      await this.store.updatePlayer(p.id, {
        streak,
        best_streak: Math.max(p.best_streak, streak),
        frozen_until: null,
      });
      if (gainedFromGuess > 0) scores.push({ playerId: p.id, gained: gainedFromGuess, total: p.score });
    }

    const lastTurn: TurnResult = { word, drawerId: round.drawer_id, scores };
    await this.store.updateRoom(room.id, {
      status: "intermission",
      phase_ends_at: iso(nowMs + TIMING.intermissionSeconds * 1000),
      last_turn: lastTurn,
      last_activity_at: iso(nowMs),
    });
    await this.pushFeed(room, {
      kind: "system",
      text: reason === "all-correct"
        ? `Everyone got it! The word was "${word}".`
        : `Time! The word was "${word}".`,
    });
    await this.broadcastState(room.code);
  }

  private async advanceTurn(room: RoomRow): Promise<void> {
    const players = await this.store.listPlayers(room.id);
    const connected = players.filter((p) => p.connected);
    if (connected.length < 2) {
      await this.finishGame(room);
      return;
    }

    let order = room.turn_order.filter((id) => connected.some((p) => p.id === id));
    for (const p of connected) if (!order.includes(p.id)) order.push(p.id);

    let roundNumber = room.round_number;
    let index = room.turn_index + 1;
    if (index >= order.length) {
      index = 0;
      roundNumber += 1;
      // Fresh rotation each round so late joiners get a turn.
      order = connected.map((p) => p.id);
    }
    if (roundNumber > room.settings.rounds) {
      await this.finishGame(room);
      return;
    }

    const updated = await this.store.updateRoom(room.id, {
      status: "picking",
      round_number: roundNumber,
      turn_index: index,
      turn_order: order,
      last_activity_at: iso(this.now()),
    }, { status: "intermission" });
    if (!updated) return;
    await this.beginTurn(updated, order[index]);
  }

  private async finishGame(room: RoomRow): Promise<void> {
    const updated = await this.store.updateRoom(room.id, {
      status: "finished",
      phase_ends_at: null,
      current_round_id: null,
      last_activity_at: iso(this.now()),
    }, { status: room.status });
    if (!updated) return;
    for (const p of await this.store.listPlayers(room.id)) {
      if (p.is_drawing) await this.store.updatePlayer(p.id, { is_drawing: false });
    }
    await this.pushFeed(room, { kind: "system", text: "That's a wrap! Check the recap below." });
    await this.broadcastState(room.code);
  }

  // -------------------------------------------------------------- guesses

  async submitGuess(code: string, auth: AuthInput, text: string): Promise<{ verdict: "correct" | "close" | "wrong" | "duplicate" }> {
    const { room, player } = await this.authenticate(code, auth);
    if (room.status !== "drawing" || !room.current_round_id) {
      throw new GameError("There is nothing to guess right now.", 409, "not_drawing");
    }
    if (player.frozen_until && Date.parse(player.frozen_until) > this.now()) {
      throw new GameError("You're frozen for a moment!", 429, "frozen");
    }

    const since = iso(this.now() - GUESS_WINDOW_MS);
    if ((await this.store.countRecentGuesses(player.id, since)) >= GUESS_WINDOW_MAX) {
      throw new GameError("Slow down a little!", 429, "rate_limited");
    }

    const round = await this.store.getRound(room.current_round_id);
    if (!round || round.status !== "drawing") throw new GameError("This turn just ended.", 409, "turn_over");
    if (round.drawer_id === player.id) throw new GameError("You're drawing — no guessing!", 403, "is_drawer");

    const secret = await this.store.getSecret(round.id);
    if (!secret?.word) throw new GameError("The word is not ready yet.", 409, "no_word");

    const guesses = await this.store.listGuesses(round.id);
    if (guesses.some((g) => g.is_correct && g.player_id === player.id)) {
      return { verdict: "duplicate" };
    }

    const trimmed = text.replace(/\s+/g, " ").trim().slice(0, 120);
    if (!trimmed) throw new GameError("Type a guess first.", 400, "empty");

    const evaluation = evaluateGuess(trimmed, secret.word);
    const nowMs = this.now();
    const startedAt = round.started_at ? Date.parse(round.started_at) : nowMs;
    const msElapsed = Math.max(0, nowMs - startedAt);
    const turnMs = room.settings.turnSeconds * 1000;
    const timeLeftRatio = Math.max(0, Math.min(1, 1 - msElapsed / turnMs));

    let points = 0;
    if (evaluation.verdict === "correct") {
      points = guesserPoints({
        difficulty: round.difficulty ?? "medium",
        timeLeftRatio,
        correctRank: guesses.filter((g) => g.is_correct).length + 1,
        priorStreak: player.streak,
        doublePoints: round.double_points,
      });
    }

    const guessRow: GuessRow = {
      id: randomUUID(),
      round_id: round.id,
      room_id: room.id,
      player_id: player.id,
      guess_text: trimmed,
      is_correct: evaluation.verdict === "correct",
      is_close: evaluation.verdict === "close",
      points_awarded: points,
      ms_elapsed: msElapsed,
      guessed_at: iso(nowMs),
    };
    await this.store.insertGuess(guessRow);
    await this.store.updatePlayer(player.id, {
      guesses_made: player.guesses_made + 1,
      correct_guesses: player.correct_guesses + (evaluation.verdict === "correct" ? 1 : 0),
      total_guess_ms: player.total_guess_ms + (evaluation.verdict === "correct" ? msElapsed : 0),
      score: player.score + points,
      last_seen_at: iso(nowMs),
    });

    if (evaluation.verdict === "correct") {
      await this.pushFeed(room, {
        kind: "correct",
        playerId: player.id,
        name: player.name,
        text: `${player.name} guessed it! (+${points})`,
      });
      await this.broadcastState(room.code);
      await this.maybeEndEarly((await this.store.getRoomById(room.id)) ?? room);
      return { verdict: "correct" };
    }

    if (evaluation.verdict === "close") {
      // Only this player hears "almost" — it would be a huge tell in public chat.
      await this.pushFeed(room, {
        kind: "close",
        playerId: player.id,
        name: player.name,
        text: `So close — "${trimmed}" is nearly it. Try again!`,
        privateTo: player.id,
      });
      return { verdict: "close" };
    }

    const screened = screenMessage(trimmed, { strict: room.settings.strictFilter, secretWord: secret.word });
    if (screened.allowed) {
      await this.pushFeed(room, { kind: "guess", playerId: player.id, name: player.name, text: screened.publicText });
    } else if (screened.reason === "word-leak") {
      await this.pushFeed(room, {
        kind: "system",
        playerId: player.id,
        name: player.name,
        text: "Careful — that message gave the word away, so nobody else saw it.",
        privateTo: player.id,
      });
    } else if (screened.reason === "profanity") {
      await this.pushFeed(room, {
        kind: "system",
        playerId: player.id,
        name: player.name,
        text: "Let's keep it friendly — that message wasn't sent.",
        privateTo: player.id,
      });
    }
    return { verdict: "wrong" };
  }

  /** Banter channel: separate from guesses so it never clutters the feed. */
  async sendChat(code: string, auth: AuthInput, text: string): Promise<void> {
    const { room, player } = await this.authenticate(code, auth);
    const round = room.current_round_id ? await this.store.getRound(room.current_round_id) : null;
    const secret = round && round.status === "drawing" ? await this.store.getSecret(round.id) : null;
    const screened = screenMessage(text, {
      strict: room.settings.strictFilter,
      secretWord: secret?.word ?? null,
    });
    if (!screened.allowed) {
      const reason = screened.reason === "word-leak"
        ? "That would have spoiled the word, so it wasn't sent."
        : "Let's keep it friendly — that message wasn't sent.";
      await this.pushFeed(room, { kind: "system", playerId: player.id, name: player.name, text: reason, privateTo: player.id });
      return;
    }
    await this.pushFeed(room, { kind: "chat", playerId: player.id, name: player.name, text: screened.publicText });
  }

  // ------------------------------------------------------------ power-ups

  async usePowerUp(code: string, auth: AuthInput, kind: PowerUpKind, targetId?: string): Promise<{ hint?: string }> {
    const { room, player } = await this.authenticate(code, auth);
    if (!room.settings.powerUpsEnabled) throw new GameError("Power-ups are off in this room.", 409, "disabled");
    if (room.status !== "drawing" || !room.current_round_id) throw new GameError("Wait for a turn to start.", 409, "not_drawing");
    const round = await this.store.getRound(room.current_round_id);
    if (!round || round.status !== "drawing") throw new GameError("Wait for a turn to start.", 409, "not_drawing");
    if (round.drawer_id === player.id) throw new GameError("The drawer can't use power-ups.", 403, "is_drawer");
    if (!canAfford(player.score, kind)) throw new GameError(`You need ${POWER_UP_COSTS[kind]} points for that.`, 409, "too_poor");

    const secret = await this.store.getSecret(round.id);
    if (!secret?.word) throw new GameError("The word is not ready yet.", 409, "no_word");

    if (kind === "hint") {
      const elapsed = this.now() - (round.started_at ? Date.parse(round.started_at) : this.now());
      const alreadyPublic = new Set(revealedAt(secret.reveal_timeline, elapsed));
      const candidates: number[] = [];
      for (let i = 0; i < secret.word.length; i++) {
        if (/[a-z0-9]/i.test(secret.word[i]) && !alreadyPublic.has(i)) candidates.push(i);
      }
      if (candidates.length <= 1) throw new GameError("There's nothing left to reveal.", 409, "no_hint");
      const index = candidates[Math.floor(this.random() * (candidates.length - 1))];
      await this.store.updatePlayer(player.id, { score: spendPoints(player.score, kind) });
      const hint = `Letter ${index + 1} is "${secret.word[index].toUpperCase()}"`;
      await this.pushFeed(room, { kind: "system", playerId: player.id, name: player.name, text: `🔍 ${hint}`, privateTo: player.id });
      await this.broadcastState(room.code);
      return { hint };
    }

    if (!targetId || targetId === player.id) throw new GameError("Pick an opponent to freeze.", 400, "bad_target");
    const target = await this.store.getPlayer(targetId);
    if (!target || target.room_id !== room.id) throw new GameError("That player isn't here.", 404, "no_target");
    if (target.id === round.drawer_id) throw new GameError("You can't freeze the drawer.", 400, "bad_target");

    const untilMs = this.now() + TIMING.freezeMs;
    await this.store.updatePlayer(player.id, { score: spendPoints(player.score, kind) });
    await this.store.updatePlayer(target.id, { frozen_until: iso(untilMs) });
    await this.pushFeed(room, { kind: "system", text: `🧊 ${player.name} froze ${target.name} for 5 seconds!` });
    await this.broadcastState(room.code);
    return {};
  }

  // -------------------------------------------------------------- strokes

  async saveStrokes(code: string, auth: AuthInput, strokes: Stroke[], replace: boolean): Promise<void> {
    const { room, player } = await this.authenticate(code, auth);
    if (!room.current_round_id) return;
    const round = await this.store.getRound(room.current_round_id);
    if (!round || round.drawer_id !== player.id) {
      throw new GameError("Only the drawer can draw.", 403, "not_drawer");
    }
    const rows: StrokeRow[] = strokes.slice(0, 2000).map((stroke, i) => ({
      round_id: round.id,
      seq: i,
      data: stroke,
    }));
    if (replace) await this.store.replaceStrokes(round.id, rows);
    else await this.store.appendStrokes(rows);
  }

  async listStrokes(roundId: string): Promise<Stroke[]> {
    return (await this.store.listStrokes(roundId)).map((row) => row.data);
  }

  // ---------------------------------------------------------------- state

  async publicState(code: string, viewerId?: string | null): Promise<PublicState> {
    const room = await this.requireRoom(code);
    const players = await this.store.listPlayers(room.id);
    const feed = await this.store.listFeed(room.id, FEED_LIMIT);
    const round = room.current_round_id ? await this.store.getRound(room.current_round_id) : null;
    const secret = round ? await this.store.getSecret(round.id) : null;
    const guesses = round ? await this.store.listGuesses(round.id) : [];
    const correctIds = new Set(guesses.filter((g) => g.is_correct).map((g) => g.player_id));

    const publicPlayers: PublicPlayer[] = players
      .filter((p) => p.connected || room.status !== "lobby")
      .map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        isHost: p.is_host,
        isDrawing: p.is_drawing,
        connected: p.connected,
        guessedCorrect: correctIds.has(p.id),
        streak: p.streak,
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    let publicRound: PublicRound | null = null;
    if (round) {
      const ended = round.status === "ended";
      const elapsed = round.started_at ? this.now() - Date.parse(round.started_at) : 0;
      const revealedIdx = secret ? revealedAt(secret.reveal_timeline, elapsed) : [];
      const word = secret?.word ?? "";
      publicRound = {
        id: round.id,
        roundNumber: round.round_number,
        turnNumber: round.turn_number,
        drawerId: round.drawer_id,
        difficulty: round.difficulty,
        status: round.status,
        // Guessers only ever receive underscores plus timed reveals.
        maskedWord: ended ? word : word ? maskWord(word, revealedIdx) : "",
        shape: round.shape,
        startedAt: round.started_at,
        endsAt: round.ends_at,
        doublePoints: round.double_points,
        revealedWord: ended ? round.revealed_word : null,
      };
    }

    const isDrawer = Boolean(viewerId && round && round.drawer_id === viewerId && round.status !== "ended");

    return {
      code: room.code,
      status: room.status,
      settings: room.settings,
      hostId: room.host_id,
      roundNumber: room.round_number,
      totalRounds: room.settings.rounds,
      players: publicPlayers,
      round: publicRound,
      feed: feed
        .filter((f) => !f.private_to || f.private_to === viewerId)
        .map(toFeedEntry),
      lastTurn: room.status === "intermission" || room.status === "finished" ? room.last_turn : null,
      recap: room.status === "finished" ? await this.buildRecap(room, players) : null,
      serverTime: iso(this.now()),
      yourWord: isDrawer ? secret?.word ?? null : null,
      yourChoices: isDrawer && round?.status === "picking" ? secret?.choices ?? null : null,
    };
  }

  private async buildRecap(room: RoomRow, players: PlayerRow[]): Promise<Recap> {
    const guesses = await this.store.listRoomGuesses(room.id);
    const wrong = guesses.filter((g) => !g.is_correct && !g.is_close).map((g) => g.guess_text);
    const awards = computeRecap(
      players.map((p) => ({
        playerId: p.id,
        guesses: p.guesses_made,
        correct: p.correct_guesses,
        totalGuessMs: p.total_guess_ms,
        bestStreak: p.best_streak,
        drawnTurns: p.turns_drawn,
        pointsFromDrawing: p.points_from_drawing,
      })),
      wrong,
    );
    return {
      ...awards,
      stats: players.map((p) => ({
        playerId: p.id,
        guesses: p.guesses_made,
        correct: p.correct_guesses,
        accuracy: accuracyPct(p.correct_guesses, p.guesses_made),
        avgGuessMs: p.correct_guesses ? Math.round(p.total_guess_ms / p.correct_guesses) : null,
        bestStreak: p.best_streak,
        drawnTurns: p.turns_drawn,
        pointsFromDrawing: p.points_from_drawing,
      })),
      leaderboard: players
        .map((p) => ({ playerId: p.id, score: p.score }))
        .sort((a, b) => b.score - a.score),
    };
  }

  // ----------------------------------------------------------- word packs

  async createWordPack(code: string, auth: AuthInput, name: string, rawWords: string): Promise<{ id: string; count: number }> {
    const { room, player } = await this.authenticate(code, auth);
    if (!player.is_host) throw new GameError("Only the host can upload a word pack.", 403, "not_host");
    const words = rawWords.split(/[,\n]/).map((w) => w.trim()).filter(Boolean).slice(0, 500);
    const entries = entriesFromCustomWords(words);
    const clean = entries.filter((e) => screenMessage(e.word, { strict: true }).allowed).map((e) => e.word);
    if (clean.length < 3) throw new GameError("Add at least 3 usable words.", 400, "too_few");
    const id = randomUUID();
    await this.store.createWordPack({
      id,
      owner_id: player.id,
      room_id: room.id,
      name: name.trim().slice(0, 40) || "Custom pack",
      words: clean,
      created_at: iso(this.now()),
    });
    await this.store.updateRoom(room.id, {
      settings: normalizeSettings({ ...room.settings, pack: "custom", customPackId: id }, room.settings),
    });
    await this.broadcastState(code);
    return { id, count: clean.length };
  }

  async listPublicRooms(): Promise<{ code: string; players: number; status: string }[]> {
    const rooms = await this.store.listPublicRooms(20);
    const out: { code: string; players: number; status: string }[] = [];
    for (const room of rooms) {
      const players = await this.store.listPlayers(room.id);
      const connected = players.filter((p) => p.connected).length;
      if (connected > 0) out.push({ code: room.code, players: connected, status: room.status });
    }
    return out;
  }

  // -------------------------------------------------------------- helpers

  private async requireRoom(code: string): Promise<RoomRow> {
    const room = await this.store.getRoomByCode(code.toUpperCase().trim());
    if (!room) throw new GameError("No room with that code.", 404, "no_room");
    return room;
  }

  private async requireRoomById(id: string): Promise<RoomRow> {
    const room = await this.store.getRoomById(id);
    if (!room) throw new GameError("No room with that code.", 404, "no_room");
    return room;
  }

  async authenticate(code: string, auth: AuthInput): Promise<{ room: RoomRow; player: PlayerRow }> {
    const room = await this.requireRoom(code);
    if (!auth.playerId || !auth.token) throw new GameError("Join the room first.", 401, "no_auth");
    const player = await this.store.getPlayer(auth.playerId);
    if (!player || player.room_id !== room.id) throw new GameError("Join the room first.", 401, "no_auth");
    if (player.token_hash !== hashToken(auth.token)) throw new GameError("Session expired — rejoin the room.", 401, "bad_token");
    return { room, player };
  }

  private async pushFeed(
    room: RoomRow,
    entry: { kind: FeedRow["kind"]; text: string; playerId?: string | null; name?: string | null; privateTo?: string | null },
  ): Promise<void> {
    const row: FeedRow = {
      id: randomUUID(),
      room_id: room.id,
      kind: entry.kind,
      player_id: entry.playerId ?? null,
      name: entry.name ?? null,
      text: entry.text,
      private_to: entry.privateTo ?? null,
      created_at: iso(this.now()),
    };
    await this.store.appendFeed(row);
    // Private entries (hints, "almost!", filter notices) are never broadcast —
    // the whole room is on that channel. They reach their target through that
    // player's own authenticated state fetch, or the API response inline.
    if (!row.private_to) {
      const { publish } = await import("@/lib/realtime/server");
      await publish(room.code, { type: "feed", entry: toFeedEntry(row) });
    }
  }

  private async broadcastState(code: string): Promise<void> {
    const { publish } = await import("@/lib/realtime/server");
    await publish(code, { type: "state", state: await this.publicState(code, null) });
  }
}

export interface AuthInput {
  playerId?: string | null;
  token?: string | null;
}

function toFeedEntry(row: FeedRow): FeedEntry {
  return {
    id: row.id,
    kind: row.kind,
    playerId: row.player_id,
    name: row.name,
    text: row.text,
    at: row.created_at,
    privateTo: row.private_to,
  };
}

export { BASE_POINTS };
