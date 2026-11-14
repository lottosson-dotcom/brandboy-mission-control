// =============================================================================
// TALKING TO THE SERVER (everything except the chat, which streams)
// =============================================================================
// Adds the login (or passcode), and turns problems into a sentence Lars can
// read. Returns the server's JSON reply, or throws an Error.
// =============================================================================
import { accessHeaders, accessRefused } from "./auth.js";

export async function callApi(path, { method = "GET", body } = {}, askAgain = false) {
  const headers = await accessHeaders(askAgain);
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { ...headers, ...(body && { "Content-Type": "application/json" }) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Couldn't reach Mission Control. Check the internet connection and try again.");
  }
  if (res.status === 401 || res.status === 403) {
    if ((await accessRefused()) && !askAgain) return callApi(path, { method, body }, true);
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Not allowed. Please log in again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status}).`);
  return data;
}
