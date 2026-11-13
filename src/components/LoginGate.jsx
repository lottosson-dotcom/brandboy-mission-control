// =============================================================================
// LOGIN GATE: shows the login screen until Lars is logged in
// =============================================================================
// With the login switched on (see src/lib/auth.js), nothing of Mission Control
// is shown until someone has logged in with an allowed email. Without it, the
// app opens straight away and uses the old passcode.
// =============================================================================
import { useState, useEffect } from "react";
import { loginEnabled, supabase } from "../lib/auth.js";
import LoginScreen from "./LoginScreen.jsx";

export default function LoginGate({ children }) {
  return loginEnabled ? <SessionGate>{children}</SessionGate> : children;
}

function SessionGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    // Fires when the emailed link logs him in, and when he logs out.
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div style={{ minHeight: "100vh", background: "#0A0A0A" }} />;
  }
  return session ? children : <LoginScreen />;
}
