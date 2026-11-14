-- =============================================================================
-- GMAIL CONNECTION: one-off setup for Supabase
-- =============================================================================
-- Run this ONCE in Supabase → SQL Editor → New query → paste → Run.
-- It creates the table that remembers Lars's Gmail connection (made when he
-- presses "Connect Gmail" on the Inbox tab). Safe to run twice.
--
-- It holds Google's "refresh token": a long-lived pass that lets Mission
-- Control read the inbox and save drafts. On its own it's useless: Google also
-- needs the GOOGLE_CLIENT_SECRET, which only lives in Netlify. Lars can cancel
-- it any time with "Disconnect", or in his Google account under Security →
-- Third-party connections.
-- =============================================================================

create table if not exists public.gmail_connection (
  id             int primary key default 1 check (id = 1),  -- only ever one row
  email          text not null,                             -- the connected Gmail address
  refresh_token  text not null,
  scopes         text not null default '',
  connected_at   timestamptz not null default now()
);

-- Locked to the public: only Mission Control's server functions can read or
-- change it (they use the secret key). No policies on purpose.
alter table public.gmail_connection enable row level security;
