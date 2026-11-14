// =============================================================================
// TASK CARD: one daily task on the Daily Tasks tab
// =============================================================================
// Lars picks the agent, gives the task a name, writes what it should do (for
// searching agents, that's where the search terms go), and switches it on/off.
// =============================================================================
import { useState } from "react";
import { AGENTS } from "../agents.js";
import { saveTask, removeTask, runTasksNow } from "../lib/activityLog.js";
import { MUTED, BORDER, field, button } from "../lib/styles.js";

export default function TaskCard({ task, onSaved, onDeleted }) {
  const [draft, setDraft] = useState(task);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const isNew = !task.id;
  const changed =
    isNew || ["agent_id", "name", "prompt", "enabled"].some((k) => draft[k] !== task[k]);
  const agent = AGENTS.find((a) => a.id === draft.agent_id) || AGENTS[0];

  async function act(label, work) {
    setBusy(label);
    setNote("");
    try {
      await work();
    } catch (err) {
      setNote(`⚠️ ${err.message}`);
    }
    setBusy("");
  }

  const save = () =>
    act("Saving…", async () => {
      onSaved(await saveTask(draft), task);
      setNote("✓ Saved");
    });

  const remove = () => {
    if (!isNew && !window.confirm(`Delete the task "${task.name}"?`)) return;
    act("Deleting…", async () => {
      if (!isNew) await removeTask(task.id);
      onDeleted(task);
    });
  };

  const runNow = () =>
    act("Running… about 30 seconds", async () => {
      const [result] = await runTasksNow(task.id);
      setNote(
        result?.ok
          ? "✓ Done: the report is in the Activity Log."
          : "⚠️ It didn't finish. The Activity Log has the details.",
      );
    });

  return (
    <div
      style={{
        background: "#1A1A1A",
        border: `1px solid ${BORDER}`,
        borderLeft: `3px solid ${agent.color}`,
        borderRadius: 10,
        padding: 14,
        opacity: draft.enabled ? 1 : 0.7,
      }}
    >
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <select
          value={draft.agent_id}
          onChange={(e) => setDraft({ ...draft, agent_id: e.target.value })}
          style={{ ...field, width: "auto", color: agent.color, fontWeight: 700 }}
        >
          {AGENTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.emoji} {a.name}
              {a.webSearch ? " (searches the web)" : ""}
            </option>
          ))}
        </select>
        <input
          value={draft.name}
          placeholder="Short name, e.g. VIC fit-out tenders"
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          style={{ ...field, flex: 1, minWidth: 200, fontWeight: 700 }}
        />
      </div>
      <textarea
        value={draft.prompt}
        rows={3}
        placeholder={
          agent.webSearch
            ? "What to look for, in plain words. e.g. Find open Victorian government tenders for office fit-outs. Give the buyer, closing date, value and link."
            : "What to do, in plain words. e.g. Write a short list of follow-ups I should do this week."
        }
        onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
        style={{ ...field, resize: "vertical", lineHeight: 1.5 }}
      />
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}
      >
        <label
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: MUTED }}
        >
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
          />
          Runs every morning
        </label>
        <span style={{ fontSize: 12, color: note.startsWith("⚠️") ? "#EF4444" : MUTED }}>
          {busy || note}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {!isNew && !changed && (
            <button onClick={runNow} disabled={!!busy} style={button("#FF6B2B", false)}>
              ▶ Run now
            </button>
          )}
          <button onClick={remove} disabled={!!busy} style={button(MUTED, false)}>
            {isNew ? "Cancel" : "Delete"}
          </button>
          {changed && (
            <button onClick={save} disabled={!!busy} style={button("#FF6B2B", true)}>
              {isNew ? "Add task" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
