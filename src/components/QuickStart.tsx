"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { saveProfile, saveSession, useStoredProfile } from "@/lib/client/storage";
import { DEFAULT_SETTINGS } from "@/lib/game/settings";

/**
 * One tap from the front page into a room.
 *
 * The long form — nickname, character, colour, every setting — still lives at
 * /play for anyone who wants it. This is the other path: pick a face and you
 * are in, because the fastest way to explain this game is to be inside it. The
 * character carries the nickname with it, so there is no field to fill; anyone
 * who has played before keeps the name they already chose.
 *
 * It opens over the page rather than navigating, so the button that summoned
 * it never scrolls away underneath.
 */

interface Character {
  emoji: string;
  /** Doubles as the default nickname, which is why they are all one word. */
  name: string;
  color: string;
}

const CHARACTERS: Character[] = [
  { emoji: "🦊", name: "Fox", color: "#f97316" },
  { emoji: "🐼", name: "Panda", color: "#14b8a6" },
  { emoji: "🐸", name: "Frog", color: "#22c55e" },
  { emoji: "🐙", name: "Octo", color: "#6366f1" },
  { emoji: "🦖", name: "Rex", color: "#eab308" },
  { emoji: "🐝", name: "Bee", color: "#f97316" },
  { emoji: "🦄", name: "Unicorn", color: "#a855f7" },
  { emoji: "🐧", name: "Penguin", color: "#06b6d4" },
  { emoji: "🐨", name: "Koala", color: "#14b8a6" },
  { emoji: "🦉", name: "Owl", color: "#ec4899" },
  { emoji: "🐳", name: "Whale", color: "#06b6d4" },
  { emoji: "🚀", name: "Rocket", color: "#6366f1" },
];

export function QuickStart({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const storedProfile = useStoredProfile();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const first = useRef<HTMLButtonElement | null>(null);

  // Escape closes, and the page behind does not scroll while this is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    const focus = requestAnimationFrame(() => first.current?.focus());
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(focus);
    };
  }, [open, onClose]);

  if (!open) return null;

  const start = async (character: Character) => {
    setBusy(character.emoji);
    setError(null);
    const name = storedProfile?.name?.trim() || character.name;
    const avatar = { emoji: character.emoji, color: character.color };
    try {
      const result = await api.createRoom({ name, avatar, settings: DEFAULT_SETTINGS });
      saveProfile({ name, avatar });
      saveSession(result.code, { playerId: result.playerId, token: result.token });
      router.push(`/room/${result.code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not open a room. Try again.");
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => { if (!panel.current?.contains(event.target as Node)) onClose(); }}
      role="presentation"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quickstart-title"
        className="animate-pop-in w-full max-w-lg rounded-3xl border border-hairline bg-surface/95 p-5 shadow-2xl backdrop-blur-xl sm:p-7"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <h2 id="quickstart-title" className="font-hero text-xl font-semibold normal-case tracking-tight">
              Pick a character
            </h2>
            <p className="mt-1 text-sm text-muted">
              {storedProfile?.name
                ? `You will join as ${storedProfile.name}. Your room opens straight away.`
                : "That is the whole setup. Your room opens straight away."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto -mr-1 -mt-1 rounded-full p-2 text-muted transition hover:bg-surface-2 hover:text-fg"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2.5 sm:grid-cols-6 sm:gap-3">
          {CHARACTERS.map((character, index) => (
            <button
              key={character.emoji}
              ref={index === 0 ? first : undefined}
              type="button"
              disabled={busy !== null}
              onClick={() => void start(character)}
              aria-label={`Start a room as ${character.name}`}
              className="pane group flex aspect-square items-center justify-center rounded-2xl text-2xl
                         transition disabled:opacity-40 sm:text-[26px]
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-vivid"
              style={{ backgroundColor: `${character.color}1f` }}
            >
              <span
                className={`transition-transform duration-200 ${busy === character.emoji ? "scale-75 opacity-60" : "group-hover:scale-110"}`}
              >
                {character.emoji}
              </span>
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 text-sm font-medium text-danger">{error}</p> : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4 text-sm">
          <Link href="/play" className="font-medium text-muted transition hover:text-fg">
            Join with a code, or set it up properly →
          </Link>
          <Link href="/solo" className="font-medium text-muted transition hover:text-fg">
            Play solo →
          </Link>
        </div>
      </div>
    </div>
  );
}
