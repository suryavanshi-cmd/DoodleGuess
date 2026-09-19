// GENERATED from src/lib/game/settings.ts by scripts/build-edge-function.mjs.
// Do not edit — change the original and run `npm run build:edge`.

import type { PackId } from "./words.ts";

export type GameMode = "draw" | "text_clue";

export interface RoomSettings {

  gameMode: GameMode;
  rounds: number;
  turnSeconds: number;
  pack: PackId;
  customPackId: string | null;
  hintsEnabled: boolean;
  powerUpsEnabled: boolean;
  hardcore: boolean;
  isPublic: boolean;

  strictFilter: boolean;

  allowCustomWords: boolean;

  requireHostApproval: boolean;

  aiGuesser: boolean;
  maxPlayers: number;
}

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
  allowCustomWords: true,
  requireHostApproval: false,
  aiGuesser: false,
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
    allowCustomWords: bool(raw.allowCustomWords, base.allowCustomWords),
    requireHostApproval: bool(raw.requireHostApproval, base.requireHostApproval),
    aiGuesser: bool(raw.aiGuesser, base.aiGuesser),
    maxPlayers: clampInt(raw.maxPlayers, base.maxPlayers, LIMITS.maxPlayers.min, LIMITS.maxPlayers.max),
  };

  if (settings.isPublic && raw.allowCustomWords === undefined) {
    settings.allowCustomWords = false;
  }

  if (settings.hardcore) {

    settings.turnSeconds = Math.min(settings.turnSeconds, 45);
    settings.hintsEnabled = false;
  }
  return settings;
}

export const TIMING = {

  pickSeconds: 15,

  intermissionSeconds: 7,

  reconnectGraceMs: 60_000,

  freezeMs: 5_000,

  clueSeconds: 45,

  customApprovalSeconds: 12,
} as const;
