---
name: save-and-publish
description: Use when Lars says save, commit, publish, deploy, push, put it live, ship it, or undo / roll back / go back to how it was. Explains the save → check → live flow and how to undo safely.
---

# Save, publish and undo

Lars's words → what they mean:

| Lars says              | Means                  | Command                            |
| ---------------------- | ---------------------- | ---------------------------------- |
| "save" / "save point"  | commit (not live)      | `git add -A` + `git commit -m "…"` |
| "put it live" / "ship" | push to GitHub `main`  | `git push`                         |
| "undo" / "go back"     | new commit that undoes | `git revert <commit>`              |

## Save (commit)

1. `npm run check` must pass.
2. `git status` and tell Lars in one line which things changed.
3. `git add -A` then `git commit -m "<plain English: what changed for Lars>"`.

## Put it live (push)

1. Confirm Lars has tried it locally (`npx netlify dev`). If not, offer to start it.
2. Tell him: "This will be live on the website in about 2 minutes. OK?" Wait for yes.
3. `git push`. The guard hook will also ask; that's expected.
4. Tell him to check the live site after ~2 minutes and hard-refresh (Ctrl/Cmd+Shift+R).

## Undo

- **Not saved yet** and he wants to throw it away: list the files, confirm, then
  `git restore <file>` for each named file. Never `git reset --hard` (blocked).
- **Saved / live**: `git log --oneline -10`, pick the commit with him in plain words,
  `git revert <hash>`, check, commit, then ask before pushing.
- **Live site broken right now**: fastest fix is in Netlify → Deploys → pick the
  previous good deploy → "Publish deploy". Then revert in git so GitHub matches.

## Never

- `git push --force`, `git reset --hard`, `netlify deploy --prod` (all blocked).
- Push without Lars saying yes.
