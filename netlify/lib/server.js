// =============================================================================
// SHARED SERVER HELPERS (used by the functions in netlify/functions/)
// =============================================================================
// The browser NEVER talks to the database. Only these server functions do,
// after checking the passcode, using a server-only Supabase key. The tables
// stay locked (Row Level Security on, no policies), so the public can't read
// or change anything.
//
// Settings (Netlify → Site configuration → Environment variables):
//   SUPABASE_URL                e.g. https://igwmwhcnsmsxicmepvnj.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   Supabase → Project Settings → API keys →
//                               the Secret key (sb_secret_…). Mark it as secret in
//                               Netlify. NEVER give it a VITE_ name: that would
//                               put it in the website for anyone to see.
// If these aren't set, logging is simply skipped and the app works as before.
// =============================================================================

export function reply(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---- Who's allowed in ---------------------------------------------------------
// Every server function starts with: const denied = await checkAccess(req).
// It returns an error Response, or null when the request may go ahead.
//
//   1. LOGIN (the normal way): the website sends the signed-in user's login
//      token. We ask Supabase who it belongs to, and the email must be on
//      ALLOWED_EMAILS (Netlify setting, e.g. "lars@brandboy.com.au,eric@zignet.com.au").
//   2. PASSCODE (the old way): only accepted while APP_PASSCODE is still set in
//      Netlify. Delete APP_PASSCODE once the login works, to switch it off.
export async function checkAccess(req) {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const user = await userFromToken(auth.slice(7));
    if (!user) return reply(401, { error: "Please log in again.", needsLogin: true });
    if (!emailAllowed(user.email)) {
      return reply(403, {
        error: `${user.email} isn't allowed into Mission Control.`,
        needsLogin: true,
      });
    }
    return null;
  }
  const passcode = process.env.APP_PASSCODE;
  // Trim both sides so a stray space from copy-paste doesn't lock Lars out.
  if (passcode && (req.headers.get("x-app-passcode") || "").trim() === passcode.trim()) {
    return null;
  }
  return passcode
    ? reply(401, { error: "Wrong or missing passcode" })
    : reply(401, { error: "Please log in.", needsLogin: true });
}

function emailAllowed(email) {
  const allowed = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // Safety: with no list set, nobody gets in through the login.
  return allowed.length > 0 && allowed.includes(String(email || "").toLowerCase());
}

// Asks Supabase which user a login token belongs to. Returns the user or null.
async function userFromToken(token) {
  const url = supabaseUrl();
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !token) return null;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? await res.json() : null;
  } catch (err) {
    console.error("Login check failed:", err);
    return null;
  }
}

function supabaseUrl() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  return url ? url.replace(/\/$/, "") : null;
}

function database() {
  const url = supabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    url: `${url.replace(/\/$/, "")}/rest/v1`,
    headers: {
      apikey: key,
      // New-style keys (sb_secret_…) go in "apikey" only. Old-style keys
      // (long tokens starting "eyJ") also need the Authorization header.
      ...(key.startsWith("eyJ") && { Authorization: `Bearer ${key}` }),
      "Content-Type": "application/json",
    },
  };
}

export function databaseIsSetUp() {
  return database() !== null;
}

// Adds one line to the activity log. Never throws: a logging problem must not
// break Lars's chat.
export async function logActivity({ agent_name, action, detail, client_project, color }) {
  const db = database();
  if (!db) return;
  try {
    const res = await fetch(`${db.url}/activity_log`, {
      method: "POST",
      headers: { ...db.headers, Prefer: "return=minimal" },
      body: JSON.stringify({ agent_name, action, detail, client_project, color }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.error("Activity log write failed:", res.status, await res.text());
  } catch (err) {
    console.error("Activity log write failed:", err);
  }
}

// The most recent log entry with exactly this action, or null. Used by the
// daily scans to compare today's report with yesterday's.
export async function readLatestEntry(action) {
  const db = database();
  if (!db) return null;
  try {
    const res = await fetch(
      `${db.url}/activity_log?select=detail,created_at&action=eq.${encodeURIComponent(action)}&order=created_at.desc&limit=1`,
      { headers: db.headers, signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    return (await res.json())[0] || null;
  } catch {
    return null;
  }
}

// ---- Daily tasks (table created by docs/supabase/daily_tasks.sql) -------------

// Thrown when a table (daily_tasks, contacts) hasn't been created yet.
export class TableMissingError extends Error {}

// One request to the database. Returns the JSON reply (or null when empty).
async function dbRequest(path, { method = "GET", body, prefer } = {}) {
  const db = database();
  if (!db) throw new Error("Database not set up");
  const res = await fetch(`${db.url}/${path}`, {
    method,
    headers: {
      ...db.headers,
      Prefer: ["return=representation", prefer].filter(Boolean).join(","),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 404 || text.includes("PGRST205") || text.includes("does not exist")) {
      throw new TableMissingError(`The ${path.split("?")[0]} table hasn't been set up yet.`);
    }
    throw new Error(`Database ${method} ${path} failed: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const TASK_FIELDS = "id,agent_id,name,prompt,enabled,created_at,updated_at";

export function listTasks({ enabledOnly = false } = {}) {
  return dbRequest(
    `daily_tasks?select=${TASK_FIELDS}&order=created_at.asc${enabledOnly ? "&enabled=eq.true" : ""}`,
  );
}

export async function createTask(task) {
  return (await dbRequest("daily_tasks", { method: "POST", body: task }))[0];
}

export async function updateTask(id, changes) {
  const rows = await dbRequest(`daily_tasks?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { ...changes, updated_at: new Date().toISOString() },
  });
  return rows[0] || null;
}

export async function deleteTask(id) {
  const rows = await dbRequest(`daily_tasks?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return rows.length > 0;
}

// ---- Contacts (table created by docs/supabase/contacts.sql) -------------------

const CONTACT_FIELDS = "id,kind,company,name,email,phone,notes,source,created_at,updated_at";

export function listContacts() {
  return dbRequest(`contacts?select=${CONTACT_FIELDS}&order=company.asc,name.asc&limit=10000`);
}

// Adds one or many contacts in one go. Returns the saved rows.
export function createContacts(rows) {
  return dbRequest("contacts", { method: "POST", body: rows });
}

export async function updateContact(id, changes) {
  const rows = await dbRequest(`contacts?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { ...changes, updated_at: new Date().toISOString() },
  });
  return rows[0] || null;
}

export async function deleteContact(id) {
  const rows = await dbRequest(`contacts?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  return rows.length > 0;
}

// ---- Gmail connection (table created by docs/supabase/gmail_connection.sql) ---

export async function readGmailConnection() {
  return (await dbRequest("gmail_connection?select=*&id=eq.1"))[0] || null;
}

// Replaces the saved connection (there's only ever one).
export async function saveGmailConnection({ email, refresh_token, scopes }) {
  await dbRequest("gmail_connection?id=eq.1", { method: "DELETE" });
  await dbRequest("gmail_connection", {
    method: "POST",
    body: { id: 1, email, refresh_token, scopes, connected_at: new Date().toISOString() },
  });
}

export function deleteGmailConnection() {
  return dbRequest("gmail_connection?id=eq.1", { method: "DELETE" });
}

// ---- Inbox items (table created by docs/supabase/inbox_items.sql) -------------

const INBOX_FIELDS =
  "id,message_id,thread_id,from_name,from_email,subject,received_at,category,summary,needs_reply,draft_id,contact_id,contact_kind,contact_name,status";

export function listInboxItems(limit = 60) {
  return dbRequest(
    `inbox_items?select=${INBOX_FIELDS}&order=received_at.desc.nullslast&limit=${Number(limit) || 60}`,
  );
}

// Which of these Gmail ids have already been sorted. Returns a Set.
export async function sortedMessageIds(messageIds) {
  if (!messageIds.length) return new Set();
  const list = messageIds.map((id) => `"${String(id).replace(/[^\w-]/g, "")}"`).join(",");
  const rows = await dbRequest(`inbox_items?select=message_id&message_id=in.(${list})`);
  return new Set(rows.map((r) => r.message_id));
}

export function addInboxItems(rows) {
  // If two checks run at once, an email already saved is skipped, not an error.
  return rows.length
    ? dbRequest("inbox_items?on_conflict=message_id", {
        method: "POST",
        body: rows,
        prefer: "resolution=ignore-duplicates",
      })
    : [];
}

export async function readInboxItem(id) {
  return (
    (await dbRequest(`inbox_items?select=${INBOX_FIELDS}&id=eq.${encodeURIComponent(id)}`))[0] ||
    null
  );
}

export async function updateInboxItem(id, changes) {
  const rows = await dbRequest(`inbox_items?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: changes,
  });
  return rows[0] || null;
}

export async function readActivity(limit = 100) {
  const db = database();
  const res = await fetch(
    `${db.url}/activity_log?select=*&order=created_at.desc&limit=${Number(limit) || 100}`,
    { headers: db.headers, signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error(`Activity log read failed: ${res.status} ${await res.text()}`);
  return res.json();
}
