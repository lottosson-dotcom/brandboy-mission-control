-- =============================================================================
-- ACTIVITY LOG: one-off setup for Supabase
-- =============================================================================
-- Run this ONCE in Supabase → SQL Editor → New query → paste → Run.
-- The Activity Log tab shows what the agents did (chat answers, daily task
-- reports, inbox checks). Safe to run twice.
--
-- Brandboy's project already had this table from before Mission Control's
-- rebuild, with the text column called "details". The code uses "detail", so
-- nothing could be saved until it was renamed (done 16 Nov 2026). The rename
-- below only happens if the old name is still there.
-- =============================================================================

create table if not exists public.activity_log (
  id              uuid primary key default gen_random_uuid(),
  agent_name      text not null,
  action          text not null,
  detail          text,
  client_project  text,
  color           text default '#6B7280',
  created_at      timestamptz default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'activity_log' and column_name = 'details'
  ) then
    alter table public.activity_log rename column details to detail;
  end if;
end $$;

create index if not exists activity_log_created_at on public.activity_log (created_at desc);

-- Locked: only Mission Control's server functions (secret key) can read or write it.
alter table public.activity_log enable row level security;
