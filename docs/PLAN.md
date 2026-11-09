# Mission Control — Review & Plan

_Review round 2 · 10 Nov 2026 · Eric (Zignet) · for the meeting with Lars on Wednesday_

## The short version

Mission Control looks good and the idea is right: a team of named AI helpers, each with a
clear job. The problems are underneath:

1. **Anyone on the internet could use Brandboy's Anthropic account** through the site.
   **Fixed** on the new branch (passcode + server-side rules).
2. **Memory and Activity Log have never worked.** The files were in a broken folder, so
   they were switched off with placeholders. **Files repaired.** They stay off until there's
   a login (otherwise prospect data would be public).
3. **The page promises more than it does.** "7 agents live 24/7", "tracks opens", "queues
   follow-ups automatically" — none of that happens yet. Agents only answer when you
   chat, can't search the web, and forget everything on refresh.
4. **No safe way to make changes.** 25 commits named "Update MissionControl.jsx" in one
   day, edited on the GitHub website, in one file of very long lines. **Fixed**: Claude
   Code set-up with guard rails (below).

---

## 1. What was found and what's been done

Branch: `setup/lars-starter-kit` (local, not pushed yet).

| #   | Finding                                                                                                                                                                                                | Severity | Status                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/api/ask-agent` has no login. Any caller can choose the **model**, the **instructions** and the **length**, all billed to Brandboy. Confirmed live: the endpoint answers anonymous requests.          | Critical | **Fixed**: passcode required; agent picked by id; model and instructions set on the server; size limits                         |
| 2   | `src/   lib/` folder name has spaces, one file name has back-ticks, each file starts with a stray line (`jsx`, `javascript`, …). Supabase package not installed. Importing them would break the build. | High     | **Fixed**: moved to `src/lib/`, cleaned, package installed. Still not switched on                                               |
| 3   | Supabase key and URL hard-coded in code                                                                                                                                                                | Medium   | **Fixed**: moved to `.env` / Netlify variables. (It's the public "anon" key; the real protection is Row Level Security, see #4) |
| 4   | Supabase tables `agent_memory` and `activity_log` exist; the public key reads 0 rows. Either they're empty or RLS is on. Can't confirm without dashboard access                                        | Medium   | **To check** in Supabase dashboard before phase 2                                                                               |
| 5   | `.claude/settings.local.json` committed, allowing `netlify deploy`, `curl *`, `brew install *`. Deploying from the laptop means live may stop matching GitHub (today it does match: checked)           | Medium   | **Fixed**: untracked + git-ignored; deploying from laptop is now blocked                                                        |
| 6   | Whole app in one 104-line file with lines thousands of characters long, so changes can't be compared or reviewed                                                                                       | Medium   | **Improved**: formatted (now readable); agents moved to `src/agents.js`                                                         |
| 7   | Leftover Vite template (`App.jsx`, `App.css`, logos, template README)                                                                                                                                  | Low      | **Removed**; README rewritten for Lars                                                                                          |
| 8   | Model hard-coded (`claude-sonnet-4-6`) and overridable from the browser                                                                                                                                | Low      | **Fixed**: `ANTHROPIC_MODEL` variable, default `claude-sonnet-5-5`                                                              |
| 9   | Answers capped at 1000 tokens, so long pieces (blog posts, sequences) get cut off. Can't simply raise it: Netlify cuts functions off after ~10s                                                        | Medium   | **Open**: needs streaming (A3)                                                                                                  |
| 10  | Activity Log's agent list (SPARKY, REX, NOVA, PIXEL) doesn't match the real agents                                                                                                                     | Low      | **Open**: fix when switched on                                                                                                  |
| 11  | No `.env.example`, no setup notes, no `npm run check`, no formatter                                                                                                                                    | Low      | **Fixed**                                                                                                                       |

### The Claude Code kit (same approach as BLAQ, sized for one non-coder)

| Piece                    | BLAQ equivalent                 | What it does for Lars                                                                               |
| ------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`              | project CLAUDE.md               | Tells Claude who Lars is, to talk plain English, the file map, the rules                            |
| `guard-secrets` hook     | guard-secret-leak + guard-write | Blocks any API key being written into code; blocks editing `.env`                                   |
| `guard-commands` hook    | guard-bash                      | Blocks force-push, hard reset, folder deletes, laptop deploys, DB wipes; **asks before going live** |
| `format-on-write` hook   | format-on-write                 | Every file tidied automatically                                                                     |
| `before-finishing` hook  | stop-tests + stop-uncommitted   | Claude can't say "done" unless the site builds and the work is committed                            |
| `session-start` hook     | session-start                   | Claude opens by saying if anything is unsaved or not yet live                                       |
| `add-agent` skill        | domain agents                   | Step-by-step for the most common request: new or changed agent                                      |
| `save-and-publish` skill | deploy-via-agent + branching    | "save" / "put it live" / "undo" in Lars's words, with a safe undo path                              |

Deliberately **left out** from BLAQ: worktrees, dev/UAT/prod branches, sub-agents,
migrations, test enforcement. Too much ceremony for one person and one page. Revisit if the
app grows a database.

---

## 2. Suggested improvements

Effort: **S** = an hour or two · **M** = a day · **L** = several days

### A. Architecture

| #   | Improvement                                                                                                                | Why                                                                           | Effort |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------ |
| A1  | **Proper login** (Supabase Auth, email magic link, Lars only). Replaces the passcode; the server function checks the login | Unlocks everything that stores data. Passcode is a stop-gap                   | M      |
| A2  | **Row Level Security** on every table, owner-only                                                                          | Without it the public key can read/write prospect data                        | S      |
| A3  | **Stream replies** (words appear as they're written)                                                                       | Removes the ~10s limit → long answers stop getting cut off; feels much faster | M      |
| A4  | **Split the main screen** into components: Header, AgentSidebar, ChatView, AgentsGrid, StrategyView                        | Smaller files = Claude makes safer, smaller changes                           | S      |
| A5  | **GitHub check on every push** (`npm run check`) + **Netlify deploy previews** for branches                                | A broken change can't reach the live site; Lars can preview before going live | S      |
| A6  | **Cost controls**: Anthropic monthly spend limit, prompt caching on agent instructions, log tokens per request             | Predictable bill                                                              | S      |
| A7  | Later: agent definitions stored in the database with an **edit screen**                                                    | Lars tunes agents without touching code                                       | M      |

### B. What the agents can do (new capabilities)

| #   | Improvement                                                                                                                     | Why                                                                                                               | Effort          |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------- |
| B1  | **Brandboy company brief** shared by every agent: services, regions, typical job sizes, past clients, tone, what not to promise | Biggest quality jump for least effort. Today each agent knows one sentence about Brandboy                         | S               |
| B2  | **Web search** for SCOUT, HUNTER, RANKR (Anthropic's built-in web search tool, with sources)                                    | Today "find active tenders" **invents** plausible-sounding tenders and companies. Must fix before relying on them | M               |
| B3  | **Memory**: saved conversations + pinned facts per agent ("we already contacted Westfield")                                     | Agents stop starting from zero                                                                                    | M (needs A1/A2) |
| B4  | **Hand-offs**: "send this list to COMPOSER" → emails drafted for each prospect                                                  | Matches the strategy page's workflow                                                                              | M               |
| B5  | **Upload a document** (tender PDF, brief, plans) for an agent to read                                                           | Tender responses and quotes                                                                                       | M               |
| B6  | **Morning brief** (scheduled function): new tenders + follow-ups due, emailed to Lars                                           | Makes "working 24/7" true                                                                                         | M–L             |
| B7  | **Gmail drafts / CRM** (e.g. HubSpot) integration. Agents prepare, Lars approves and sends                                      | Removes copy-paste; keeps Lars in control                                                                         | L               |

### C. Fixes to what's there (functionality)

| #   | Improvement                                                                                | Effort |
| --- | ------------------------------------------------------------------------------------------ | ------ |
| C1  | Make the page truthful: remove "24/7 / live / tracks opens / queues follow-ups" until real | S      |
| C2  | Chats survive a refresh (browser storage now; database after A1)                           | S      |
| C3  | "New chat" button, and a "copy" button on every reply                                      | S      |
| C4  | Show replies formatted (headings, bullet lists, tables) instead of raw `**` symbols        | S      |
| C5  | Stop / retry buttons; friendly error messages                                              | S      |
| C6  | FORGE: either give it quick tasks or remove it. Claude Code is the real developer now      | S      |
| C7  | Activity Log: switch on after A1/A2, with the correct agent names                          | S      |

### D. Look and feel (UI)

| #   | Improvement                                                                               | Effort |
| --- | ----------------------------------------------------------------------------------------- | ------ |
| D1  | **Works on a phone** (sidebar becomes a menu; grids stack). Lars is often on site         | M      |
| D2  | Bigger, higher-contrast text (lots of 9–11px grey on near-black)                          | S      |
| D3  | Strategy page becomes a **tracker** (tick off steps, see progress) instead of static text | M      |
| D4  | Agent cards keyboard-accessible (real buttons), focus outlines                            | S      |
| D5  | Agent "workspace" panel next to chat: saved outputs (lists, emails) to reuse              | M      |

### Suggested order

1. **Now (this branch):** security fix + kit. **Done.**
2. **Next 1–2 weeks (Lars with Claude):** B1, C1–C6, D2, A4. All small, all safe, good
   practice for the workflow.
3. **Phase 2 (Eric, ~1 week):** A1 + A2 → B3 + C7; A3; A5; A6.
4. **Phase 3 (together):** B2 → B4 → B5 → B6 → D1 → B7.

---

## 3. How Lars should work

**The loop:** ask in plain words → Claude says the plan → "yes" → Claude changes, checks,
saves → Lars looks at it locally → "put it live" (or "undo that").

**Lars does himself (with Claude):** agent wording, new agents, quick tasks, text,
colours, layout tweaks, small features from list C/D.

**Bring in Eric for:** anything with logins, the database, money, emails going out, other
systems (CRM, Gmail), or whenever Claude says "bigger change" or a guard rail blocks
something.

**Rules of thumb:** one change at a time · always look before going live · never paste a
key into the chat or the code · if in doubt, "save point" first.

---

## 4. Wednesday

### Before the meeting (Eric)

- [ ] Get write access to the GitHub repo (or Lars forks/accepts a pull request)
- [ ] In Netlify: confirm the site deploys **from GitHub** (Deploys page), and add
      `APP_PASSCODE` **before** merging, or the AI stops answering
- [ ] Anthropic console: set a monthly spend limit; check recent usage for anything odd
      (endpoint was open). Rotate the key if in doubt
- [ ] Supabase dashboard: check RLS on `agent_memory` and `activity_log` (finding #4)
- [ ] Merge the branch → check the live site with the passcode

### Agenda (~60 min)

| Time   | Topic                                                                                                 |
| ------ | ----------------------------------------------------------------------------------------------------- |
| 10 min | **What I found and fixed:** section 1 in plain words; show the passcode prompt                        |
| 20 min | **Set up his Mac:** Node, Git, Claude desktop app, clone, `.env`, `npx netlify dev`                   |
| 15 min | **Live demo of the loop:** Lars adds an agent himself using `add-agent`, previews, says "put it live" |
| 10 min | **Pick priorities:** walk section 2, Lars picks his top 3                                             |
| 5 min  | **Who does what:** offer Eric to do phase 2 (and/or any item), or Lars does list C/D himself          |

### Questions for Lars

1. Which agents does he actually use today? Which give bad answers?
2. Is the live URL shared with anyone else? (affects login choice)
3. Where do his prospects/contacts live now: spreadsheet, CRM, email?
4. Would he rather do changes himself, or have Eric do them and just review?
5. Budget comfort for Anthropic usage per month?
