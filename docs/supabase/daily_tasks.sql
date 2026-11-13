-- =============================================================================
-- DAILY TASKS: one-off setup for Supabase
-- =============================================================================
-- Run this ONCE in Supabase → SQL Editor → New query → paste → Run.
-- It creates the table that holds each agent's daily tasks (what they do by
-- themselves every morning), locks it like the other tables, and adds the two
-- starting tasks (NSW and QLD signage tenders). Safe to run twice.
-- After this, tasks are managed on the "Daily Tasks" tab in Mission Control.
-- =============================================================================

create table if not exists public.daily_tasks (
  id          uuid primary key default gen_random_uuid(),
  agent_id    text not null,                -- e.g. 'hunter' (see src/agents.js)
  name        text not null,                -- short title, shown in the Activity Log
  prompt      text not null,                -- what the agent should do, in plain words
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Locked to the public: only Mission Control's server functions can read or
-- change it (they use the secret key). No policies on purpose.
alter table public.daily_tasks enable row level security;

-- Starting tasks (only added if the table is empty).
insert into public.daily_tasks (agent_id, name, prompt)
select * from (values
  ('hunter',
   'NSW government signage tenders',
   'Find currently open New South Wales government and council tenders for signage, wayfinding, branding or display work. Check NSW eTendering (tenders.nsw.gov.au) first. For each tender give the title, the buyer, the closing date, the value if shown, and the link. Mark anything over $500K as PRIORITY.'),
  ('hunter',
   'QLD government signage tenders',
   'Find currently open Queensland government and council tenders for signage, wayfinding, branding or display work. Check QTenders (qtenders.epw.qld.gov.au) first. For each tender give the title, the buyer, the closing date, the value if shown, and the link. Mark anything over $500K as PRIORITY.')
) as starting(agent_id, name, prompt)
where not exists (select 1 from public.daily_tasks);
