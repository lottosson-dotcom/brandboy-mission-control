// =============================================================================
// SERVER FUNCTION: the Gmail connection (the "Inbox" tab)
// =============================================================================
//   GET    /api/gmail            is Gmail connected? + the 5 newest emails
//   POST   /api/gmail            start connecting: returns the Google link
//   DELETE /api/gmail            disconnect (cancels the pass at Google too)
// The return trip from Google is netlify/functions/gmail-callback.js.
// =============================================================================
import {
  reply,
  checkAccess,
  databaseIsSetUp,
  readGmailConnection,
  deleteGmailConnection,
  TableMissingError,
} from "../lib/server.js";
import {
  gmailIsSetUp,
  googleLoginLink,
  accessKey,
  cancelPass,
  latestEmails,
} from "../lib/gmail.js";

export default async (req) => {
  const denied = await checkAccess(req);
  if (denied) return denied;
  if (!gmailIsSetUp() || !databaseIsSetUp()) return reply(200, { notSetUp: true });

  try {
    if (req.method === "POST") return reply(200, { url: googleLoginLink(req) });

    const connection = await readGmailConnection();

    if (req.method === "DELETE") {
      if (connection) {
        await cancelPass(connection.refresh_token);
        await deleteGmailConnection();
      }
      return reply(200, { connected: false });
    }

    if (req.method !== "GET") return reply(405, { error: "Method not allowed" });
    if (!connection) return reply(200, { connected: false });

    const status = {
      connected: true,
      email: connection.email,
      connectedAt: connection.connected_at,
    };
    try {
      const key = await accessKey(connection.refresh_token);
      return reply(200, { ...status, latest: await latestEmails(key, 5) });
    } catch (err) {
      console.error("Gmail check failed:", err);
      if (err.needsReconnect) {
        return reply(200, { ...status, needsReconnect: true });
      }
      return reply(200, { ...status, problem: "Connected, but Gmail didn't answer just now." });
    }
  } catch (err) {
    if (err instanceof TableMissingError) return reply(200, { tableMissing: true });
    console.error(err);
    return reply(502, { error: "Couldn't reach the database. Try again in a moment." });
  }
};

export const config = {
  path: "/api/gmail",
};
