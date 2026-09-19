-- Per-turn custom words: the drawer may type their own answer instead of
-- taking one of the three suggestions.

alter table public.rounds add column if not exists word_source text not null default 'suggested'
  check (word_source in ('suggested','custom'));

-- Only set while the host is deciding, or after they have decided.
alter table public.rounds add column if not exists custom_word_status text
  check (custom_word_status is null or custom_word_status in ('pending','approved','rejected'));

-- A proposed word waiting on the host lives beside the live word, in the table
-- guessers cannot read. It only becomes `word` once the turn actually starts.
alter table public.round_secrets add column if not exists pending_word text;

create table if not exists public.my_words (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  word       text not null,
  created_at timestamptz not null default now(),
  unique (player_id, word)
);

create index if not exists my_words_player_idx on public.my_words (player_id, created_at desc);

alter table public.my_words enable row level security;

-- A player's saved words are theirs; they are served through the API, which
-- authenticates the player token. No anonymous access at all.
revoke all on public.my_words from anon, authenticated;
