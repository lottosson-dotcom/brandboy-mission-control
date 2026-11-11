// Hook: runs AFTER Claude edits a file. Tidies the layout with Prettier so
// every file looks the same and changes are easy to compare.
import { execFileSync } from "node:child_process";

let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  try {
    const file = JSON.parse(raw).tool_input?.file_path || "";
    if (/\.(jsx?|mjs|json|css|md)$/.test(file)) {
      execFileSync("npx", ["--no-install", "prettier", "--write", file], {
        stdio: "ignore",
        shell: process.platform === "win32",
      });
    }
  } catch {
    // formatting is a nice-to-have; never block on it
  }
  process.exit(0);
});
