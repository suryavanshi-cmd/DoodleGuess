"use client";

/**
 * Initials avatar: a coloured circle with one or two letters.
 *
 * The game already gives every player an emoji avatar they picked themselves
 * (see AvatarBadge), which stays the identity on the roster. This is the
 * compact, text-first variant used where a name has to read at a glance —
 * the activity toasts and the presence row — and it needs no stored image.
 */

/**
 * Deterministic shade from the name, so a player keeps the same swatch.
 * Greyscale rather than a hue: in this theme the only colour on screen is the
 * one that carries meaning, and "who said this" is told by the letters.
 */
function shadeFor(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 997;
  // 26-52%: dark enough for white letters, spread enough to tell apart.
  return 26 + (hash % 7) * 4.5;
}

/** First letter of the first two words, codepoint-safe for emoji names. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => Array.from(word)[0] ?? "");
  const initials = letters.join("").toUpperCase();
  return initials || "?";
}

export interface InitialsAvatarProps {
  name: string;
  size?: number;
  /** Shows a small status dot in the corner when set. */
  online?: boolean;
  className?: string;
}

export function InitialsAvatar({ name, size = 28, online, className = "" }: InitialsAvatarProps) {
  const shade = shadeFor(name);

  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={{ width: size, height: size }}>
      <span
        className="inline-flex h-full w-full items-center justify-center rounded-full font-bold leading-none text-white"
        style={{
          // Capped at 52% so white letters stay above 4.5:1 on every swatch.
          background: `hsl(0 0% ${shade}%)`,
          fontSize: Math.max(10, Math.round(size * 0.42)),
        }}
        title={name}
      >
        {initialsOf(name)}
      </span>
      {online === undefined ? null : (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-surface
            ${online ? "bg-success" : "bg-muted"}`}
          style={{ width: Math.max(7, size * 0.28), height: Math.max(7, size * 0.28) }}
          aria-hidden
        />
      )}
    </span>
  );
}
