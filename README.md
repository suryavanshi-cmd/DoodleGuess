# DoodleGuess

A multiplayer draw-and-guess game in the spirit of skribbl.io — with fuzzy guess
matching, real drawing tools, an end-of-round replay and a post-game recap.

Built with Next.js (App Router) + TypeScript + Tailwind CSS, Supabase
(Postgres + Realtime) and an HTML5 canvas that works with mouse and touch.

## How a game runs

1. Someone creates a room and shares the 6-character code (or the invite link).
2. The host sets rounds (2–10), turn length (30–120s), word pack and power-ups.
3. Each round, every player draws once. The drawer picks one of three words —
   easy, medium or hard — worth progressively more points.
4. Guessers see underscores. Letters reveal on a timer (unless hints are off).
5. Faster correct guesses score more; three correct in a row starts a streak
   bonus; the drawer is paid per correct guesser.
6. Between turns the drawing is replayed stroke by stroke. At the end there is a
   recap: MVP artist, fastest guesser, the most-repeated wrong guess, and
   per-player accuracy, average guess time and best streak.

## What is different from skribbl.io

**Accuracy**

- **Typos count.** Guesses are matched with Damerau-Levenshtein distance, so
  `hosue` gets `house` and `elefant` gets `elephant`. The tolerance scales with
  word length (0 edits up to 4 letters, 1 up to 7, 2 beyond) and plural forms,
  accents, punctuation and a leading "the/a/an" are all normalised away.
- **"Almost!" is private.** A near miss tells only that player, never the room.
- **The server is the referee.** Guess verdicts, scores and timers are computed
  server-side. Clients cannot submit a "correct" flag.
- **The word never leaks.** It lives in a table guessers cannot read, and it is
  copied into the round row only once the turn ends. A guess or chat message
  that spells out the word is withheld from public chat.
- **Reconnects are safe.** A dropped player keeps their seat and score and can
  rejoin the same room; the round does not reset.

**Fun**

- Brush with size slider, full palette plus custom colour picker, fill bucket,
  eraser, line/rectangle/circle shapes, and undo/redo over the last 20 strokes.
- Power-ups (per room, toggleable): buy a private letter hint, freeze a rival's
  guess box for 5 seconds, and one random double-points turn per game.
- Emoji reactions that float over the canvas instead of spamming the feed.
- Room chat kept in a separate tab from the guess feed.
- Host-uploaded custom word packs.
- Avatars, dark mode, and a sound toggle.

## Designed for a mixed-age room

Defaults are tuned for rooms where kids and adults play together: the simple
concrete-noun pack, an 80-second clock, letter hints on, and a strict language
filter that a host can only relax for mild words — never for the severe list.
Adults get a "tricky" pack (idioms, abstract concepts, pop culture), hardcore
mode (45s, no hints) and deeper stats, which appear in the recap rather than
mid-round. Touch targets are at least 44px, wrong guesses say "almost — try
again", and celebrations are brief.

There are deliberately no dark patterns: no auto-queued next game, no
countdown pressure to stop you leaving, no randomised rewards, no ads and no
tracking. The only data kept is what the game needs — nickname, avatar, score
and session-scoped stats.

## Architecture

```
Browser ──HTTP──> Next.js route handlers ──service role──> Supabase Postgres
   ^                                                            │
   └───────────── Supabase Realtime broadcast ───────────────────┘
```

- **Route handlers are the only writer.** They authenticate a player by an
  opaque token (stored hashed), run the rules, and persist the result.
- **Realtime broadcast carries live state**: canvas strokes go peer-to-peer for
  latency, everything that affects scores is broadcast by the server after it
  has been written. Private messages are never broadcast.
- **Clients also poll** `/api/rooms/[code]/state` as a safety net; that endpoint
  reconciles the clock, so the game advances even if a broadcast is missed.
- **Transitions are optimistic-concurrency guarded** (conditional updates on
  status), so two clients reconciling at once cannot double-score a turn.

### Data model

| Table | Purpose |
| --- | --- |
| `rooms` | code, host, settings, status, turn rotation, phase deadline |
| `players` | name, avatar, score, streaks, per-session stats, hashed token |
| `rounds` | round/turn number, drawer, difficulty, timings, revealed word |
| `round_secrets` | **the live word**, the three choices, the hint schedule |
| `guesses` | every guess with correctness, points and elapsed ms |
| `feed_entries` | guess feed, chat and system lines (with private entries) |
| `strokes` | persisted stroke list for replay and mid-turn joiners |
| `word_packs` | host-uploaded custom word lists |

RLS is on for every table. Anonymous browsers can read only the room whose code
they present in an `x-room-code` header, never `round_secrets`, never
`players.token_hash`, and never another player's private feed entries. All
writes are revoked from `anon`. These were verified against the live project
with the anonymous key — which is how the `token_hash` grant bug in
`20260918000002_rls.sql` was caught and fixed in `20260918000004`: a
column-level `REVOKE` does nothing while table-level `SELECT` is still granted.

## Running locally

```bash
npm install
npm run dev          # http://localhost:3000
```

With no Supabase environment variables the app runs in **local mode**: rooms
live in the server process's memory and clients fall back to polling. That is
enough to play a full game on one machine, and it is what the tests use.

For the real thing, copy `.env.example` to `.env.local` and fill in:

| Variable | Where it goes | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | publishable key, Realtime only |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | bypasses RLS — never commit it |

Apply the schema with the Supabase CLI (`supabase db push`) or by running the
files in `supabase/migrations/` in order.

`GET /api/health` reports which store is live, which makes it easy to confirm a
deployment picked up its environment variables.

## Tests

```bash
npm test         # vitest
npm run lint
npm run typecheck
```

`tests/supabase-integration.test.ts` replays a full turn against a real
Supabase project and is skipped unless `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are set, so `npm test` stays offline by default.

The offline suite covers the scoring curve (speed, rank, streak, double points, drawer payout and
its cap), fuzzy matching (typos, transpositions, plurals, accents, articles,
and the short-word cases it must *not* accept), the mask and hint schedule, the
language and word-leak filters, and a full game loop against the in-memory
store — including that the word never appears in a non-drawer's payload,
reconnect keeps the score, and guess spam is rate-limited.

## Deploying

The app is a standard Next.js project; deploy it to Vercel and set the three
environment variables above in the project settings. The Supabase project needs
the migrations applied and nothing else — no edge functions, no cron.
