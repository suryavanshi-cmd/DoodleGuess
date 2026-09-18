-- Row level security.
--
-- Every write goes through the Next.js API routes using the service role, which
-- bypasses RLS; these policies govern what an anonymous browser key may read if
-- it talks to PostgREST directly. The room code is the capability: you can read
-- a room's data only by presenting its code in the x-room-code header.

create or replace function public.request_room_code()
returns text
language sql
stable
as $$
  select nullif(upper(coalesce(
    current_setting('request.headers', true)::json ->> 'x-room-code', ''
  )), '')
$$;

create or replace function public.request_room_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.rooms where code = public.request_room_code()
$$;

alter table public.rooms         enable row level security;
alter table public.players       enable row level security;
alter table public.rounds        enable row level security;
alter table public.round_secrets enable row level security;
alter table public.guesses       enable row level security;
alter table public.feed_entries  enable row level security;
alter table public.strokes       enable row level security;
alter table public.word_packs    enable row level security;

drop policy if exists rooms_read on public.rooms;
create policy rooms_read on public.rooms
  for select to anon, authenticated
  using (code = public.request_room_code());

drop policy if exists players_read on public.players;
create policy players_read on public.players
  for select to anon, authenticated
  using (room_id = public.request_room_id());

drop policy if exists rounds_read on public.rounds;
create policy rounds_read on public.rounds
  for select to anon, authenticated
  using (room_id = public.request_room_id());

drop policy if exists guesses_read on public.guesses;
create policy guesses_read on public.guesses
  for select to anon, authenticated
  using (room_id = public.request_room_id());

-- Private feed rows (hints, "almost!", filter notices) are never readable here;
-- they reach their one recipient through that player's authenticated API call.
drop policy if exists feed_read on public.feed_entries;
create policy feed_read on public.feed_entries
  for select to anon, authenticated
  using (room_id = public.request_room_id() and private_to is null);

drop policy if exists strokes_read on public.strokes;
create policy strokes_read on public.strokes
  for select to anon, authenticated
  using (exists (
    select 1 from public.rounds r
    where r.id = strokes.round_id and r.room_id = public.request_room_id()
  ));

drop policy if exists word_packs_read on public.word_packs;
create policy word_packs_read on public.word_packs
  for select to anon, authenticated
  using (room_id = public.request_room_id());

-- No policy at all on round_secrets: the live word is server-only.
revoke all on public.round_secrets from anon, authenticated;

-- Session tokens are write-only from the clients' point of view.
revoke select (token_hash) on public.players from anon, authenticated;

-- Clients never write directly; the API routes do it with the service role.
revoke insert, update, delete on
  public.rooms, public.players, public.rounds, public.guesses,
  public.feed_entries, public.strokes, public.word_packs
from anon, authenticated;
