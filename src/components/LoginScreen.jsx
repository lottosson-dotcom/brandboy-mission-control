// =============================================================================
// LOGIN SCREEN
// =============================================================================
// Lars types his email and gets a login link. No password to remember.
// Only emails Eric has added can log in.
// =============================================================================
import { useState } from "react";
import { sendLoginLink } from "../lib/auth.js";

const MUTED = "#A3A3A3";
const ACCENT_GRADIENT = "linear-gradient(135deg,#FF6B2B,#FF9A5C)";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("ready"); // ready | sending | sent
  const [problem, setProblem] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!email.includes("@")) return setProblem("Type your email address.");
    setState("sending");
    setProblem("");
    try {
      await sendLoginLink(email);
      setState("sent");
    } catch (err) {
      setProblem(err.message);
      setState("ready");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0A0A",
        color: "#F0F0F0",
        fontFamily: "'Inter',system-ui,sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#141414",
          border: "1px solid #2A2A2A",
          borderRadius: 14,
          padding: 28,
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: ACCENT_GRADIENT,
            borderRadius: 8,
            padding: "4px 12px",
            fontWeight: 900,
            fontSize: 15,
            letterSpacing: 1,
          }}
        >
          BB
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, margin: "16px 0 4px" }}>
          BRANDBOY MISSION CONTROL
        </div>

        {state === "sent" ? (
          <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, marginTop: 12 }}>
            📬 <b style={{ color: "#F0F0F0" }}>Check your email.</b> We've sent a login link to{" "}
            <b style={{ color: "#F0F0F0" }}>{email}</b>. Click it and Mission Control opens, logged
            in. It works on any device, and you stay logged in until you log out.
            <div style={{ marginTop: 14 }}>
              <button
                onClick={() => setState("ready")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#FF9A5C",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 13,
                }}
              >
                Didn't get it? Send it again
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>
              Log in with your email. We'll send you a link: no password needed.
            </div>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@brandboy.com.au"
              style={{
                width: "100%",
                background: "#0A0A0A",
                border: "1px solid #2A2A2A",
                borderRadius: 10,
                color: "#F0F0F0",
                fontSize: 15,
                padding: "12px 14px",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            {problem && (
              <div style={{ color: "#EF4444", fontSize: 13, marginTop: 10 }}>⚠️ {problem}</div>
            )}
            <button
              type="submit"
              disabled={state === "sending"}
              style={{
                width: "100%",
                marginTop: 14,
                background: ACCENT_GRADIENT,
                border: "none",
                borderRadius: 10,
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                padding: "12px",
                cursor: state === "sending" ? "wait" : "pointer",
              }}
            >
              {state === "sending" ? "Sending…" : "Email me a login link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
