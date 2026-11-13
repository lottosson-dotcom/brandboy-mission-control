// =============================================================================
// DAILY TASKS SCREEN
// =============================================================================
// The things each agent does by itself every morning (around 6am Sydney time),
// e.g. HUNTER searching for new tenders. Lars adds, changes, pauses or deletes
// them here; no code needed. Reports appear in the Activity Log.
// =============================================================================
import { useState, useEffect } from "react";
import { fetchTasks } from "../lib/activityLog.js";
import TaskCard from "./TaskCard.jsx";

const MUTED = "#A3A3A3";

export default function DailyTasks() {
  const [tasks, setTasks] = useState([]);
  const [state, setState] = useState("loading"); // loading | ready | notSetUp | tableMissing | error
  const [problem, setProblem] = useState("");

  async function load() {
    setState("loading");
    try {
      const data = await fetchTasks();
      setTasks(data.tasks || []);
      setState(data.notSetUp ? "notSetUp" : data.tableMissing ? "tableMissing" : "ready");
    } catch (err) {
      setProblem(err.message);
      setState("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const addTask = () =>
    setTasks([
      { key: Date.now(), agent_id: "hunter", name: "", prompt: "", enabled: true },
      ...tasks,
    ]);
  // Keep the card's key after saving, so it stays on screen with its "✓ Saved".
  const replace = (saved, old) =>
    setTasks(tasks.map((t) => (t === old ? { ...saved, key: old.key || saved.id } : t)));
  const drop = (old) => setTasks(tasks.filter((t) => t !== old));
  const switchedOn = tasks.filter((t) => t.id && t.enabled).length;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>🕕 Daily Tasks</div>
        {state === "ready" && (
          <button
            onClick={addTask}
            style={{
              marginLeft: "auto",
              background: "linear-gradient(135deg,#FF6B2B,#FF9A5C)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            ＋ New task
          </button>
        )}
      </div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 16, lineHeight: 1.6 }}>
        What the agents do by themselves every morning (around 6am). The report from each task goes
        to the 📡 Activity Log. For SCOUT, HUNTER and RANKR, write what they should search for.{" "}
        {state === "ready" && `${switchedOn} of up to 8 switched on.`}
      </div>

      {state === "loading" && <div style={{ color: MUTED }}>Loading…</div>}
      {state === "error" && <div style={{ color: "#EF4444" }}>⚠️ {problem}</div>}
      {state === "notSetUp" && (
        <div style={{ color: MUTED }}>
          Daily tasks need the database. Eric needs to add the Supabase settings in Netlify.
        </div>
      )}
      {state === "tableMissing" && (
        <div style={{ color: MUTED, lineHeight: 1.6 }}>
          Almost there: Eric needs to run the one-off setup script{" "}
          <code>docs/supabase/daily_tasks.sql</code> in Supabase (SQL Editor). Then refresh.
        </div>
      )}
      {state === "ready" && tasks.length === 0 && (
        <div style={{ color: MUTED }}>No daily tasks yet. Press ＋ New task to add one.</div>
      )}
      {state === "ready" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tasks.map((t) => (
            <TaskCard key={t.key || t.id} task={t} onSaved={replace} onDeleted={drop} />
          ))}
        </div>
      )}
    </div>
  );
}
