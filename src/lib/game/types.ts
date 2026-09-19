import type { Difficulty } from "./scoring";
import type { RoomSettings } from "./settings";

export type RoomStatus = "lobby" | "picking" | "clue" | "drawing" | "intermission" | "finished";
export type RoundStatus = "picking" | "clue" | "drawing" | "ended";

export interface Avatar {
  emoji: string;
  color: string;
}

export interface PublicPlayer {
  id: string;
  name: string;
  avatar: Avatar;
  score: number;
  isHost: boolean;
  isDrawing: boolean;
  connected: boolean;
  /** Has this player already got the word this turn? */
  guessedCorrect: boolean;
  streak: number;
}

export interface PublicRound {
  id: string;
  roundNumber: number;
  turnNumber: number;
  drawerId: string | null;
  difficulty: Difficulty | null;
  status: RoundStatus;
  maskedWord: string;
  shape: number[];
  startedAt: string | null;
  endsAt: string | null;
  doublePoints: boolean;
  /** Only ever non-null once the turn has ended. */
  revealedWord: string | null;
  /** Text mode: the clue everyone is guessing from. Null while it is written. */
  clueText: string | null;
  clueSource: "human" | "clue_bank" | null;
}

export type FeedKind = "guess" | "chat" | "system" | "correct" | "close" | "synonym" | "join" | "leave";

export interface FeedEntry {
  id: string;
  kind: FeedKind;
  playerId: string | null;
  name: string | null;
  text: string;
  at: string;
  /** When set, only this player should render the entry. */
  privateTo?: string | null;
}

export type MatchType = "exact" | "fuzzy" | "synonym" | "miss";

export interface TurnResult {
  word: string;
  drawerId: string | null;
  /** Text mode: what the clue was, so the summary can show it. */
  clueText?: string | null;
  clueSource?: "human" | "clue_bank" | null;
  /** Text mode: how each correct guess was matched. */
  matches?: { playerId: string; matchType: MatchType }[];
  scores: { playerId: string; gained: number; total: number }[];
}

export interface PlayerStats {
  playerId: string;
  guesses: number;
  correct: number;
  accuracy: number;
  avgGuessMs: number | null;
  bestStreak: number;
  drawnTurns: number;
  pointsFromDrawing: number;
}

export interface Recap {
  mvpArtistId: string | null;
  fastestGuesserId: string | null;
  funniestGuess: { text: string; count: number } | null;
  stats: PlayerStats[];
  leaderboard: { playerId: string; score: number }[];
}

export interface PublicState {
  code: string;
  status: RoomStatus;
  settings: RoomSettings;
  hostId: string | null;
  roundNumber: number;
  totalRounds: number;
  players: PublicPlayer[];
  round: PublicRound | null;
  feed: FeedEntry[];
  lastTurn: TurnResult | null;
  recap: Recap | null;
  serverTime: string;
  /** Present only in a direct response to the drawer — never broadcast. */
  yourWord?: string | null;
  yourChoices?: { word: string; difficulty: Difficulty }[] | null;
}

export type RealtimeEvent =
  | { type: "state"; state: PublicState }
  | { type: "feed"; entry: FeedEntry }
  | { type: "stroke"; playerId: string; stroke: Stroke }
  | { type: "canvas"; playerId: string; action: "clear" | "undo" | "redo"; strokes?: Stroke[] }
  | { type: "reaction"; playerId: string; emoji: string; at: number }
  | { type: "freeze"; targetId: string; untilMs: number; byName: string };

export interface StrokePoint {
  x: number;
  y: number;
}

export type ShapeKind = "free" | "line" | "rect" | "circle" | "fill";

export interface Stroke {
  id: string;
  kind: ShapeKind;
  color: string;
  size: number;
  points: StrokePoint[];
  /** Eraser strokes paint the canvas background. */
  erase?: boolean;
}
