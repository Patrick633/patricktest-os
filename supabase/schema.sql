-- Life OS · cloud sync table
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- One row per user holding the whole Life OS state. Row-level security makes sure
-- each signed-in person can only ever read or write their own row.

create table if not exists public.lifeos_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  device     text
);

alter table public.lifeos_state enable row level security;

drop policy if exists "read own state"   on public.lifeos_state;
drop policy if exists "insert own state" on public.lifeos_state;
drop policy if exists "update own state" on public.lifeos_state;
drop policy if exists "delete own state" on public.lifeos_state;

create policy "read own state"   on public.lifeos_state for select using (auth.uid() = user_id);
create policy "insert own state" on public.lifeos_state for insert with check (auth.uid() = user_id);
create policy "update own state" on public.lifeos_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own state" on public.lifeos_state for delete using (auth.uid() = user_id);

-- Only signed-in users may use this table through the Data API (and RLS above limits them to their own row).
-- Needed when "Grant API access to new tables automatically" is off.
revoke all on public.lifeos_state from anon;
grant select, insert, update, delete on public.lifeos_state to authenticated;
