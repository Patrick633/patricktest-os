-- Life OS · vulnerability alerts (web push)
-- Devices that asked for alerts. Each person only sees and changes their own devices.
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  kev        boolean not null default true,
  device     text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "read own devices"   on public.push_subscriptions;
drop policy if exists "add own devices"    on public.push_subscriptions;
drop policy if exists "update own devices" on public.push_subscriptions;
drop policy if exists "remove own devices" on public.push_subscriptions;
create policy "read own devices"   on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "add own devices"    on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "update own devices" on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "remove own devices" on public.push_subscriptions for delete using (auth.uid() = user_id);
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Internal state for the alert job (last CISA entries seen). No policies: only the server can use it.
create table if not exists public.lifeos_meta (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);
alter table public.lifeos_meta enable row level security;
revoke all on public.lifeos_meta from anon, authenticated;

-- the alert function (server-side service role) needs these
grant select, insert, update, delete on public.lifeos_meta to service_role;
grant select, delete on public.push_subscriptions to service_role;
