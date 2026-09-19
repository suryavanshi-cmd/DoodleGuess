import type { PackId } from "./words";

export type GameMode = "draw" | "text_clue";

export interface RoomSettings {
  /** Draw the word, or write a cryptic clue for it. */
  gameMode: GameMode;
  rounds: number;
  turnSeconds: number;
  pack: PackId;
  customPackId: string | null;
  hintsEnabled: boolean;
  powerUpsEnabled: boolean;
  hardcore: boolean;
  isPublic: boolean;
  /** Mixed-age default: on. Hosts can relax the mild tier, never the severe one. */
  strictFilter: boolean;
  maxPlayers: number;
}

/**
 * Defaults tuned for a mixed-age room: the simple concrete-noun pack, a
 * forgiving 80s clock, hints on, strict filter on.
 */
export const DEFAULT_SETTINGS: RoomSettings = {
  gameMode: "draw",
  rounds: 3,
  turnSeconds: 80,
  pack: "simple",
  customPackId: null,
  hintsEnabled: true,
  powerUpsEnabled: true,
  hardcore: false,
  isPublic: false,
  strictFilter: true,
  maxPlayers: 12,
};

export const LIMITS = {
  rounds: { min: 2, max: 10 },
  turnSeconds: { min: 30, max: 120 },
  maxPlayers: { min: 2, max: 16 },
} as const;

const PACKS: PackId[] = ["simple", "tricky", "genz", "mixed", "custom"];
const MODES: GameMode[] = ["draw", "text_clue"];

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Never trust a client-sent settings blob; clamp everything into range. */
export function normalizeSettings(input: unknown, base: RoomSettings = DEFAULT_SETTINGS): RoomSettings {
  const raw = (input ?? {}) as Partial<Record<keyof RoomSettings, unknown>>;
  const pack = PACKS.includes(raw.pack as PackId) ? (raw.pack as PackId) : base.pack;
  const hardcore = bool(raw.hardcore, base.hardcore);
  const settings: RoomSettings = {
    gameMode: MODES.includes(raw.gameMode as GameMode) ? (raw.gameMode as GameMode) : base.gameMode,
    rounds: clampInt(raw.rounds, base.rounds, LIMITS.rounds.min, LIMITS.rounds.max),
    turnSeconds: clampInt(raw.turnSeconds, base.turnSeconds, LIMITS.turnSeconds.min, LIMITS.turnSeconds.max),
    pack,
    customPackId: typeof raw.customPackId === "string" ? raw.customPackId : base.customPackId,
    hintsEnabled: bool(raw.hintsEnabled, base.hintsEnabled),
    powerUpsEnabled: bool(raw.powerUpsEnabled, base.powerUpsEnabled),
    hardcore,
    isPublic: bool(raw.isPublic, base.isPublic),
    strictFilter: bool(raw.strictFilter, base.strictFilter),
    maxPlayers: clampInt(raw.maxPlayers, base.maxPlayers, LIMITS.maxPlayers.min, LIMITS.maxPlayers.max),
  };
  if (settings.hardcore) {
    // Hardcore is opt-in pressure, not a default: shorter clock, no hints.
    settings.turnSeconds = Math.min(settings.turnSeconds, 45);
    settings.hintsEnabled = false;
  }
  return settings;
}

export const TIMING = {
  /** How long a drawer has to pick one of three words. */
  pickSeconds: 15,
  /** Word reveal + scoreboard between turns. */
  intermissionSeconds: 7,
  /** A dropped player keeps their seat and score this long. */
  reconnectGraceMs: 60_000,
  /** Freeze power-up duration. */
  freezeMs: 5_000,
  /** How long the Clue-Giver has to write their clue in text mode. */
  clueSeconds: 45,
} as const;
