// Hook: runs BEFORE Claude edits or creates a file.
// Blocks (1) editing the real .env file and (2) writing any secret key into a file.
// A blocked write costs nothing; a key leaked to GitHub costs money and a weekend.
// Adapted from the BLAQ guard-secret-leak / guard-write hooks.
const PATTERNS = [
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, "Anthropic API key"],
  [/\bsk_(live|test)_[A-Za-z0-9]{10,}/, "Stripe secret key"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/, "GitHub token"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
];

function isServiceRoleJwt(text) {
  const jwts = text.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || [];
  for (const jwt of jwts) {
    try {
      const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
      if (payload.role === "service_role") return true;
    } catch {
      // not a real token — ignore
    }
  }
  return false;
}

function deny(reason) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `guard-secrets: ${reason}`,
      },
    }),
  );
  process.exit(0);
}

let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(raw).tool_input || {};
  } catch {
    process.exit(0);
  }

  const file = (input.file_path || "").replace(/\\/g, "/");
  if (/(^|\/)\.env(\.[^/]+)?$/.test(file) && !file.endsWith(".env.example")) {
    deny("the .env file holds real keys. Lars edits it himself; only change .env.example.");
  }

  const text = `${input.content || ""}\n${input.new_string || ""}`;
  for (const [re, label] of PATTERNS) {
    if (re.test(text)) {
      deny(
        `${label} found in the text being written. Keys belong in .env (on this computer) ` +
          `or Netlify environment variables (live site), never in code. ` +
          `Use a dummy value like sk-ant-xxx in examples.`,
      );
    }
  }
  if (isServiceRoleJwt(text)) {
    deny(
      "Supabase service_role key found. It bypasses all database security and must never be in code or the website.",
    );
  }
  process.exit(0);
});
