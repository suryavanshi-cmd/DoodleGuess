# Shipping DoodleGuess fast

The two halves deploy separately, which is what makes the cycle short:

| Half | What it is | How it ships | Rebuild needed? |
| --- | --- | --- | --- |
| **Backend** | `supabase/functions/game` — the authoritative engine (guess verdicts, scoring, timers, word secrecy) | `npm run deploy:be` | No frontend build at all |
| **Frontend** | The Next.js app on Vercel | `npm run deploy:fe` | Only when `src/`, `public/` or the build config moved |

Both at once: `npm run ship` (verify → backend → frontend).

## Measured on this machine

| Step | Time |
| --- | --- |
| `npm run verify` (lint + types + 126 tests + edge bundle check) | **9s** |
| `next build`, warm Turbopack cache | **2s** |
| `next build`, cold (`rm -rf .next`) | **8s** |
| `npm ci` from scratch | 24s |

The build is not the slow part. What used to make a deploy feel slow is the
work around it: cloning, installing, and re-running checks that already
passed. Each of those now has a way out.

## What makes it fast

**1. Type checking left the build.** `next.config.ts` sets
`typescript.ignoreBuildErrors`, because `npm run verify` and the `verify` job
in CI already run `tsc` — and Next 16 no longer runs ESLint during `next build`
at all. Cold build 12s → 8s, warm 4s → 2s. The safety net is that nothing
ships without `verify`: it is the first step of `npm run ship` and a required
job in `.github/workflows/ship.yml`.

**2. The Turbopack filesystem cache.** On by default in Next 16.3 and written
to `.next/cache`. It only helps if that directory survives between builds:
Vercel restores it for git builds, the CI workflow caches it explicitly, and
locally it just sits there. A warm compile is 194ms.

**3. Backend deploys skip the frontend entirely.** The game engine runs as a
Supabase Edge Function, so `npm run deploy:be` regenerates the Deno copy,
checks that every module resolves, and uploads it — no Next.js build, no
Vercel deployment, no cache to warm. Seconds, and only the API changes.

**4. Frontend-irrelevant commits do not trigger a Vercel build.**
`vercel.json` points Vercel's Ignored Build Step at
`scripts/vercel-should-build.sh`, which exits 0 (skip) when a commit touched
nothing the browser downloads. A migration or an Edge Function tweak no longer
costs a production rebuild.

**5. Prebuilt uploads.** `npm run deploy:fe` runs `vercel build` here — with
your warm cache and your installed `node_modules` — then `vercel deploy
--prebuilt`, which uploads a finished build instead of asking Vercel to clone
and install from scratch.

## One-time setup

The deploy scripts fetch both CLIs through `npx`, so nothing is installed
globally. They do need credentials:

```bash
npx supabase login          # or export SUPABASE_ACCESS_TOKEN=...
npx vercel login
npx vercel link             # writes .vercel/project.json
```

`deploy:be` targets the project in `SUPABASE_PROJECT_REF`, defaulting to this
project's ref. Override it for a different Supabase project:

```bash
SUPABASE_PROJECT_REF=abc123 npm run deploy:be
```

## Pointing the app at the Edge Function

Instant backend deploys only apply to traffic that reaches the Edge Function.
Set this on Vercel and redeploy once:

```
NEXT_PUBLIC_GAME_API=https://<project-ref>.supabase.co/functions/v1/game
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

`NEXT_PUBLIC_*` values are compiled into the bundle, so add them **and then
redeploy without the build cache** — otherwise the old values stay baked in.
With `NEXT_PUBLIC_GAME_API` set, the Next.js route handlers stop being the
live API and the service-role key never has to leave Supabase. Without it,
the app talks to its own `/api` routes and every backend change needs a
frontend deploy, which is the slow path this file exists to avoid.

## Deploying from CI instead

`.github/workflows/ship.yml` verifies every push and pull request, then
deploys only the half that changed. Both deploy jobs are off until you opt in
with repository variables, so they cannot collide with the Vercel Git
integration you already have:

| Setting | Where | Value |
| --- | --- | --- |
| `DEPLOY_BACKEND` | Variables | `true` to deploy the Edge Function from CI |
| `DEPLOY_FRONTEND` | Variables | `true` to build and upload from CI instead of letting Vercel build |
| `SUPABASE_PROJECT_REF` | Variables | your project ref |
| `SUPABASE_ACCESS_TOKEN` | Secrets | from the Supabase dashboard |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Secrets | from Vercel; the two IDs are in `.vercel/project.json` after `vercel link` |

Turning on `DEPLOY_FRONTEND` means two systems would deploy the same commit —
disconnect the Vercel Git integration (or leave `DEPLOY_FRONTEND` off and let
Vercel build, which the ignored-build-step and cache already keep short).

## Rolling back

A bad frontend deploy does not need a rebuild: `npx vercel rollback` puts the
previous deployment back, and `npx vercel promote <url>` makes any earlier
build production again. Both are near-instant because the artifact already
exists. For the backend, redeploy the previous commit's function with
`npm run deploy:be`.
