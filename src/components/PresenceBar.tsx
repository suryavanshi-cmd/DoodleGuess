"use client";

import { InitialsAvatar } from "./InitialsAvatar";
import type { PublicPlayer } from "@/lib/game/types";

/**
 * Who is in the room right now, as a compact avatar row.
 *
 * Presence is the server's own `connected` flag rather than a second
 * Supabase Presence channel: the game already heartbeats every player and
 * holds a disconnected seat for a grace period, so a player who drops mid-turn
 * shows as away instead of vanishing and losing their score. One source of
 * truth, and it survives a browser that cannot open a WebSocket at all.
 */

const MAX_FACES = 6;

export interface PresenceBarProps {
  players: PublicPlayer[];
  meId: string | null;
  className?: string;
}

export function PresenceBar({ players, meId, className = "" }: PresenceBarProps) {
  // Online first, then the held seats, so the live room reads left to right.
  const ordered = [...players].sort((a, b) => Number(b.connected) - Number(a.connected));
  const faces = ordered.slice(0, MAX_FACES);
  const hidden = ordered.length - faces.length;
  const online = players.filter((player) => player.connected).length;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ul className="flex items-center -space-x-1.5">
        {faces.map((player) => (
          <li
            key={player.id}
            className={`rounded-full ring-2 ring-surface ${player.connected ? "" : "opacity-45"}
              ${player.id === meId ? "z-10 ring-brand" : ""}`}
            title={`${player.name}${player.connected ? "" : " — away, seat held"}`}
          >
            <InitialsAvatar name={player.name} size={26} online={player.connected} />
          </li>
        ))}
        {hidden > 0 ? (
          <li className="z-10 inline-flex h-[26px] items-center rounded-full bg-surface-2 px-1.5 text-[11px] font-bold text-muted ring-2 ring-surface">
            +{hidden}
          </li>
        ) : null}
      </ul>
      <p className="text-xs font-semibold text-muted">
        {online} here{online < players.length ? ` · ${players.length - online} away` : ""}
      </p>
    </div>
  );
}
