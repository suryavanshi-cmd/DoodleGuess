# DoodleGuess

A multiplayer draw-and-guess game in the spirit of skribbl.io — with fuzzy guess
matching, real drawing tools, an end-of-round replay and a post-game recap.

Built with Next.js (App Router) + TypeScript + Tailwind CSS, Supabase
(Postgres + Realtime) and an HTML5 canvas that works with mouse and touch.

## Two ways to play

**Draw it** — the classic: sketch the word on the canvas.

**Clue it** — no canvas at all. The Clue-Giver writes one cryptic clue, at most
60 characters, and everyone guesses from that. Same rooms, same rotation, same
scoring; the host picks the mode in the lobby or on the home page.

Clue mode costs nothing to run, by design — there is no AI call anywhere in it:

- **Clues** are written by players. "Need inspiration?" reads a bundled bank of
  two hand-written clues for every word in the built-in packs (392 of them), and
  clues that players write and that somebody actually guesses are saved back to
  the `clue_bank` table, so the pool grows from real play.
- **No-giveaway checks** are local string work: the word itself, a substring, a
  plural or stem, an acrostic, letter-by-letter spelling, a rhyme, or a clue
  that points at the sound ("rhymes with…"). A test asserts that every bundled
  clue survives its own validator.
- **Guess matching** runs in-process: exact and typo matches through the same
  Damerau-Levenshtein path as drawing mode, plus a bundled near-synonym table.
  A synonym scores "very close" at 60% — you had the idea without landing the
  word — and the round summary tags exact, near-spelling and synonym guesses.

The rhyme check is tuned to catch what a player would actually try. Minimal
pairs are rejected (bat for CAT); shared grammatical endings are not, because
otherwise every `-ing` word "rhymes" with every other and "keep them moving"
would be refused as a clue for JUGGLING.

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
| `clue_bank` | player-contributed clues with upvotes (the bundled bank ships in the app) |

Clue mode reuses `rounds` and `guesses` rather than adding parallel
`text_rounds`/`text_guesses` tables — the rotation, timers, scoring, reconnect
handling and recap are identical, and a second state machine would duplicate
all of it. The mode-specific columns (`clue_text`, `clue_source`, `match_type`)
live on the existing rows, and `rooms.game_mode` is a generated column over
`settings` so there is exactly one source of truth.

The synonym table is bundled in the app rather than imported from WordNet: the
full dump is megabytes, almost none of it about a 200-word game, and its looser
senses make for bad rulings. It is a plain object, so a lookup costs nothing and
adds no latency to a guess.

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

`npm run ship` verifies, deploys the Edge Function, and uploads a prebuilt
frontend; `npm run deploy:be` and `npm run deploy:fe` do one half each.
[DEPLOY.md](DEPLOY.md) covers the fast cycle — what each command costs, why
the build no longer type-checks, and how to deploy from CI instead.

The frontend is a standard Next.js app — deploy it to Vercel (or anywhere that
runs Next). There are two ways to give it an authoritative backend.

**A. Next.js route handlers (default).** Set three environment variables on the
host and the app serves its own API:

| Variable | Scope |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** — bypasses RLS |

**B. Supabase Edge Function (no secrets on the host).** Deploy the function in
`supabase/functions/game`, which is the same engine behind the same routes:

```bash
supabase functions deploy game --project-ref <ref>
```

The Edge runtime injects `SUPABASE_SERVICE_ROLE_KEY` itself, so the key never
leaves Supabase. Then the frontend needs only public values:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
NEXT_PUBLIC_GAME_API=https://<ref>.supabase.co/functions/v1/game
```

The function's shared logic under `supabase/functions/game/lib` is generated
from `src/lib` by `npm run build:edge` — change the engine, regenerate, redeploy.
Its engine and store are the modules the test suite covers; the HTTP router in
`supabase/functions/game/index.ts` mirrors `src/app/api` but has not itself been
exercised against a deployed instance, so give route A or a first game on route
B a quick smoke test.

**Put the functions next to the database.** `vercel.json` pins the app to
`bom1` (Mumbai) to match a Supabase project in `ap-south-1`. A turn involves
many small queries, so a cross-continent hop (US functions, Indian database)
adds seconds of lag; co-locating removes it. If your project lives elsewhere,
change that region — or drop the field and set it under Project Settings →
Functions.

**Realtime is an accelerator, not a dependency.** Clients poll the state and
stroke endpoints whenever the Realtime channel is not actually connected, so
the game still works on networks that block WebSockets (many school and office
proxies do). The fallback is verified: the full browser playtest passes with
WebSockets blocked.

Either way the Supabase project needs the migrations in `supabase/migrations/`
applied and nothing else — no cron, no extra services. `GET /api/health`
(route A) or `GET <function>/health` (route B) reports which store is live.
