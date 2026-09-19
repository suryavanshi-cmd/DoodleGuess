-- The column-level REVOKE in the RLS migration was a no-op: while a role still
-- holds table-level SELECT, revoking one column changes nothing (verified — an
-- anonymous request could read players.token_hash). Drop the table grant and
-- re-grant every column except the token hash.
--
-- Side effect: `select=*` as anon now fails on this table, because PostgREST
-- asks for every column. Clients must name the columns they want. The app does
-- not read players over PostgREST at all — the API routes use the service role.

revoke select on public.players from anon, authenticated;

grant select (
  id, room_id, name, avatar, score, is_host, is_drawing, connected, connected_at,
  last_seen_at, left_at, turns_drawn, streak, best_streak, guesses_made,
  correct_guesses, total_guess_ms, points_from_drawing, frozen_until, joined_at
) on public.players to anon, authenticated;
