// =============================================================================
// LOGGING IN (browser side)
// =============================================================================
// Lars logs in with his email: he types it in, gets an email with a link, clicks
// it, and he's in on that device until he logs out. Supabase handles the login.
// The browser only uses Supabase for logging in; all data still goes through
// the server functions, which check the login on every request.
//
// Settings (Netlify → Environment variables; these two are safe to be public):
//   VITE_SUPABASE_URL               https://igwmwhcnsmsxicmepvnj.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY   Supabase → Project Settings → API keys → Publishable key
// Until both are set, the app uses the old shared passcode instead.
// =============================================================================
import { createClient } from "@supabase/supabase-js";
import { readSavedPasscode, askForPasscode, savePasscode } from "./passcode.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const loginEnabled = Boolean(url && key);

export const supabase = loginEnabled
  ? createClient(url, key, {
      // "implicit" so the emailed link works even if it's opened in a
      // different browser or on a different device from where it was asked for.
      auth: { flowType: "implicit", persistSession: true, detectSessionInUrl: true },
    })
  : null;

export async function sendLoginLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
  });
  if (!error) return;
  if (/signups? not allowed|not found|user/i.test(error.message)) {
    throw new Error("That email isn't set up for Mission Control. Ask Eric to add it.");
  }
  throw new Error(error.message);
}

export function logOut() {
  return supabase.auth.signOut();
}

// The extra request headers that prove who's asking. With the login switched
// on, that's the login token; otherwise the old passcode (asked for once).
// askAgain = the last try was refused, so ask for the passcode again.
export async function accessHeaders(askAgain = false) {
  if (loginEnabled) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      await logOut();
      throw new Error("Please log in again.");
    }
    return { Authorization: `Bearer ${token}` };
  }
  const code =
    (!askAgain && readSavedPasscode()) ||
    askForPasscode(
      askAgain
        ? "That passcode didn't work. Paste the Mission Control passcode again:"
        : "Enter the Mission Control passcode",
    );
  if (!code) throw new Error("No passcode entered. Press Send (or try again) to retry.");
  return { "x-app-passcode": code };
}

// Called when the server says "not allowed". Returns true if it's worth trying
// once more (passcode mode: ask again). With the login, it logs out so the
// login screen appears.
export async function accessRefused() {
  if (loginEnabled) {
    await logOut();
    return false;
  }
  savePasscode("");
  return true;
}
