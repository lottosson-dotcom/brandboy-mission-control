// =============================================================================
// ACTIVITY LOG SCREEN
// =============================================================================
// Shows what the agents have done, newest first: which agent, what Lars asked,
// and the start of the answer. Every finished answer is logged automatically
// by the server (netlify/functions/ask-agent.js).
// =============================================================================
import { useState, useEffect } from "react";
import { AGENTS } from "../agents.js";
import { fetchActivity, timeAgo } from "../lib/activityLog.js";

const MUTED = "#A3A3A3";
const PANEL = "#1A1A1A";
const BORDER = "#2A2A2A";
const ACCENT = "#FF6B2B";

export default function ActivityLog() {
  const [entries, setEntries] = useState([]);
  const [state, setState] = useState("loading"); // loading | ready | notSetUp | error
  const [problem, setProblem] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  async function load() {
    setState("loading");
    try {
      const data = await fetchActivity();
      setEntries(data.entries || []);
      setState(data.notSetUp ? "notSetUp" : "ready");
    } catch (err) {
      setProblem(err.message);
      setState("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const term = search.toLowerCase();
  const shown = entries.filter(
    (e) =>
      (filter === "ALL" || e.agent_name === filter) &&
      [e.action, e.detail, e.client_project].some((t) => t?.toLowerCase().includes(term)),
  );

  const pill = (active, color) => ({
    background: active ? color + "22" : "#141414",
    border: `1px solid ${active ? color : BORDER}`,
    color: active ? color : MUTED,
    borderRadius: 6,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>📡 Activity Log</div>
          <div style={{ fontSize: 13, color: MUTED }}>
            Everything the agents have done, newest first.
          </div>
        </div>
        <button onClick={load} style={{ ...pill(false, ACCENT), marginLeft: "auto" }}>
          ↻ Refresh
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setFilter("ALL")} style={pill(filter === "ALL", ACCENT)}>
          ALL
        </button>
        {AGENTS.map((a) => (
          <button
            key={a.id}
            onClick={() => setFilter(a.name)}
            style={pill(filter === a.name, a.color)}
          >
            {a.emoji} {a.name}
          </button>
        ))}
      </div>
      <input
        placeholder="Search the log…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          background: "#141414",
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          color: "#F0F0F0",
          padding: "9px 12px",
          fontSize: 14,
          marginBottom: 16,
          fontFamily: "inherit",
        }}
      />

      {state === "loading" && <div style={{ color: MUTED }}>Loading…</div>}
      {state === "error" && <div style={{ color: "#EF4444" }}>⚠️ {problem}</div>}
      {state === "notSetUp" && (
        <div style={{ color: MUTED, lineHeight: 1.6 }}>
          The Activity Log isn't connected to the database yet. Eric needs to add the Supabase
          settings in Netlify (see README). The chat works fine without it.
        </div>
      )}
      {state === "ready" && shown.length === 0 && (
        <div style={{ color: MUTED }}>
          {entries.length === 0
            ? "Nothing yet. Ask any agent something and it will show up here."
            : "Nothing matches that filter."}
        </div>
      )}
      {state === "ready" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shown.map((e) => (
            <div
              key={e.id}
              style={{
                background: PANEL,
                border: `1px solid ${BORDER}`,
                borderLeft: `3px solid ${e.color || MUTED}`,
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span style={{ color: e.color || MUTED, fontWeight: 800, fontSize: 12 }}>
                  {e.agent_name}
                </span>
                <span style={{ fontSize: 14, color: "#F0F0F0" }}>{e.action}</span>
                <span
                  style={{ marginLeft: "auto", fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}
                >
                  {timeAgo(e.created_at)}
                </span>
              </div>
              {e.client_project && (
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{e.client_project}</div>
              )}
              {e.detail && (
                <div style={{ fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
                  {e.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
