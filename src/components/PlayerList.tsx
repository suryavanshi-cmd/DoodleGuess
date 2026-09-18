"use client";

import { AvatarBadge } from "./AvatarPicker";
import { POWER_UP_COSTS } from "@/lib/game/scoring";
import type { PublicPlayer } from "@/lib/game/types";

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
