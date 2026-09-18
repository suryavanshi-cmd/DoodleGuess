-- DoodleGuess schema.
--
-- Design note: the secret word never lives on a row that guessers can read.
-- It sits in round_secrets (locked down in the RLS migration) until the turn
-- ends, at which point the server copies it to rounds.revealed_word.

create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  host_id            uuid,
  settings           jsonb not null default '{}'::jsonb,
  status             text not null default 'lobby'
                       check (status in ('lobby','picking','drawing','intermission','finished')),
  round_number       integer not null default 0,
  turn_index         integer not null default -1,
  turn_order         jsonb not null default '[]'::jsonb,
  current_round_id   uuid,
  used_words         jsonb not null default '[]'::jsonb,
  double_points_turn integer,
  phase_ends_at      timestamptz,
  last_turn          jsonb,
  created_at         timestamptz not null default now(),
  last_activity_at   timestamptz not null default now()
);

create index if not exists rooms_public_idx
  on public.rooms ((settings->>'isPublic'), last_activity_at desc);

create table if not exists public.players (
  id                  uuid primary key default gen_random_uuid(),
  room_id             uuid not null references public.rooms(id) on delete cascade,
  name                text not null,
  avatar              jsonb not null default '{}'::jsonb,
  score               integer not null default 0,
  is_host             boolean not null default false,
  is_drawing          boolean not null default false,
  -- sha256 of the player's session token; never exposed to clients.
  token_hash          text not null,
  connected           boolean not null default true,
  connected_at        timestamptz not null default now(),
  last_seen_at        timestamptz not null default now(),
  left_at             timestamptz,
  turns_drawn         integer not null default 0,
  streak              integer not null default 0,
  best_streak         integer not null default 0,
  guesses_made        integer not null default 0,
  correct_guesses     integer not null default 0,
  total_guess_ms      integer not null default 0,
  points_from_drawing integer not null default 0,
  frozen_until        timestamptz,
  joined_at           timestamptz not null default now()
);

create index if not exists players_room_idx on public.players (room_id, joined_at);

create table if not exists public.rounds (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,
  round_number  integer not null,
  turn_number   integer not null,
  drawer_id     uuid references public.players(id) on delete set null,
  difficulty    text check (difficulty in ('easy','medium','hard')),
  status        text not null default 'picking' check (status in ('picking','drawing','ended')),
  word_length   integer,
  shape         jsonb not null default '[]'::jsonb,
  revealed      jsonb not null default '[]'::jsonb,
  double_points boolean not null default false,
  started_at    timestamptz,
  ends_at       timestamptz,
  ended_at      timestamptz,
  -- Populated only once the turn is over.
  revealed_word text,
  created_at    timestamptz not null default now()
);

create index if not exists rounds_room_idx on public.rounds (room_id, created_at);

create table if not exists public.round_secrets (
  round_id        uuid primary key references public.rounds(id) on delete cascade,
  word            text not null default '',
  choices         jsonb not null default '[]'::jsonb,
  reveal_timeline jsonb not null default '[]'::jsonb
);

create table if not exists public.guesses (
  id             uuid primary key default gen_random_uuid(),
  round_id       uuid not null references public.rounds(id) on delete cascade,
  room_id        uuid not null references public.rooms(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  guess_text     text not null,
  is_correct     boolean not null default false,
  is_close       boolean not null default false,
  points_awarded integer not null default 0,
  ms_elapsed     integer,
  guessed_at     timestamptz not null default now()
);

create index if not exists guesses_round_idx on public.guesses (round_id, guessed_at);
-- Backs the per-player guess rate limit.
create index if not exists guesses_player_recent_idx on public.guesses (player_id, guessed_at desc);

create table if not exists public.feed_entries (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  kind       text not null check (kind in ('guess','chat','system','correct','close','join','leave')),
  player_id  uuid,
  name       text,
  text       text not null,
  -- Hints and "almost!" nudges: visible to exactly one player.
  private_to uuid,
  created_at timestamptz not null default now()
);

create index if not exists feed_room_idx on public.feed_entries (room_id, created_at desc);

create table if not exists public.strokes (
  round_id uuid not null references public.rounds(id) on delete cascade,
  seq      integer not null,
  data     jsonb not null,
  primary key (round_id, seq)
);

create table if not exists public.word_packs (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid,
  room_id    uuid references public.rooms(id) on delete cascade,
  name       text not null,
  words      text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists word_packs_room_idx on public.word_packs (room_id);
