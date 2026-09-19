"use client";

import type { FloatingReaction } from "@/lib/client/useRoom";

const EMOJI = ["👏", "🔥", "😂", "😮", "❤️", "🎨"];

export function ReactionBar({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div className="no-scrollbar flex min-w-0 gap-1.5 overflow-x-auto">
      {EMOJI.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-base transition active:scale-90 sm:h-11 sm:w-11 sm:rounded-xl sm:text-xl"
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/**
 * Thumbs sit on the drawing itself: a verdict on someone's art is worth one
 * tap, and burying it in a reaction bar means nobody ever sends it.
 */
export function VoteButtons({ onReact, className = "" }: {
  onReact: (emoji: string) => void;
  className?: string;
}) {
  return (
    <div className={`absolute right-1.5 top-1.5 z-20 flex gap-1 ${className}`}>
      {["👍", "👎"].map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl drop-shadow transition active:scale-90 sm:h-11 sm:w-11"
          aria-label={emoji === "👍" ? "Nice drawing" : "Not quite"}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

/** Reactions float over the canvas instead of filling the guess feed. */
export function ReactionOverlay({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {reactions.map((reaction) => (
        <span
          key={reaction.id}
          className="animate-float-up absolute bottom-6 text-4xl"
          style={{ left: `${reaction.x}%` }}
        >
          {reaction.emoji}
        </span>
      ))}
    </div>
  );
}
