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

// Returns an error Response if the passcode is missing or wrong, otherwise null.
export function checkPasscode(req) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return reply(500, { error: "Server is missing APP_PASSCODE" });
  // Trim both sides so a stray space from copy-paste doesn't lock Lars out.
  if ((req.headers.get("x-app-passcode") || "").trim() !== passcode.trim()) {
    return reply(401, { error: "Wrong or missing passcode" });
  }
  return null;
}

function database() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
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

// Thrown when the daily_tasks table hasn't been created yet.
export class TableMissingError extends Error {}

// One request to the database. Returns the JSON reply (or null when empty).
async function dbRequest(path, { method = "GET", body } = {}) {
  const db = database();
  if (!db) throw new Error("Database not set up");
  const res = await fetch(`${db.url}/${path}`, {
    method,
    headers: { ...db.headers, Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 404 || text.includes("PGRST205") || text.includes("does not exist")) {
      throw new TableMissingError("The daily_tasks table hasn't been set up yet.");
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

export async function readActivity(limit = 100) {
  const db = database();
  const res = await fetch(
    `${db.url}/activity_log?select=*&order=created_at.desc&limit=${Number(limit) || 100}`,
    { headers: db.headers, signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error(`Activity log read failed: ${res.status} ${await res.text()}`);
  return res.json();
}
