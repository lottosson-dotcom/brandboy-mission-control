// =============================================================================
// SERVER FUNCTION: the Activity Log
// =============================================================================
// GET /api/activity returns the most recent things the agents have done.
// Needs the passcode, like the chat. Entries are written by ask-agent.js after
// each answer. See netlify/lib/server.js for the database settings.
// =============================================================================
import { reply, checkAccess, databaseIsSetUp, readActivity } from "../lib/server.js";

export default async (req) => {
  if (req.method !== "GET") return reply(405, { error: "Method not allowed" });
  const denied = await checkAccess(req);
  if (denied) return denied;
  if (!databaseIsSetUp()) return reply(200, { entries: [], notSetUp: true });
  try {
    return reply(200, { entries: await readActivity(100) });
  } catch (err) {
    console.error(err);
    return reply(502, { error: "Couldn't load the activity log. Try Refresh." });
  }
};

export const config = {
  path: "/api/activity",
};
