// Hook: runs when a Claude session opens. Tells Claude where things stand,
// so it can tell Lars in plain English before starting work.
// Adapted from the BLAQ session-start hook.
import { execSync } from "node:child_process";

const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const run = (c) => {
  try {
    return execSync(c, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};

const branch = run("git branch --show-current") || "(unknown)";
const changes = run("git status --porcelain");
const recent = run('git log -5 --format="%h %ad %s" --date=short');
const notPushed = run("git rev-list --count @{u}..HEAD");

const lines = [
  "Mission Control project status:",
  `- Branch: ${branch}`,
  changes ? `- UNSAVED changes from last time:\n${changes}` : "- No unsaved changes.",
  notPushed && notPushed !== "0"
    ? `- ${notPushed} saved change(s) not yet on GitHub (not live).`
    : "",
  `- Last saves:\n${recent}`,
  "If anything is unsaved or not yet live, tell Lars in one plain sentence before starting.",
].filter(Boolean);

console.log(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: lines.join("\n") },
  }),
);
