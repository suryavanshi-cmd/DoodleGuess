"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Reveal } from "./Reveal";
import { ThemeToggle } from "./ThemeToggle";
import { api } from "@/lib/client/api";

/**
 * The page people land on before they play.
 *
 * Shaped the way a product showcase is shaped: one hero with a single clear
 * action, then a grid of cards that each say one thing, then how a round
 * actually goes. Everything below the fold fades up as it arrives, and every
 * section is readable without any of that having happened.
 *
 * The room form lives at /play. Keeping it off this page means the first thing
 * anyone sees is what the game is, not a field asking for a nickname.
 */

interface PublicRoom {
  code: string;
  players: number;
  status: string;
}

interface Feature {
  title: string;
  body: string;
  doodle: Doodle;
}

const FEATURES: Feature[] = [
  {
    title: "Draw it",
    body: "Brush, shapes, an eraser and undo. Sketch the word while everyone races to name it.",
    doodle: "brush",
  },
  {
    title: "Clue it",
    body: "No canvas at all. Write one cryptic sentence and let the room argue its way there.",
    doodle: "speech",
  },
  {
    title: "Bring your own word",
    body: "Type your own answer instead of taking a suggestion. The host can vet it first.",
    doodle: "tag",
  },
  {
    title: "Power-ups",
    body: "Buy a letter when you are stuck, freeze a rival mid-streak, or ride a double-points turn.",
    doodle: "bolt",
  },
  {
    title: "Replays and a recap",
    body: "Watch the drawing again when the turn ends, then hand out MVP artist and fastest guesser.",
    doodle: "replay",
  },
  {
    title: "Made for a phone",
    body: "One screen, no scrolling, and touch drawing that keeps up with a fast hand.",
    doodle: "phone",
  },
];

const STEPS: { n: string; title: string; body: string }[] = [
  { n: "01", title: "Make a room", body: "Pick a nickname and a character. No account, no email, no wait." },
  { n: "02", title: "Share the code", body: "Six letters. Anyone with it is in — up to sixteen of you." },
  { n: "03", title: "Draw, guess, argue", body: "Fastest correct guess scores most. Streaks stack. The drawer scores too." },
];

export function FrontPage() {
  const [rooms, setRooms] = useState<PublicRoom[]>([]);

  useEffect(() => {
    void api.publicRooms().then(({ rooms: list }) => setRooms(list)).catch(() => undefined);
  }, []);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <span className="font-display text-lg font-black tracking-tight sm:text-xl">
            <span className="text-gradient">Doodle</span>Guess
          </span>
          <nav className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <a href="#features" className="hidden px-3 py-2 text-sm font-semibold text-muted transition hover:text-fg sm:block">
              Features
            </a>
            <a href="#how" className="hidden px-3 py-2 text-sm font-semibold text-muted transition hover:text-fg sm:block">
              How it works
            </a>
            <ThemeToggle />
            <Link href="/play" className="btn-primary px-4 py-2 text-sm">Play</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* ---------------------------------------------------------- hero */}
        <section className="grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-24">
          <div>
            <p className="font-hud text-[11px] uppercase tracking-widest text-muted sm:text-xs">
              Multiplayer · Free · No sign-up
            </p>
            <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Draw badly.
              <br />
              Guess worse.
            </h1>
            <p className="mt-4 max-w-md text-base text-muted sm:mt-5 sm:text-lg">
              A drawing and guessing game for up to sixteen friends. Make a room, share the
              code, and find out who can actually draw a wheelbarrow.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-2.5 sm:mt-8 sm:gap-3">
              <Link href="/play" className="btn-primary px-7 text-base sm:px-9 sm:text-lg">
                Play now
              </Link>
              <a href="#how" className="btn-ghost px-5 text-base">How it works</a>
            </div>

            {rooms.length > 0 ? (
              <div className="mt-8 sm:mt-10">
                <p className="font-hud text-[11px] uppercase tracking-widest text-muted">
                  Rooms open right now
                </p>
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {rooms.slice(0, 4).map((room) => (
                    <li key={room.code}>
                      <Link
                        href={`/room/${room.code}`}
                        className="lift inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
                      >
                        <span className="font-hud text-sm">{room.code}</span>
                        <span className="text-muted">
                          {room.players} {room.players === 1 ? "player" : "players"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="order-first lg:order-none">
            <HeroDoodle />
          </div>
        </section>

        {/* ------------------------------------------------------ features */}
        <section id="features" className="scroll-mt-16 border-t border-line py-12 sm:py-16 lg:py-20">
          <Reveal>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Everything in the box</h2>
            <p className="mt-2 max-w-lg text-muted">
              No accounts, no ads, no in-app anything. Every mode and every power-up is just
              there when you open a room.
            </p>
          </Reveal>

          <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <Reveal key={feature.title} delay={(index % 3) * 70}>
                <article className="lift flex h-full flex-col rounded-xl border border-line bg-surface p-4 sm:p-5">
                  <FeatureDoodle kind={feature.doodle} />
                  <h3 className="mt-4 text-lg font-bold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{feature.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------- how it goes */}
        <section id="how" className="scroll-mt-16 border-t border-line py-12 sm:py-16 lg:py-20">
          <Reveal>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">How a round goes</h2>
          </Reveal>
          <ol className="mt-8 grid gap-3 sm:mt-10 sm:gap-4 lg:grid-cols-3">
            {STEPS.map((step, index) => (
              <Reveal key={step.n} delay={index * 70}>
                <li className="h-full rounded-xl border border-line bg-surface p-5">
                  <span className="font-hud text-sm text-muted">{step.n}</span>
                  <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{step.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={120}>
            <div className="mt-8 flex flex-col items-start gap-4 rounded-xl border border-line bg-surface p-6 sm:mt-10 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <h3 className="text-xl font-black tracking-tight sm:text-2xl">Ready when you are.</h3>
                <p className="mt-1.5 text-sm text-muted">Takes about ten seconds to get a room going.</p>
              </div>
              <Link href="/play" className="btn-primary shrink-0 px-7 text-base sm:px-8">Play now</Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1.5 px-4 py-8 text-sm text-muted sm:px-6">
          <p>No accounts. No ads. Nothing kept beyond the game you are playing.</p>
          <p>Built with Next.js and Supabase.</p>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ art */

type Doodle = "brush" | "speech" | "tag" | "bolt" | "replay" | "phone";

/**
 * Hand-drawn marks rather than icons from a set: the whole game is wobbly
 * lines, and an SVG path costs nothing to ship.
 */
const DOODLES: Record<Doodle, { d: string; len: number }[]> = {
  brush: [
    // A pencil: body, then the ferrule line across it.
    { d: "M14 58 l5 -15 l26 -26 l10 10 l-26 26 z", len: 130 },
    { d: "M40 22 l10 10", len: 15 },
  ],
  speech: [
    { d: "M12 20 h44 a4 4 0 0 1 4 4 v20 a4 4 0 0 1 -4 4 h-26 l-12 10 v-10 h-6 a4 4 0 0 1 -4 -4 v-20 a4 4 0 0 1 4 -4 z", len: 150 },
    { d: "M24 34 h8 M40 34 h8", len: 20 },
  ],
  tag: [
    { d: "M10 34 l22 -20 h28 v28 l-22 20 z", len: 130 },
    { d: "M48 26 a3 3 0 1 0 0.1 0", len: 22 },
  ],
  bolt: [
    { d: "M38 10 l-18 28 h14 l-6 22 l20 -30 h-14 z", len: 120 },
  ],
  replay: [
    { d: "M52 24 a22 22 0 1 0 6 18", len: 120 },
    { d: "M52 10 v16 h-16", len: 34 },
  ],
  phone: [
    { d: "M22 8 h24 a4 4 0 0 1 4 4 v48 a4 4 0 0 1 -4 4 h-24 a4 4 0 0 1 -4 -4 v-48 a4 4 0 0 1 4 -4 z", len: 150 },
    { d: "M30 54 h8", len: 10 },
  ],
};

function FeatureDoodle({ kind }: { kind: Doodle }) {
  return (
    <svg viewBox="0 0 72 72" className="h-11 w-11 text-fg" fill="none" aria-hidden>
      {DOODLES[kind].map((path, index) => (
        <path
          key={path.d}
          d={path.d}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="doodle-path"
          style={{ "--len": path.len, animationDelay: `${index * 140}ms` } as React.CSSProperties}
        />
      ))}
    </svg>
  );
}

/** The hero drawing sketches itself in, the way a turn actually starts. */
function HeroDoodle() {
  const strokes: { d: string; len: number }[] = [
    { d: "M60 128 C60 78, 102 52, 155 52 C208 52, 250 78, 250 128 C250 178, 208 206, 155 206 C102 206, 60 178, 60 128 Z", len: 620 },
    { d: "M74 86 L60 34 L110 58", len: 120 },
    { d: "M236 86 L250 34 L200 58", len: 120 },
    { d: "M120 118 v14", len: 16 },
    { d: "M190 118 v14", len: 16 },
    { d: "M138 152 q17 16 34 0", len: 50 },
    { d: "M30 140 h56 M30 158 h56", len: 120 },
    { d: "M224 140 h56 M224 158 h56", len: 120 },
  ];

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <svg viewBox="0 0 310 240" className="w-full text-fg" fill="none" aria-label="A doodle of a cat, drawing itself">
        {strokes.map((stroke, index) => (
          <path
            key={stroke.d}
            d={stroke.d}
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="doodle-path"
            style={{ "--len": stroke.len, animationDelay: `${index * 130}ms` } as React.CSSProperties}
          />
        ))}
      </svg>
      <p className="mt-3 text-center font-hud text-[11px] uppercase tracking-widest text-muted">
        someone drew this in 40 seconds
      </p>
    </div>
  );
}
