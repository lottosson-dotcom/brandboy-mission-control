-- =============================================================================
-- INBOX ITEMS: one-off setup for Supabase
-- =============================================================================
-- Run this ONCE in Supabase → SQL Editor → New query → paste → Run.
-- Each row is one email the inbox agent has sorted: what kind it is (lead,
-- enquiry, customer, supplier, other), a one-line summary, who it's from (and
-- whether they're in Contacts), and the reply draft it saved in Gmail.
-- Also stops the same email being sorted twice. Safe to run twice.
-- =============================================================================

create table if not exists public.inbox_items (
  id            uuid primary key default gen_random_uuid(),
  message_id    text not null unique,          -- Gmail's id for the email
  thread_id     text not null default '',
  from_name     text not null default '',
  from_email    text not null default '',
  subject       text not null default '',
  received_at   timestamptz,
  category      text not null default 'other'
                check (category in ('lead', 'enquiry', 'customer', 'supplier', 'other')),
  summary       text not null default '',
  needs_reply   boolean not null default false,
  draft_id      text not null default '',      -- Gmail draft, when one was saved
  contact_id    uuid,                          -- the matching contact, if any
  contact_kind  text not null default '',      -- customer | supplier | prospect | ''
  contact_name  text not null default '',      -- company (or person) from Contacts
  status        text not null default 'new' check (status in ('new', 'done')),
  created_at    timestamptz not null default now()
);

create index if not exists inbox_items_received_idx on public.inbox_items (received_at desc);

-- Locked to the public: only Mission Control's server functions can read or
-- change it (they use the secret key). No policies on purpose.
alter table public.inbox_items enable row level security;
