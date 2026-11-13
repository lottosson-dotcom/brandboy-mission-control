// =============================================================================
// ACTIVITY LOG SCREEN
// =============================================================================
// Shows what the agents have done, newest first: which agent, what Lars asked,
// and the start of the answer. Every finished answer is logged automatically
// by the server (netlify/functions/ask-agent.js).
// =============================================================================
import { useState, useEffect } from "react";
import { AGENTS } from "../agents.js";
import { DAILY_SCANS } from "../scans.js";
import { fetchActivity, runScansNow, timeAgo } from "../lib/activityLog.js";
import ScanReport from "./ScanReport.jsx";

// Matches SCAN_LABEL in netlify/lib/scans.js: marks daily-scan reports.
const SCAN_LABEL = "🕕 Daily scan";

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
  const [scanNote, setScanNote] = useState("");

  async function runScans() {
    setScanNote("⏳ Running the daily scans… this takes about 30 seconds.");
    try {
      const results = await runScansNow();
      const failed = results.filter((r) => !r.ok).length;
      setScanNote(
        failed
          ? `Done, but ${failed} of ${results.length} scans didn't finish. See below.`
          : `✓ Done: ${results.length} scan reports added below.`,
      );
      setFilter("SCANS");
      load();
    } catch (err) {
      setScanNote(`⚠️ ${err.message}`);
    }
  }

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
      (filter === "ALL" ||
        e.agent_name === filter ||
        (filter === "SCANS" && e.client_project === SCAN_LABEL)) &&
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
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={runScans}
            disabled={scanNote.startsWith("⏳")}
            style={pill(true, ACCENT)}
          >
            🕕 Run scans now
          </button>
          <button onClick={load} style={pill(false, ACCENT)}>
            ↻ Refresh
          </button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 12, lineHeight: 1.5 }}>
        Daily scans (every morning around 6am): {DAILY_SCANS.map((s) => s.name).join(" · ")}
        {scanNote && <div style={{ color: "#F0F0F0", marginTop: 4 }}>{scanNote}</div>}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setFilter("ALL")} style={pill(filter === "ALL", ACCENT)}>
          ALL
        </button>
        <button onClick={() => setFilter("SCANS")} style={pill(filter === "SCANS", ACCENT)}>
          🕕 DAILY SCANS
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
              {e.detail && e.client_project === SCAN_LABEL && <ScanReport text={e.detail} />}
              {e.detail && e.client_project !== SCAN_LABEL && (
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
