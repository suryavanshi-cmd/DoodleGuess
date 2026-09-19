"use client";

import { AvatarBadge } from "./AvatarPicker";
import { POWER_UP_COSTS } from "@/lib/game/scoring";
import type { PublicPlayer } from "@/lib/game/types";

/**
 * Phone layout: the roster as a scrolling column beside the chat, rank on the
 * left and the avatar on the right so names and scores share the middle and
 * stay readable at speed.
 */
export function PlayerColumn({ players, meId, drawerId }: {
  players: PublicPlayer[];
  meId: string | null;
  drawerId: string | null;
}) {
  // Ranks come from the score order; the rows keep table order so a player's
  // row does not jump around underneath a thumb mid-round.
  const rankOf = new Map(
    [...players].sort((a, b) => b.score - a.score).map((player, index) => [player.id, index + 1]),
  );

  return (
    <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
      {players.map((player) => (
        <li
          key={player.id}
          className={`flex items-center gap-1.5 px-1.5 py-1
            ${player.guessedCorrect ? "bg-success/15" : player.id === meId ? "bg-brand/15" : ""}
            ${player.connected ? "" : "opacity-50"}`}
        >
          <span className="font-pixel w-7 shrink-0 text-[8px] text-muted">#{rankOf.get(player.id)}</span>
          <span className="min-w-0 flex-1 text-center leading-tight">
            <span className="block truncate text-xs font-bold">
              {player.id === meId ? `${player.name} (You)` : player.name}
            </span>
            <span className="block text-[10px] text-muted">{player.score} points</span>
          </span>
          {player.id === drawerId ? <span className="shrink-0 text-xs" title="Drawing">✏️</span> : null}
          <AvatarBadge avatar={player.avatar} size={26} ring={player.id === drawerId} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Compact rail kept for the lobby and any layout without room for a column.
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
          className={`flex shrink-0 items-center gap-1 rounded-lg border px-1.5 py-0.5
            ${player.guessedCorrect ? "border-success/50 bg-success/10" : "border-line bg-surface"}
            ${player.id === meId ? "ring-1 ring-brand" : ""} ${player.connected ? "" : "opacity-50"}`}
        >
          <AvatarBadge avatar={player.avatar} size={22} ring={player.id === drawerId} />
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
