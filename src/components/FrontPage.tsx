"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DoodleModelCredit } from "./AiGuess";
import { QuickStart } from "./QuickStart";
import { ThemeToggle } from "./ThemeToggle";
import { api } from "@/lib/client/api";

/**
 * The page people land on before they play.
 *
 * One idea per screen, and the first screen has one idea: press Play. The
 * wordmark, a line saying what this is, and the button — nothing else competes
 * with it, which is the only reason a single blue button can carry a page.
 *
 * Everything here is greyscale except that button and the marks that lead to
 * it. Depth is light rather than weight: hairline rules instead of borders, a
 * blurred glow instead of a drop shadow. The restraint is the design.
 *
 * The room form still lives at /play. Play opens the character grid over this
 * page instead of navigating, so nothing jumps out from under the button.
 */

interface PublicRoom {
  code: string;
  players: number;
  status: string;
}

interface Highlight {
  title: string;
  body: string;
  icon: Icon;
}

/**
 * Four things this game has that the others do not. Each one is real and
 * reachable from a room's settings — there is nothing here to go looking for
 * and not find.
 */
const HIGHLIGHTS: Highlight[] = [
  {
    title: "Text-clue mode",
    body: "No canvas. Write one cryptic line and let the room argue its way there.",
    icon: "speech",
  },
  {
    title: "AI doodle guesser",
    body: "A classifier in your browser guesses along, and knows when to stay quiet.",
    icon: "spark",
  },
  {
    title: "Power-ups",
    body: "Buy a letter, freeze a rival mid-streak, or ride a double-points turn.",
    icon: "bolt",
  },
  {
    title: "Your own words",
    body: "Type your own answer instead of taking a suggestion. The host can vet it.",
    icon: "tag",
  },
];

export function FrontPage() {
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    void api.publicRooms().then(({ rooms: list }) => setRooms(list)).catch(() => undefined);
  }, []);

  const live = rooms.reduce((total, room) => total + room.players, 0);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ------------------------------------------------------------ hero */}
      <main className="flex flex-1 flex-col">
        {/* Clipped: the glow below is wider than a phone on purpose, and an
            unclipped decorative element would give the page a sideways scroll. */}
        <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-20 text-center sm:py-28">
          {/* A single wash of accent light behind the button, and nothing else
              on the page carries colour at all. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2
                       -translate-y-1/2 rounded-full opacity-[0.10] blur-[110px] sm:h-[620px] sm:w-[620px]"
            style={{ background: "linear-gradient(135deg, var(--accent-vivid), var(--accent-vivid-2))" }}
          />

          <p
            className="animate-rise font-hud text-[11px] uppercase tracking-[0.34em] text-muted"
            style={{ animationDelay: "40ms" }}
          >
            Multiplayer · Free · No sign-up
          </p>

          <h1
            className="animate-rise font-hero mt-6 max-w-3xl text-[clamp(2.6rem,9vw,5.25rem)] font-semibold
                       normal-case leading-[1.04] tracking-[-0.03em] text-fg"
            style={{ animationDelay: "120ms" }}
          >
            Draw badly.
            <br />
            Guess worse.
          </h1>

          <p
            className="animate-rise font-hero mt-6 max-w-md text-base leading-relaxed text-muted sm:text-lg"
            style={{ animationDelay: "200ms" }}
          >
            A drawing and guessing game for up to sixteen friends. One tap and the room is open.
          </p>

          {/* The two ways to play, side by side and the same size, because they
              are genuinely two choices — not one button and a footnote. Only
              one of them is filled, so there is still a front door. */}
          <div
            className="animate-rise mt-11 flex w-full max-w-md flex-col items-stretch gap-3
                       sm:mt-14 sm:w-auto sm:max-w-none sm:flex-row sm:items-center"
            style={{ animationDelay: "280ms" }}
          >
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="play-cta font-hero inline-flex h-16 items-center justify-center rounded-full px-10
                         text-lg font-semibold tracking-[-0.01em] sm:h-[4.5rem] sm:w-[300px] sm:px-6 sm:text-xl"
              aria-haspopup="dialog"
              aria-expanded={picking}
            >
              Play with friends
            </button>

            <Link
              href="/solo"
              className="play-alt font-hero inline-flex h-16 items-center justify-center gap-2.5 rounded-full px-8
                         text-lg font-semibold tracking-[-0.01em] sm:h-[4.5rem] sm:w-[300px] sm:px-6 sm:text-xl"
            >
              <HighlightIcon kind="spark" className="size-5 shrink-0 text-accent-vivid sm:size-[22px]" />
              Play solo vs the AI
            </Link>
          </div>

          <div
            className="animate-rise font-hero mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted"
            style={{ animationDelay: "360ms" }}
          >
            <Link href="/play" className="transition hover:text-fg">Join with a code</Link>
          </div>

          {live > 0 ? (
            <p
              className="animate-rise font-hud mt-10 text-[11px] uppercase tracking-[0.28em] text-muted"
              style={{ animationDelay: "440ms" }}
            >
              {live} {live === 1 ? "person" : "people"} playing right now
            </p>
          ) : null}
        </section>

        {/* ------------------------------------------------------ highlights */}
        <section className="border-t border-hairline px-6 py-16 sm:py-20">
          <div className="mx-auto grid w-full max-w-5xl gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {HIGHLIGHTS.map((highlight) => (
              <article key={highlight.title} className="pane rounded-2xl p-5">
                <HighlightIcon kind={highlight.icon} />
                <h2 className="font-hero mt-4 text-[15px] font-semibold normal-case tracking-[-0.01em] text-fg">
                  {highlight.title}
                </h2>
                <p className="font-hero mt-1.5 text-sm leading-relaxed text-muted">{highlight.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* ---------------------------------------------------------- footer */}
      <footer className="border-t border-hairline px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-hero flex items-center gap-4 text-sm text-muted">
            <span className="font-display text-sm tracking-tight text-fg">DoodleGuess</span>
            <a
              href="https://github.com/suryavanshi-cmd/DoodleGuess"
              target="_blank"
              rel="noreferrer noopener"
              className="transition hover:text-fg"
            >
              GitHub
            </a>
          </div>
          <div className="flex items-center gap-4">
            <DoodleModelCredit className="font-hero max-w-sm" />
            <ThemeToggle className="shrink-0" />
          </div>
        </div>
      </footer>

      <QuickStart open={picking} onClose={() => setPicking(false)} />
    </div>
  );
}

/* ------------------------------------------------------------------ art */

type Icon = "speech" | "spark" | "bolt" | "tag";

/** Hand-drawn marks rather than an icon set: the game is wobbly lines. */
const ICONS: Record<Icon, string[]> = {
  speech: ["M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-5l-5 4v-4H7a3 3 0 0 1-3-3z"],
  spark: [
    "M11 3.5 12.7 8.3 17.5 10 12.7 11.7 11 16.5 9.3 11.7 4.5 10 9.3 8.3z",
    "M17.5 15 18.2 17 20.2 17.7 18.2 18.4 17.5 20.4 16.8 18.4 14.8 17.7 16.8 17z",
  ],
  bolt: ["M13 3 6 13h5l-1 8 7-10h-5z"],
  tag: ["M4 12 12 4h8v8l-8 8z", "M16 8h.01"],
};

function HighlightIcon({ kind, className = "size-6 text-fg" }: { kind: Icon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      {ICONS[kind].map((d) => (
        <path key={d} d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
