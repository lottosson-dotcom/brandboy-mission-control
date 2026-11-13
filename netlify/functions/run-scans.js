// =============================================================================
// SERVER FUNCTION: "Run scans now" button on the Activity Log tab
// =============================================================================
// POST /api/run-scans runs the daily scans straight away (needs the passcode).
// Handy for testing, or for a fresh look in the middle of the day.
// =============================================================================
import { reply, checkPasscode, databaseIsSetUp } from "../lib/server.js";
import { runAllScans } from "../lib/scans.js";

export default async (req) => {
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  const denied = checkPasscode(req);
  if (denied) return denied;
  if (!databaseIsSetUp()) {
    return reply(400, {
      error: "The Activity Log isn't connected, so scan reports can't be saved.",
    });
  }
  try {
    return reply(200, { results: await runAllScans() });
  } catch (err) {
    console.error(err);
    return reply(502, { error: "The scans couldn't run. Try again in a minute." });
  }
};

export const config = {
  path: "/api/run-scans",
};
