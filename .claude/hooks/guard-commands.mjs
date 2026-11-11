// Hook: runs BEFORE Claude runs a terminal command.
// Blocks the handful of commands that can lose work or put an untested
// version live, and asks Lars before anything goes live.
// Adapted from the BLAQ guard-bash hook (much smaller: one person, one site).
let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  let cmd = "";
  try {
    cmd = (JSON.parse(raw).tool_input || {}).command || "";
  } catch {
    process.exit(0);
  }

  const decide = (decision, reason) => {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: decision,
          permissionDecisionReason: `guard-commands: ${reason}`,
        },
      }),
    );
    process.exit(0);
  };

  // Only look at the actual command at the start of each part of the line,
  // not at words inside a commit message.
  const heads = cmd.split(/&&|\|\||[;|\n]/).map((s) => s.trim());
  const has = (re) => heads.some((h) => re.test(h));

  if (has(/^git\s+push\b.*\s(--force|-f)(\s|$)/)) {
    decide("deny", "force-push rewrites GitHub history and can delete work.");
  }
  if (
    has(/^git\s+reset\s+--hard\b/) ||
    has(/^git\s+clean\s+-[a-z]*f/) ||
    has(/^git\s+(checkout|restore)\s+(--\s+)?\.$/)
  ) {
    decide(
      "deny",
      "this throws away unsaved changes permanently. Make a commit (save point) instead, or ask Lars.",
    );
  }
  if (
    has(/^rm\s+-[a-zA-Z]*r/) &&
    !/^rm\s+-[a-zA-Z]*r[a-zA-Z]*\s+(node_modules|dist)\/?$/.test(heads.find((h) => /^rm\s/.test(h)))
  ) {
    decide("deny", "deleting folders is blocked. Delete specific files, or ask Lars first.");
  }
  if (has(/^(npx\s+)?(netlify|ntl)\s+deploy\b.*--prod/)) {
    decide(
      "deny",
      "don't deploy from this computer. The live site must always come from GitHub, so what's live = what's saved. Use the save-and-publish skill.",
    );
  }
  if (
    has(/^(npx\s+)?supabase\s+db\s+(reset|push)\b/) ||
    /\bdrop\s+(table|database|schema)\b/i.test(cmd)
  ) {
    decide(
      "deny",
      "this changes or wipes the live database. Database changes are done with Eric for now.",
    );
  }
  if (has(/^git\s+push\b/)) {
    decide(
      "ask",
      "pushing to GitHub puts this change LIVE on the website within a couple of minutes. Approve only if Lars has tried it locally.",
    );
  }

  process.exit(0);
});
