// Hook: runs when Claude thinks it is DONE.
//   1. If code changed, the site must still build (npm run lint + build).
//   2. Changes must be saved as a commit (a "save point") so nothing is lost
//      and Lars can always go back.
// If either fails, Claude is sent back to sort it out.
// Adapted from the BLAQ stop-tests and stop-uncommitted hooks.
// Loop-guarded: it only pushes back once per stop.
import { execSync } from "node:child_process";

let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    // no input — carry on
  }
  if (input.stop_hook_active) process.exit(0);

  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const run = (c) => execSync(c, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const block = (reason) => {
    console.log(JSON.stringify({ decision: "block", reason }));
    process.exit(0);
  };

  let changes = "";
  try {
    changes = run("git status --porcelain").trim();
  } catch {
    process.exit(0);
  }
  if (!changes) process.exit(0);

  if (/\.(jsx?|mjs|json|css|html)$/m.test(changes)) {
    try {
      run("npm run lint");
      run("npm run build");
    } catch (e) {
      const out = `${e.stdout || ""}${e.stderr || ""}`.split("\n").slice(-25).join("\n");
      block(
        `The site no longer builds. Fix this before finishing, then explain the fix to Lars in plain English:\n\n${out}`,
      );
    }
  }

  block(
    `There are unsaved changes. Make a commit now with a plain-English message saying what changed ` +
      `for Lars (e.g. "Add QUOTER agent for writing quotes"). Do NOT push; ask Lars first.\n\n` +
      changes.split("\n").slice(0, 15).join("\n"),
  );
});
