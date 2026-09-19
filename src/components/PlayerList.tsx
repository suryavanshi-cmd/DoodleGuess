"use client";

import { AvatarBadge } from "./AvatarPicker";
import { POWER_UP_COSTS } from "@/lib/game/scoring";
import type { PublicPlayer } from "@/lib/game/types";

/**
 * Phone layout: the roster as a single scrollable rail, so scores stay visible
 * without costing a screenful of height.
 */
export function PlayerStrip({ players, meId, drawerId }: {
  players: PublicPlayer[];
  meId: string | null;
  drawerId: string | null;
}) {
  return (
    <ul className="no-scrollbar flex w-full min-w-0 gap-1.5 overflow-x-auto">
      {players.map((player) => (
        <li
          key={player.id}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2 py-1
            ${player.guessedCorrect ? "border-success/50 bg-success/10" : "border-line bg-surface"}
            ${player.id === meId ? "ring-1 ring-brand" : ""} ${player.connected ? "" : "opacity-50"}`}
        >
          <AvatarBadge avatar={player.avatar} size={26} ring={player.id === drawerId} />
          <span className="leading-tight">
            <span className="block max-w-20 truncate text-xs font-semibold">
              {player.name}
              {player.id === drawerId ? " ✏️" : ""}
              {player.guessedCorrect ? " ✅" : ""}
            </span>
            <span className="block text-[11px] text-muted">{player.score}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PlayerList({ players, meId, drawerId, canFreeze, onFreeze }: {
  players: PublicPlayer[];
  meId: string | null;
  drawerId: string | null;
  canFreeze: boolean;
  onFreeze: (playerId: string) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {players.map((player, index) => {
        const isMe = player.id === meId;
        return (
          <li
            key={player.id}
            className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2
              ${player.guessedCorrect ? "border-success/40 bg-success/10" : "border-line bg-surface-2"}
              ${isMe ? "ring-1 ring-brand" : ""} ${player.connected ? "" : "opacity-50"}`}
          >
            <span className="w-5 text-center text-sm font-bold text-muted">{index + 1}</span>
            <AvatarBadge avatar={player.avatar} size={34} ring={player.id === drawerId} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">
                {player.name}{isMe ? " (you)" : ""}
                {player.id === drawerId ? <span title="Drawing"> ✏️</span> : null}
                {player.guessedCorrect ? <span title="Got it"> ✅</span> : null}
                {player.streak >= 3 ? <span title={`${player.streak} in a row`}> 🔥{player.streak}</span> : null}
              </span>
              <span className="block text-xs text-muted">
                {player.connected ? `${player.score} pts` : "disconnected — seat held"}
              </span>
            </span>
            {canFreeze && !isMe && player.id !== drawerId && player.connected ? (
              <button
                type="button"
                onClick={() => onFreeze(player.id)}
                className="btn-ghost min-h-9 px-2 py-1 text-sm"
                title={`Freeze ${player.name} for 5s (${POWER_UP_COSTS.freeze} pts)`}
              >
                🧊
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
