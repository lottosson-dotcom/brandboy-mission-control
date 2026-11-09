---
name: add-agent
description: Use when Lars wants a new AI agent, or wants to change an existing agent's name, job, instructions, colour or quick tasks. Covers where agents are defined and how to test the change.
---

# Add or change an agent

All agents live in **`src/agents.js`**. Nothing else needs editing for a normal agent
change: the website and the server function both read this file.

## Steps

1. **Ask Lars (in one message)** for anything missing:
   - What should the agent do? (one sentence)
   - Name in CAPITALS (e.g. QUOTER) and an emoji
   - 3–4 example tasks he'd click on
2. **Copy an existing block** in `AGENTS` and change it:
   - `id`: short, lowercase, unique, never change it later (saved chats will use it)
   - `color`: pick one from the `C` palette in `MissionControl.jsx` not already used
   - `systemPrompt`: start with "You are NAME, Brandboy's …". Include: who Brandboy is,
     the agent's job, the tone (Australian, professional), and what format to answer in
     (e.g. "Answer as a table" or "Keep emails under 150 words").
3. **Add quick tasks** under the same `id` in `QUICK_TASKS`.
4. **Check**: `npm run check` must pass.
5. **Try it**: `npx netlify dev`, open http://localhost:8888, click the new agent, run
   one quick task. Tell Lars what to click.
6. **Commit**: `Add QUOTER agent for writing quotes`. Ask before pushing
   (`save-and-publish`).

## Don't

- Don't put agent instructions anywhere else (e.g. in `MissionControl.jsx`).
- Don't let the browser send instructions or a model name. The server picks them by `id`.
- Don't promise abilities the agent doesn't have. Agents can't browse the web, send
  emails, or run in the background yet. If Lars asks for that, explain it's a bigger
  change (see `docs/PLAN.md`) and suggest bringing Eric in.
