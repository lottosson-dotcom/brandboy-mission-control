// =============================================================================
// SERVER FUNCTION: Google sends Lars back here after "Connect Gmail"
// =============================================================================
//   GET /api/gmail/callback?code=…&state=…
//
// This is the ONE function without checkAccess: it's opened by Google's
// redirect, which can't carry the Mission Control login. Instead it only
// accepts the signed 10-minute ticket ("state") that /api/gmail hands out to
// a logged-in user. Without a valid ticket it does nothing.
// It then sends Lars back to Mission Control with ?gmail=connected (or an
// error), which opens the Inbox tab.
// =============================================================================
import { saveGmailConnection } from "../lib/server.js";
import { gmailIsSetUp, ticketIsValid, swapCode, gmail, SCOPES } from "../lib/gmail.js";

function backToApp(req, result) {
  const base = (process.env.URL || new URL(req.url).origin).replace(/\/$/, "");
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${base}/?gmail=${encodeURIComponent(result)}`,
      "Cache-Control": "no-store",
    },
  });
}

export default async (req) => {
  const params = new URL(req.url).searchParams;
  if (!gmailIsSetUp() || !ticketIsValid(params.get("state"))) return backToApp(req, "expired");
  // Lars pressed "Cancel" on Google's screen.
  if (params.get("error") || !params.get("code")) return backToApp(req, "cancelled");

  try {
    const tokens = await swapCode(req, params.get("code"));
    const granted = (tokens.scope || "").split(" ");
    if (!tokens.refresh_token || !SCOPES.every((s) => granted.includes(s))) {
      // He unticked one of the boxes on Google's screen.
      return backToApp(req, "missing-permission");
    }
    const profile = await gmail(tokens.access_token, "profile");
    await saveGmailConnection({
      email: profile.emailAddress,
      refresh_token: tokens.refresh_token,
      scopes: tokens.scope,
    });
    return backToApp(req, "connected");
  } catch (err) {
    console.error("Gmail connect failed:", err);
    return backToApp(req, "failed");
  }
};

export const config = {
  path: "/api/gmail/callback",
};
