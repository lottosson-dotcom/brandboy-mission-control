// =============================================================================
// TALKING TO THE SERVER (everything except the chat, which streams)
// =============================================================================
// Adds the passcode, asks for it if needed, and turns problems into a sentence
// Lars can read. Returns the server's JSON reply, or throws an Error.
// =============================================================================
import { readSavedPasscode, askForPasscode, savePasscode } from "./passcode.js";

export async function callApi(path, { method = "GET", body } = {}) {
  const code = readSavedPasscode() || askForPasscode("Enter the Mission Control passcode");
  if (!code) throw new Error("No passcode entered. Try again.");
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { "x-app-passcode": code, ...(body && { "Content-Type": "application/json" }) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Couldn't reach Mission Control. Check the internet connection and try again.");
  }
  if (res.status === 401) {
    savePasscode("");
    throw new Error("Wrong passcode. Try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status}).`);
  return data;
}
