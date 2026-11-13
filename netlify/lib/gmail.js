// =============================================================================
// GMAIL (server side): connecting Lars's mailbox, reading it, saving drafts
// =============================================================================
// How the connection works ("OAuth", Google's standard way):
//   1. Lars presses "Connect Gmail". The server makes a Google link with a
//      signed, 10-minute ticket ("state") so nobody else can finish the step.
//   2. Lars signs in to Google and says yes to: read email, and manage drafts.
//   3. Google sends him back to /api/gmail/callback with a one-time code. The
//      server swaps it for a long-lived pass (refresh token) and saves it.
// Mission Control never sends email. It only reads and saves drafts; Lars
// reviews and sends them himself in Gmail.
//
// Settings (Netlify → Environment variables), from Google Cloud Console:
//   GOOGLE_CLIENT_ID       the OAuth client ID (…apps.googleusercontent.com)
//   GOOGLE_CLIENT_SECRET   the OAuth client secret. Mark it as secret.
// =============================================================================
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Read the inbox + create drafts. "compose" is Google's smallest permission
// that allows drafts; our code never calls Gmail's send.
export const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
];

const TICKET_MINUTES = 10;

export function gmailIsSetUp() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// The address Google sends Lars back to. Always the main site (Netlify sets
// URL), because Google only accepts addresses registered in advance.
export function callbackUrl(req) {
  const base = process.env.URL || new URL(req.url).origin;
  return `${base.replace(/\/$/, "")}/api/gmail/callback`;
}

// ---- The signed ticket --------------------------------------------------------

function sign(text) {
  return createHmac("sha256", process.env.GOOGLE_CLIENT_SECRET).update(text).digest("base64url");
}

export function makeTicket() {
  const body = Buffer.from(
    JSON.stringify({ x: Date.now() + TICKET_MINUTES * 60_000, n: randomBytes(8).toString("hex") }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function ticketIsValid(ticket) {
  const [body, signature] = String(ticket || "").split(".");
  if (!body || !signature) return false;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()).x > Date.now();
  } catch {
    return false;
  }
}

// ---- Talking to Google --------------------------------------------------------

export function googleLoginLink(req) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(req),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // gives the long-lived pass
    prompt: "consent", // makes Google hand it over again on a re-connect
    include_granted_scopes: "true",
    state: makeTicket(),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(fields) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      ...fields,
    }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Google said: ${data.error_description || data.error || res.status}`);
    // invalid_grant = the pass was cancelled or has expired: Lars must reconnect.
    err.needsReconnect = data.error === "invalid_grant";
    throw err;
  }
  return data;
}

// Swaps the one-time code from Google for { refresh_token, access_token, scope }.
export function swapCode(req, code) {
  return tokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: callbackUrl(req),
  });
}

// A short-lived (1 hour) key for reading the mailbox, made from the saved pass.
export async function accessKey(refreshToken) {
  return (await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" }))
    .access_token;
}

// Tells Google to cancel the pass (used by "Disconnect"). Never throws.
export async function cancelPass(refreshToken) {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("Google revoke failed:", err);
  }
}

// One request to the Gmail API, e.g. gmail(key, "profile").
export async function gmail(key, path, { method = "GET", body } = {}) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body && { "Content-Type": "application/json" }),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gmail said: ${data.error?.message || res.status}`);
  return data;
}

// The newest emails in the inbox: [{ id, threadId, from, subject, date, snippet, unread }].
export async function latestEmails(key, howMany = 5) {
  const list = await gmail(
    key,
    `messages?maxResults=${howMany}&q=${encodeURIComponent("in:inbox")}`,
  );
  return Promise.all(
    (list.messages || []).map(async ({ id }) => {
      const m = await gmail(
        key,
        `messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      );
      const header = (name) =>
        m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
      return {
        id,
        threadId: m.threadId,
        from: header("From"),
        subject: header("Subject"),
        date: header("Date"),
        snippet: plainText(m.snippet || ""),
        unread: (m.labelIds || []).includes("UNREAD"),
      };
    }),
  );
}

// Gmail sends previews with HTML codes like &#39; for an apostrophe.
function plainText(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
