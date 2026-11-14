// =============================================================================
// SERVER FUNCTION: "Run now" for the daily tasks
// =============================================================================
// POST /api/run-scans              runs every switched-on task now
// POST /api/run-scans?id=<task id> runs just that one task (even if it's off)
// Needs the passcode. Handy for testing a new task straight away.
// =============================================================================
import { reply, checkAccess, databaseIsSetUp, TableMissingError } from "../lib/server.js";
import { runTasks } from "../lib/scans.js";

export default async (req) => {
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  const denied = await checkAccess(req);
  if (denied) return denied;
  if (!databaseIsSetUp()) {
    return reply(400, {
      error: "The Activity Log isn't connected, so reports can't be saved.",
    });
  }
  try {
    const id = new URL(req.url).searchParams.get("id") || undefined;
    return reply(200, { results: await runTasks(id) });
  } catch (err) {
    if (err instanceof TableMissingError) {
      return reply(400, { error: "Daily tasks aren't set up yet (Eric: run the setup script)." });
    }
    console.error(err);
    return reply(502, { error: "The tasks couldn't run. Try again in a minute." });
  }
};

export const config = {
  path: "/api/run-scans",
};
