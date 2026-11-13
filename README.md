# Brandboy Mission Control

Lars's AI agent command centre: one page where you chat with Brandboy's AI team
(SCOUT, COMPOSER, HUNTER, OPS, RANKR, NEXUS, FORGE).

Live: https://dreamy-taffy-27a291.netlify.app

---

## How to work on it (for Lars)

You don't write the code; you tell Claude what you want and check the result.

1. Open the **Claude desktop app → Code tab**, and pick this folder.
2. Say what you want in plain words: _"Add an agent that writes quotes"_,
   _"Make the chat text bigger"_, _"The COMPOSER emails are too long"_.
3. Claude explains the plan in a few lines → you say yes.
4. Claude makes the change, checks that it builds, and makes a **save point** (commit).
5. You look at it on your computer: Claude will start it and tell you what to click.
6. Happy? Say **"put it live"**. It's on the website in about 2 minutes.
7. Not happy? Say **"undo that"**. Nothing is ever lost.

Safety rails are built in. Claude can't put keys in the code, delete work, or put
anything live without asking you first.

### Good habits

- One change at a time. Small requests work best.
- Always look at it locally before saying "put it live".
- If Claude says something is risky or "a bigger change", that's the moment to call Eric.

---

## First-time setup (Eric does this with Lars)

1. Install **Node.js 22 or newer** (https://nodejs.org) and **Git**.
2. Get the code: `git clone https://github.com/lottosson-dotcom/brandboy-mission-control.git`
3. In the folder: `npm install`
4. Copy `.env.example` to `.env` and fill in the Anthropic key and a passcode.
5. Install the Netlify command line and link the site: `npm i -g netlify-cli`, then
   `netlify login` and `netlify link`.
6. Run it: `npx netlify dev` → http://localhost:8888

### Live site settings (Netlify → Site configuration → Environment variables)

| Name                            | What                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY`             | Anthropic API key (set a monthly spend limit at console.anthropic.com)                                                               |
| `APP_PASSCODE`                  | Old shared passcode. Delete it once the login works, to switch the passcode off                                                      |
| `ALLOWED_EMAILS`                | Who can log in, comma-separated, e.g. `lars@brandboy.com.au,eric@zignet.com.au`                                                      |
| `VITE_SUPABASE_URL`             | `https://igwmwhcnsmsxicmepvnj.supabase.co` (for the login; safe to be public)                                                        |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API keys → **Publishable key** (`sb_publishable_…`; safe to be public)                                 |
| `ANTHROPIC_MODEL`               | Optional. Defaults to `claude-sonnet-5-5`                                                                                            |
| `SUPABASE_URL`                  | `https://igwmwhcnsmsxicmepvnj.supabase.co` (for the Activity Log)                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase → Project Settings → API keys → the **Secret key** (`sb_secret_…`). Mark as **secret**. Server only: never name it `VITE_…` |

## Project layout

See `CLAUDE.md` for the map of files and the rules Claude follows.
See `docs/PLAN.md` for the review findings and roadmap.
