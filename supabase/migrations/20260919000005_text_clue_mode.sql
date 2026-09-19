-- Text-clue mode: the Clue-Giver writes a cryptic clue instead of drawing.
--
-- It reuses rooms/players/rounds/guesses rather than adding parallel
-- text_rounds/text_guesses tables: the turn rotation, timers, scoring,
-- reconnect handling and recap are identical, and a second state machine
-- would have to duplicate all of it. The mode-specific columns live on the
-- existing rows instead.

-- A round now has a clue-writing phase between picking a word and guessing.
alter table public.rooms  drop constraint if exists rooms_status_check;
alter table public.rooms  add  constraint rooms_status_check
  check (status in ('lobby','picking','clue','drawing','intermission','finished'));

alter table public.rounds drop constraint if exists rounds_status_check;
alter table public.rounds add  constraint rounds_status_check
  check (status in ('picking','clue','drawing','ended'));

alter table public.rounds add column if not exists clue_text   text;
alter table public.rounds add column if not exists clue_source text
  check (clue_source is null or clue_source in ('human','clue_bank'));

-- How a guess was judged: exact, a forgiven typo, a listed synonym, or a miss.
alter table public.guesses add column if not exists match_type text not null default 'miss'
  check (match_type in ('exact','fuzzy','synonym','miss'));

-- Queryable mirror of the host's choice, derived so there is one source of truth.
alter table public.rooms add column if not exists game_mode text
  generated always as (coalesce(settings->>'gameMode', 'draw')) stored;

create index if not exists rooms_game_mode_idx on public.rooms (game_mode);

-- Clues contributed by players. The bundled bank ships in the app; this table
-- is how the pool grows from real play.
create table if not exists public.clue_bank (
  id         uuid primary key default gen_random_uuid(),
  word       text not null,
  clue_text  text not null,
  upvotes    integer not null default 0,
  created_at timestamptz not null default now(),
  unique (word, clue_text)
);

create index if not exists clue_bank_word_idx on public.clue_bank (word, upvotes desc);

-- Atomic increment: two upvotes landing together must not lose one.
create or replace function public.upvote_clue(p_clue_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.clue_bank set upvotes = upvotes + 1 where id = p_clue_id;
$$;

revoke execute on function public.upvote_clue(uuid) from anon, authenticated;

alter table public.clue_bank enable row level security;

-- Readable within a room like everything else; writes go through the server.
drop policy if exists clue_bank_read on public.clue_bank;
create policy clue_bank_read on public.clue_bank
  for select to anon, authenticated
  using (public.request_room_id() is not null);

revoke insert, update, delete on public.clue_bank from anon, authenticated;
