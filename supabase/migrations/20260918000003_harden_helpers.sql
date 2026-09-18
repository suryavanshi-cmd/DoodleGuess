-- Advisor follow-up: pin search_path on both helpers, and drop SECURITY DEFINER
-- from request_room_id. As an invoker function it is still correct — rooms' own
-- policy already limits it to the room whose code the caller presented — and it
-- no longer exposes a definer-rights function on /rest/v1/rpc.
-- The cascade drops the policies that depend on it; they are recreated below.

drop function if exists public.request_room_id() cascade;

create or replace function public.request_room_code()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select nullif(upper(coalesce(
    current_setting('request.headers', true)::json ->> 'x-room-code', ''
  )), '')
$$;

create function public.request_room_id()
returns uuid
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select id from public.rooms where code = public.request_room_code()
$$;

create policy players_read on public.players
  for select to anon, authenticated
  using (room_id = public.request_room_id());

create policy rounds_read on public.rounds
  for select to anon, authenticated
  using (room_id = public.request_room_id());

create policy guesses_read on public.guesses
  for select to anon, authenticated
  using (room_id = public.request_room_id());

create policy feed_read on public.feed_entries
  for select to anon, authenticated
  using (room_id = public.request_room_id() and private_to is null);

create policy strokes_read on public.strokes
  for select to anon, authenticated
  using (exists (
    select 1 from public.rounds r
    where r.id = strokes.round_id and r.room_id = public.request_room_id()
  ));

create policy word_packs_read on public.word_packs
  for select to anon, authenticated
  using (room_id = public.request_room_id());
