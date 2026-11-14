-- =============================================================================
-- CONTACTS: one-off setup for Supabase
-- =============================================================================
-- Run this ONCE in Supabase → SQL Editor → New query → paste → Run.
-- It creates the table for Brandboy's customers, suppliers and prospects, and
-- locks it like the other tables. Safe to run twice.
-- After this, contacts are managed on the "Contacts" tab in Mission Control
-- (including the one-off import from Excel). The inbox agent will use it to
-- recognise who an email is from.
-- =============================================================================

create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'customer'
              check (kind in ('customer', 'supplier', 'prospect')),
  company     text not null default '',
  name        text not null default '',     -- the person
  email       text not null default '',
  phone       text not null default '',
  notes       text not null default '',
  source      text not null default 'manual', -- manual | import | inbox
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Fast look-ups by email address (used when matching incoming emails).
create index if not exists contacts_email_idx on public.contacts (lower(email));

-- Locked to the public: only Mission Control's server functions can read or
-- change it (they use the secret key). No policies on purpose.
alter table public.contacts enable row level security;
