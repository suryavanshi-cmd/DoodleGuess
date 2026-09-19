# Deploying DoodleGuess

One codebase on `main`, two hosts, identical behaviour. Either can be primary.

| | Vercel | Render |
| --- | --- | --- |
| URL | doogled.vercel.app | doodleguess.onrender.com |
| Role | **Primary** | Warm standby |
| Build | detected | `npm ci && npm run build` |
| Start | platform runtime | `npm run start` |
| Config in repo | `vercel.json` | `render.yaml` |
| Region | `bom1` (Mumbai) | set at service creation |

The database is a single Supabase project in **ap-south-1 (Mumbai)**. Both
hosts talk to it, so both should sit near it — see *Regions* below.

## Deploying

Both hosts watch `main` and deploy on push. Nothing else is needed for a normal
change:

```bash
git push origin main
```

To deploy by hand:

- **Vercel** — `npm run deploy:fe`, which builds locally and uploads a finished
  build, or use the dashboard's Redeploy.
- **Render** — Manual Deploy → Deploy latest commit. Render's free plan sleeps
  after inactivity, so the first request after an idle period takes tens of
  seconds. That is the plan, not the app.

`npm run ship` runs `verify` and then both halves (Supabase Edge Function, then
Vercel). See [DEPLOY.md](DEPLOY.md) for how the fast path works.

## Environment variables

`.env.example` is the list of what a deployment needs. It is the only place
that list lives; nothing in the repo holds a value.

Each host keeps its own copy, set in its own dashboard:

- Vercel → Project → Settings → Environment Variables
- Render → Service → Environment

The server accepts several spellings of each (`SUPABASE_URL` or
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` or
`SUPABASE_SERVICE_ROLE_KEY`, and prefixed variants), because Vercel's Supabase
integration, a hand-pasted value and Supabase's newer key names all differ. See
`src/lib/env.ts`.

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It is server-only, must never carry a
`NEXT_PUBLIC_` prefix, and must never be committed.

**Check after any change:** `curl https://<host>/api/health`. You want

```json
{ "mode": "supabase", "missing": [], "realtime": true }
```

`found` names the variable each credential came from and `env` lists every
Supabase-shaped name the server can see, so "it is set" can be checked rather
than argued.

## Regions

`/api/health` reports `dbMs`: the host's own round trip to Postgres. That is
the number that matters, and it is invisible from a browser — a host on the
wrong side of the planet still answers a static page quickly while every turn
of the game pays twice.

Vercel is pinned to `bom1` in `vercel.json` for this reason. Render's region is
fixed when the service is created and **cannot be changed afterwards**: moving
means creating a new service in `singapore` (the closest Render offers to
ap-south-1) and repointing the domain. `render.yaml` specifies `singapore` so a
service created from the blueprint starts in the right place.

Compare the two hosts any time with:

```bash
for h in doogled.vercel.app doodleguess.onrender.com; do
  echo "$h: $(curl -s https://$h/api/health | grep -o '"dbMs":[0-9]*')"
done
```

## Supabase: what does and does not need configuring

**No CORS or allowed-origin list is needed for either domain.** Worth stating
plainly, because it is the step everyone expects to have to do:

- The browser never calls Supabase's REST API. Every read and write goes to
  this app's own `/api` routes, same-origin by definition, and the server holds
  the service key.
- Realtime is a WebSocket, and WebSockets are not subject to CORS. Supabase has
  no origin allowlist for the JS client; the origin settings in the dashboard
  are Auth redirect URLs, and this game does not use Supabase Auth — players
  authenticate with a room-scoped token of our own.
- The optional Edge Function backend (`NEXT_PUBLIC_GAME_API`) already sends
  `access-control-allow-origin: *`, so it serves any number of hosts.

Adding a third host needs no Supabase change either.

## When you add something

**A new environment variable**
1. Add it to `.env.example` with a comment saying what it is for.
2. Set it in **both** dashboards. A variable on one host only is the worst
   failure mode here: the app works until traffic lands on the other one.
3. If the browser needs it, read it through `/api/config` rather than a
   `NEXT_PUBLIC_` build-time value, so setting it does not require a rebuild.
4. Redeploy both and check `/api/health` on each.

**A new table or migration**
1. Add the migration under `supabase/migrations/`.
2. Apply it to the one shared project — both hosts see it immediately, and a
   host running older code against a newer schema is the usual cause of a
   confusing 500.
3. Deploy both hosts before relying on the new column.
4. If the engine changed, `npm run build:edge` and redeploy the Edge Function.

**A new route**
Nothing host-specific. Routing is filesystem-based and identical on both;
`vercel.json` and `render.yaml` contain no route rules, and there is no
platform branching anywhere in `src/`. A route parity test
(`tests/route-parity.test.ts`) already guards the Next.js routes against the
Edge Function's.

## Smoke test after a deploy

Against each host in turn:

1. `curl https://<host>/api/health` — `mode: "supabase"`, `missing: []`.
2. Open `/`, click **Play**, create a room.
3. Join the same code in a second browser.
4. Start the game, pick a word, draw, guess it from the other browser.
5. Confirm the score lands and the turn advances.

The room lives in the shared database, so a room created on one host is
joinable from the other. That is the quickest check that both are pointed at
the same project.
