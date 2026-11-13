// =============================================================================
// ACTIVITY LOG (browser side)
// =============================================================================
// The browser never talks to the database directly. It asks the server
// function /api/activity (passcode-protected), which reads the log.
// =============================================================================
import { readSavedPasscode, askForPasscode, savePasscode } from "./passcode.js";

// Returns { entries, notSetUp } or throws an Error with a readable message.
export async function fetchActivity() {
  const code = readSavedPasscode() || askForPasscode("Enter the Mission Control passcode");
  if (!code) throw new Error("No passcode entered. Press Refresh to try again.");
  const res = await fetch("/api/activity", { headers: { "x-app-passcode": code } });
  if (res.status === 401) {
    savePasscode("");
    throw new Error("Wrong passcode. Press Refresh to try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Couldn't load the log (${res.status}).`);
  return data;
}

// Runs the daily scans straight away. Returns [{ name, ok }] or throws.
export async function runScansNow() {
  const code = readSavedPasscode() || askForPasscode("Enter the Mission Control passcode");
  if (!code) throw new Error("No passcode entered.");
  const res = await fetch("/api/run-scans", {
    method: "POST",
    headers: { "x-app-passcode": code },
  });
  if (res.status === 401) {
    savePasscode("");
    throw new Error("Wrong passcode. Try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `The scans couldn't run (${res.status}).`);
  return data.results || [];
}

export function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}
