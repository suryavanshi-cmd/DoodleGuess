"use client";

import { useEffect, useState } from "react";
import type { FeedEntry } from "@/lib/game/types";

const VISIBLE_MS = 5_000;
const MAX_VISIBLE = 3;

/**
 * Only the social lines drop over the board. System notices ("word chosen",
 * "the clue is in") would otherwise sit on top of the clue people are trying
 * to read; they still appear in the history below.
 */
const DROP_KINDS = new Set(["chat", "guess", "correct", "synonym", "close"]);

function tone(entry: FeedEntry): string {
  switch (entry.kind) {
    case "correct": return "border-success/50 bg-success/15 text-success";
    case "synonym": return "border-warning/50 bg-warning/15 text-warning";
    case "close": return "border-warning/50 bg-warning/15 text-warning";
    case "system": case "join": case "leave": return "border-line bg-surface text-muted";
    default: return "border-line bg-surface text-fg";
  }
}

/**
 * Recent chat and guesses, dropping in from the top over the stage.
 *
 * On a phone there is no room for a standing feed without pushing the board
 * off screen, so the last few lines fall in, linger, and leave. Freshness is
 * derived from each entry's own timestamp (corrected for server clock skew)
 * rather than tracked in state, so nothing has to be pushed in on arrival.
 */
export function FeedDrops({ entries, serverTime, className = "" }: {
  entries: FeedEntry[];
  serverTime: string;
  className?: string;
}) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(interval);
  }, []);

  if (!now) return null;
  const skew = Date.parse(serverTime) - now;
  const fresh = entries
    .filter((entry) => DROP_KINDS.has(entry.kind))
    .filter((entry) => {
      const age = now + skew - Date.parse(entry.at);
      return age >= 0 && age < VISIBLE_MS;
    })
    .slice(-MAX_VISIBLE);

  if (!fresh.length) return null;

  return (
    <div className={`pointer-events-none absolute inset-x-2 top-2 z-30 flex flex-col items-center gap-1.5 ${className}`}>
      {fresh.map((entry) => (
        <div
          key={entry.id}
          className={`animate-drop-in max-w-full truncate rounded-xl border px-3 py-1.5 text-sm font-medium shadow-lg backdrop-blur ${tone(entry)}`}
        >
          {entry.name && (entry.kind === "chat" || entry.kind === "guess") ? (
            <strong>{entry.name}: </strong>
          ) : null}
          {entry.text}
        </div>
      ))}
    </div>
  );
}
