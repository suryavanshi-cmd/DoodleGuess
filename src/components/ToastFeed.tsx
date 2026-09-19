"use client";

import { useEffect, useRef, useState } from "react";
import { InitialsAvatar } from "./InitialsAvatar";
import type { FeedEntry, FeedKind } from "@/lib/game/types";

/**
 * Right-hand activity ticker: each new message slides in as a frosted card,
 * holds for about a second, then collapses out.
 *
 * This is a ticker, not the record — every line here is also in the scrollable
 * history (Feed / FeedList), which is where anything missed can be read back.
 *
 * Entries arrive through the room's Realtime broadcast channel, so a toast
 * appears as soon as the server writes the line. Movement is CSS only: a
 * keyframe on the way in and a grid-row collapse on the way out, so a burst of
 * messages costs the main thread nothing but state updates.
 */

/** ~1s on screen, as asked, plus a snappy in and out. */
const DWELL_MS = 1_100;
const EXIT_MS = 200;
/** A burst should read as a fast stream, not bury the board. */
const MAX_VISIBLE = 3;

/**
 * System lines ("word chosen", "the clue is in") would sit on top of the thing
 * players are trying to read. They stay in the history only.
 */
const TOAST_KINDS: ReadonlySet<FeedKind> = new Set<FeedKind>([
  "chat", "guess", "correct", "synonym", "close", "join", "leave",
]);

interface Toast {
  entry: FeedEntry;
  leaving: boolean;
}

/** A verdict keeps its colour as a left edge, so the glass stays glass. */
function accentFor(kind: FeedKind): string {
  switch (kind) {
    case "correct": return "#12805c";
    case "synonym": case "close": return "#9a6200";
    case "join": case "leave": return "#55708f";
    default: return "#0e5fd8";
  }
}

function labelFor(entry: FeedEntry): string | null {
  switch (entry.kind) {
    case "correct": return "got it";
    case "synonym": return "very close";
    case "close": return "close";
    default: return null;
  }
}

export interface ToastFeedProps {
  entries: FeedEntry[];
  className?: string;
}

export function ToastFeed({ entries, className = "" }: ToastFeedProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  /** null until the first pass, which seeds the backlog as already seen. */
  const seenRef = useRef<Set<string> | null>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>[]>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const handles of timers.values()) handles.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const seen = seenRef.current;

    // Joining a room mid-game must not replay the whole backlog as toasts.
    if (seen === null) {
      seenRef.current = new Set(entries.map((entry) => entry.id));
      return;
    }

    const fresh: FeedEntry[] = [];
    for (const entry of entries) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      if (TOAST_KINDS.has(entry.kind)) fresh.push(entry);
    }
    if (fresh.length === 0) return;

    const drop = (id: string) => {
      timersRef.current.get(id)?.forEach(clearTimeout);
      timersRef.current.delete(id);
    };

    for (const entry of fresh) {
      timersRef.current.set(entry.id, [
        setTimeout(() => {
          setToasts((current) => current.map(
            (toast) => (toast.entry.id === entry.id ? { ...toast, leaving: true } : toast),
          ));
        }, DWELL_MS),
        setTimeout(() => {
          drop(entry.id);
          setToasts((current) => current.filter((toast) => toast.entry.id !== entry.id));
        }, DWELL_MS + EXIT_MS),
      ]);
    }

    setToasts((current) => {
      const next = [...current, ...fresh.map((entry) => ({ entry, leaving: false }))];
      // Overflow from a burst goes straight out rather than queueing up.
      const overflow = next.length - MAX_VISIBLE;
      if (overflow <= 0) return next;
      for (const toast of next.slice(0, overflow)) drop(toast.entry.id);
      return next.slice(overflow);
    });
  }, [entries]);

  if (toasts.length === 0) return null;

  return (
    <ul
      className={`pointer-events-none absolute right-2 top-2 z-30 flex w-[min(78%,19rem)] flex-col
        items-stretch gap-1.5 ${className}`}
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => (
        <li
          key={toast.entry.id}
          // 1fr -> 0fr animates the height with no measuring, so the cards
          // below close up smoothly instead of jumping.
          className={`toast-row grid ${toast.leaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"}`}
        >
          <div className="overflow-hidden">
            <div
              className={`glass flex items-center gap-2 rounded-xl border-l-4 px-2.5 py-1.5
                backdrop-blur-md backdrop-saturate-150
                ${toast.leaving ? "toast-leaving" : "animate-toast-in"}`}
              style={{ borderLeftColor: accentFor(toast.entry.kind) }}
            >
              <InitialsAvatar name={toast.entry.name ?? "Room"} size={24} />
              <p className="min-w-0 flex-1 truncate text-sm leading-tight">
                {toast.entry.name ? <strong className="font-bold">{toast.entry.name}: </strong> : null}
                {toast.entry.text}
              </p>
              {labelFor(toast.entry) ? (
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                  style={{ background: accentFor(toast.entry.kind) }}
                >
                  {labelFor(toast.entry)}
                </span>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
