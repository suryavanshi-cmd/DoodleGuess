// GENERATED from src/lib/store/types.ts by scripts/build-edge-function.mjs.
// Do not edit — change the original and run `npm run build:edge`.

import type { Difficulty } from "../game/scoring.ts";
import type { RoomSettings } from "../game/settings.ts";
import type { FeedKind, RoomStatus, RoundStatus, Stroke, TurnResult, Avatar } from "../game/types.ts";

export interface RoomRow {
  id: string;
  code: string;
  host_id: string | null;
  settings: RoomSettings;
  status: RoomStatus;
  round_number: number;
  turn_index: number;
  turn_order: string[];
  current_round_id: string | null;
  used_words: string[];

  double_points_turn: number | null;

  phase_ends_at: string | null;
  last_turn: TurnResult | null;
  created_at: string;
  last_activity_at: string;
}

export interface PlayerRow {
  id: string;
  room_id: string;
  name: string;
  avatar: Avatar;
  score: number;
  is_host: boolean;
  is_drawing: boolean;
  token_hash: string;
  connected: boolean;
  connected_at: string;
  last_seen_at: string;
  left_at: string | null;
  turns_drawn: number;
  streak: number;
  best_streak: number;
  guesses_made: number;
  correct_guesses: number;
  total_guess_ms: number;
  points_from_drawing: number;

  frozen_until: string | null;
  joined_at: string;
}

export interface RoundRow {
  id: string;
  room_id: string;
  round_number: number;
  turn_number: number;
  drawer_id: string | null;
  difficulty: Difficulty | null;
  status: RoundStatus;
  word_length: number | null;
  shape: number[];
  revealed: number[];
  double_points: boolean;
  started_at: string | null;
  ends_at: string | null;
  ended_at: string | null;

  revealed_word: string | null;
  created_at: string;
}

export interface RoundSecretRow {
  round_id: string;
  word: string;
  choices: { word: string; difficulty: Difficulty }[];
  reveal_timeline: { atMs: number; index: number }[];
}

export interface GuessRow {
  id: string;
  round_id: string;
  room_id: string;
  player_id: string;
  guess_text: string;
  is_correct: boolean;
  is_close: boolean;
  points_awarded: number;
  ms_elapsed: number | null;
  guessed_at: string;
}

export interface FeedRow {
  id: string;
  room_id: string;
  kind: FeedKind;
  player_id: string | null;
  name: string | null;
  text: string;
  private_to: string | null;
  created_at: string;
}

export interface StrokeRow {
  round_id: string;
  seq: number;
  data: Stroke;
}

export interface WordPackRow {
  id: string;
  owner_id: string | null;
  room_id: string | null;
  name: string;
  words: string[];
  created_at: string;
}

export interface GameStore {
  createRoom(row: RoomRow): Promise<RoomRow>;
  getRoomByCode(code: string): Promise<RoomRow | null>;
  getRoomById(id: string): Promise<RoomRow | null>;
  updateRoom(id: string, patch: Partial<RoomRow>, expect?: Partial<RoomRow>): Promise<RoomRow | null>;
  listPublicRooms(limit: number): Promise<RoomRow[]>;

  createPlayer(row: PlayerRow): Promise<PlayerRow>;
  getPlayer(id: string): Promise<PlayerRow | null>;
  listPlayers(roomId: string): Promise<PlayerRow[]>;
  updatePlayer(id: string, patch: Partial<PlayerRow>): Promise<PlayerRow | null>;

  createRound(row: RoundRow): Promise<RoundRow>;
  getRound(id: string): Promise<RoundRow | null>;
  updateRound(id: string, patch: Partial<RoundRow>, expect?: Partial<RoundRow>): Promise<RoundRow | null>;
  listRounds(roomId: string): Promise<RoundRow[]>;

  setSecret(row: RoundSecretRow): Promise<void>;
  getSecret(roundId: string): Promise<RoundSecretRow | null>;
  updateSecret(roundId: string, patch: Partial<RoundSecretRow>): Promise<void>;

  insertGuess(row: GuessRow): Promise<GuessRow>;
  listGuesses(roundId: string): Promise<GuessRow[]>;
  listRoomGuesses(roomId: string): Promise<GuessRow[]>;
  countRecentGuesses(playerId: string, sinceIso: string): Promise<number>;

  appendFeed(row: FeedRow): Promise<FeedRow>;
  listFeed(roomId: string, limit: number): Promise<FeedRow[]>;

  appendStrokes(rows: StrokeRow[]): Promise<void>;
  listStrokes(roundId: string): Promise<StrokeRow[]>;
  replaceStrokes(roundId: string, rows: StrokeRow[]): Promise<void>;

  createWordPack(row: WordPackRow): Promise<WordPackRow>;
  getWordPack(id: string): Promise<WordPackRow | null>;
}
