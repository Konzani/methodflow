-- Run once in Supabase → SQL Editor.
create table if not exists public.shares (
  slug text primary key check (slug ~ '^[A-Za-z0-9_-]{12}$'),
  ir jsonb not null check (pg_column_size(ir) < 200000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days'
);
create index if not exists shares_expires_idx on public.shares (expires_at);

-- RLS on with NO policies = deny all for anon/authenticated roles.
-- Only the server (service role key) can read or write.
alter table public.shares enable row level security;

-- Optional nightly cleanup (enable the pg_cron extension first):
-- select cron.schedule('purge-shares','0 3 * * *',$$delete from public.shares where expires_at < now()$$);
