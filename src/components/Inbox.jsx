// =============================================================================
// INBOX SCREEN: Lars's Gmail in Mission Control
// =============================================================================
// Step 1 (this screen): connect Gmail and see the newest emails, to prove it
// works. Next: the inbox agent sorts new emails (lead, enquiry, customer,
// supplier), summarises them and saves reply drafts in Gmail for Lars to send.
// =============================================================================
import { useState, useEffect } from "react";
import { callApi } from "../lib/api.js";
import { MUTED, BORDER, ACCENT, RED, button, bigButton } from "../lib/styles.js";

// What Google's return trip means (?gmail=… in the address).
const RESULTS = {
  connected: "✓ Gmail is connected.",
  cancelled: "⚠️ Connecting was cancelled on Google's screen. Nothing was changed.",
  "missing-permission":
    "⚠️ Google didn't give both permissions. Press Connect Gmail again and leave both boxes ticked.",
  expired: "⚠️ That connect link had expired. Press Connect Gmail again.",
  failed:
    "⚠️ Google didn't finish connecting. Try again in a minute; if it keeps failing, ask Eric.",
};

function sender(from) {
  return from.replace(/<.*>/, "").replace(/"/g, "").trim() || from;
}

export default function Inbox({ result, onResultShown }) {
  const [info, setInfo] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState(RESULTS[result] || "");

  async function load() {
    setState("loading");
    try {
      setInfo(await callApi("/api/gmail"));
      setState("ready");
    } catch (err) {
      setProblem(err.message);
      setState("error");
    }
  }

  useEffect(() => {
    load();
    // Show Google's result once; not again when Lars comes back to this tab.
    if (onResultShown) onResultShown();
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setBusy("Opening Google…");
    try {
      const { url } = await callApi("/api/gmail", { method: "POST" });
      window.location.href = url;
    } catch (err) {
      setNote(`⚠️ ${err.message}`);
      setBusy("");
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Gmail? Mission Control will stop reading the inbox.")) return;
    setBusy("Disconnecting…");
    try {
      await callApi("/api/gmail", { method: "DELETE" });
      setNote("Gmail is disconnected.");
      await load();
    } catch (err) {
      setNote(`⚠️ ${err.message}`);
    }
    setBusy("");
  }

  const card = {
    background: "#1A1A1A",
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    padding: 16,
    fontSize: 13,
    lineHeight: 1.6,
    marginBottom: 16,
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>📥 Inbox</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 16, lineHeight: 1.6 }}>
        Connect your Gmail so an agent can read new emails, tell you which are leads, enquiries,
        customers or suppliers, and prepare reply drafts. Drafts go into your Gmail Drafts folder:
        nothing is ever sent without you.
      </div>
      {note && (
        <div style={{ ...card, borderColor: note.startsWith("⚠️") ? RED : ACCENT }}>{note}</div>
      )}

      {state === "loading" && <div style={{ color: MUTED }}>Loading…</div>}
      {state === "error" && <div style={{ color: RED }}>⚠️ {problem}</div>}
      {state === "ready" && info.notSetUp && (
        <div style={{ color: MUTED }}>
          Gmail isn't set up yet. Eric needs to add the Google settings in Netlify.
        </div>
      )}
      {state === "ready" && info.tableMissing && (
        <div style={{ color: MUTED, lineHeight: 1.6 }}>
          Almost there: Eric needs to run the one-off setup script{" "}
          <code>docs/supabase/gmail_connection.sql</code> in Supabase (SQL Editor). Then refresh.
        </div>
      )}

      {state === "ready" && info.connected === false && (
        <div style={card}>
          <div style={{ marginBottom: 12 }}>
            Gmail isn't connected. Google will ask you to allow Mission Control to{" "}
            <b>read your email</b> and <b>manage drafts</b>. You can disconnect any time.
          </div>
          <button onClick={connect} disabled={!!busy} style={bigButton}>
            {busy || "Connect Gmail"}
          </button>
        </div>
      )}

      {state === "ready" && info.connected && (
        <>
          <div
            style={{ ...card, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
          >
            <span>
              ✉️ Connected to <b>{info.email}</b>
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {info.needsReconnect && (
                <button onClick={connect} disabled={!!busy} style={button(ACCENT, true)}>
                  Reconnect
                </button>
              )}
              <button onClick={disconnect} disabled={!!busy} style={button(MUTED, false)}>
                {busy || "Disconnect"}
              </button>
            </div>
          </div>
          {info.needsReconnect && (
            <div style={{ color: RED, marginBottom: 12 }}>
              ⚠️ Google has cancelled the connection (a password change can do this). Press
              Reconnect.
            </div>
          )}
          {info.problem && <div style={{ color: RED, marginBottom: 12 }}>⚠️ {info.problem}</div>}
          {info.latest && (
            <>
              <div style={{ fontSize: 13, color: MUTED, marginBottom: 8 }}>
                Newest in your inbox:
              </div>
              <div style={{ borderTop: `1px solid ${BORDER}` }}>
                {info.latest.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: "9px 4px",
                      borderBottom: `1px solid ${BORDER}`,
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: "flex", gap: 10 }}>
                      <b style={{ fontWeight: m.unread ? 800 : 500 }}>{sender(m.from)}</b>
                      <span style={{ marginLeft: "auto", color: MUTED, fontSize: 12 }}>
                        {m.date
                          ? new Date(m.date).toLocaleString("en-AU", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : ""}
                      </span>
                    </div>
                    <div style={{ fontWeight: m.unread ? 700 : 400 }}>
                      {m.subject || "(no subject)"}
                    </div>
                    <div
                      style={{
                        color: MUTED,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.snippet}
                    </div>
                  </div>
                ))}
                {info.latest.length === 0 && (
                  <div style={{ color: MUTED, padding: 10 }}>The inbox is empty.</div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
