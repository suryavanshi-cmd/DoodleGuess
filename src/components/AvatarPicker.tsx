"use client";

import { CHARACTERS } from "@/lib/client/characters";
import type { Avatar } from "@/lib/game/types";

// One cast, shared with the front page's one-tap grid, so every face has a
// name behind it and nobody is ever forced to invent a nickname.
const EMOJI = CHARACTERS.map((character) => character.emoji);
const COLORS = ["#f97316", "#14b8a6", "#6366f1", "#ec4899", "#22c55e", "#eab308", "#06b6d4", "#a855f7"];

export function AvatarBadge({ avatar, size = 40, ring }: { avatar: Avatar; size?: number; ring?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${ring ? "ring-2 ring-brand" : ""}`}
      style={{ background: avatar.color, width: size, height: size, fontSize: size * 0.55 }}
      aria-hidden
    >
      {avatar.emoji}
    </span>
  );
}

export function AvatarPicker({ value, onChange }: { value: Avatar; onChange: (next: Avatar) => void }) {
  return (
    <div className="min-w-0 space-y-2.5">
      <div>
        <span className="label">Pick a character</span>
        <div className="no-scrollbar mt-1.5 flex w-full min-w-0 gap-1.5 overflow-x-auto sm:flex-wrap">
          {EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onChange({ ...value, emoji })}
              aria-label={`Avatar ${emoji}`}
              aria-pressed={value.emoji === emoji}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg transition
                ${value.emoji === emoji ? "border-brand bg-brand/10 scale-105" : "border-line bg-surface-2"}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Pick a colour</span>
        <div className="no-scrollbar mt-1.5 flex w-full min-w-0 gap-1.5 overflow-x-auto sm:flex-wrap">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...value, color })}
              aria-label={`Colour ${color}`}
              aria-pressed={value.color === color}
              className={`h-10 w-10 shrink-0 rounded-xl border-2 transition ${value.color === color ? "border-fg scale-110" : "border-transparent"}`}
              style={{ background: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
