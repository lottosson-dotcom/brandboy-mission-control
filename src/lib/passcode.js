// =============================================================================
// THE PASSCODE (browser side)
// =============================================================================
// The passcode is asked for once and remembered in this browser.
// Cancel = nothing is saved and nothing is sent. A wrong passcode is forgotten
// straight away so the next request asks again.
// =============================================================================
const PASSCODE_KEY = "mc-passcode";

export function readSavedPasscode() {
  try {
    return localStorage.getItem(PASSCODE_KEY) || "";
  } catch {
    return "";
  }
}

export function savePasscode(code) {
  try {
    if (code) localStorage.setItem(PASSCODE_KEY, code);
    else localStorage.removeItem(PASSCODE_KEY);
  } catch {}
}

export function askForPasscode(message) {
  const typed = (window.prompt(message) || "").trim();
  savePasscode(typed);
  return typed;
}
