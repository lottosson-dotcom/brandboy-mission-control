# Brandboy Mission Control — instructions for Claude

## Who you are working with

**Lars** owns Brandboy (Australian commercial fit-out, signage and refurbishment) and is
the only user of this app. **Lars is not a programmer.** He knows what he wants the app to
do; he relies on you for how.

- Talk in plain English. No jargon unless you explain it in the same sentence.
- Before changing anything bigger than a small tweak, say in 2–3 lines what you will
  change and what he will see, and wait for "yes".
- After a change, tell him **how to see it** (e.g. "refresh the page, click SCOUT").
- If a request is risky, expensive, or a bad idea, say so plainly and suggest the safer
  option. Do not just do it.
- If you are unsure what he means, ask one short question.
- Eric (Zignet) set this project up and helps with bigger changes. For anything involving
  the database, logins, payments, or deleting data, suggest bringing Eric in.

## What this app is

A single web page where Lars chats with a team of AI "agents" (SCOUT, COMPOSER, HUNTER,
OPS, RANKR, NEXUS, FORGE). Each agent is Claude with different instructions.

| Part            | Where                                          | What it does                                                                                   |
| --------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Agent list      | `src/agents.js`                                | Names, colours, instructions, quick tasks. **Start here.**                                     |
| Main screen     | `src/MissionControl.jsx`                       | Everything you see on the page                                                                 |
| Server function | `netlify/functions/ask-agent.js`               | Holds the Anthropic key, checks the login, calls Claude                                        |
| Login           | `src/lib/auth.js`, `src/components/Login*.jsx` | Email login link (Supabase Auth); who's allowed: `ALLOWED_EMAILS`                              |
| Company brief   | `src/agents.js` → `BRANDBOY_BRIEF`             | What every agent knows about Brandboy (Lars's wording)                                         |
| Daily tasks     | 🕕 Daily Tasks tab (`daily_tasks` table)       | What agents do by themselves each morning; Lars edits them in the app                          |
| Contacts        | 👥 Contacts tab (`contacts` table)             | Customers, suppliers, prospects; Excel import; used by the inbox agent                         |
| Inbox / Gmail   | 📥 Inbox tab, `netlify/lib/gmail.js`           | Lars connects Gmail; agents read it and save drafts (never send). Setup: `docs/gmail-setup.md` |
| Activity log    | `src/components/ActivityLog.jsx`               | Shows what agents did; read via `netlify/functions/activity.js`                                |
| Database access | `netlify/lib/server.js`                        | The ONLY code that talks to Supabase (server-side, service key)                                |

Hosting: **Netlify** builds the site from GitHub `main` automatically.
Pushing to `main` = **live within ~2 minutes**.

## Rules (the hooks in `.claude/hooks/` enforce most of these)

1. **Never put keys or passwords in code.** They go in `.env` (this computer) or Netlify
   environment variables (live site). `.env` is never committed and you must not read it.
2. **Every server function starts with `await checkAccess(req)`** (`netlify/lib/server.js`).
   It only lets in a logged-in user whose email is on `ALLOWED_EMAILS` (or the old
   passcode, while `APP_PASSCODE` is still set). Without it anyone could use Brandboy's
   Anthropic account. The browser never chooses the model or the agent instructions.
   The one exception is `gmail-callback.js` (Google's return trip can't carry the login);
   it only accepts the signed ticket that `/api/gmail` gives a logged-in user.
3. **Small steps.** One change at a time; make sure it works; commit; then the next.
4. **Always run `npm run check` before saying you're done.** It must pass. (The
   before-finishing hook runs lint + build automatically and sends you back if they fail.)
5. **Commit with plain-English messages** that Lars would understand:
   `Add QUOTER agent for writing quotes`, not `Update MissionControl.jsx`.
6. **Never push without asking Lars.** Pushing makes it live. Use the
   `save-and-publish` skill.
7. **Don't deploy from this computer** (`netlify deploy --prod` is blocked). Live must
   always come from GitHub so what's live = what's saved.
8. **Don't delete or overwrite work.** No `git reset --hard`, no force-push, no deleting
   folders. If something went wrong, make a new commit that fixes it.
9. **Reuse before you add.** Look for an existing component, colour or function before
   writing a new one. Agent data lives only in `src/agents.js`.
10. **The browser only uses Supabase to log in** (`src/lib/auth.js`). All data goes
    through server functions (`netlify/lib/server.js`) after `checkAccess`. The tables
    keep Row Level Security on with no policies, so the public key can't read anything.
    Never give the Supabase secret key a `VITE_` name (that would publish it).

## Coding standards

- React + Vite, plain JavaScript (`.js` / `.jsx`). No TypeScript for now.
- Prettier formats every file automatically (hook). Don't hand-format.
- New screens or panels go in `src/components/<Name>.jsx`, one component per file,
  small enough to read in one go (aim under ~200 lines).
- Colours: reuse the `C` palette at the top of `MissionControl.jsx`; don't invent new hex
  values.
- Anything that talks to the internet goes through `netlify/functions/`, never directly
  from the browser with a secret key.
- Every `fetch` must handle failure and show Lars a readable message, not a blank screen.
- Comments explain **why** in plain English, for a non-programmer reading the file.

## Useful commands

| Command           | What it does                                                    |
| ----------------- | --------------------------------------------------------------- |
| `npm install`     | Download the building blocks (once, or after a pull)            |
| `npx netlify dev` | Run the full app locally at http://localhost:8888 (with the AI) |
| `npm run dev`     | Run just the screen, no AI, at http://localhost:5173            |
| `npm run check`   | Lint + format check + build — must pass before committing       |

## Skills in this project

- `add-agent` — add or change an AI agent.
- `save-and-publish` — save work and (with Lars's OK) put it live; also how to undo.
