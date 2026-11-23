// =============================================================================
// BULK ACTIONS on the Contacts tab
// =============================================================================
// Appears when Lars ticks one or more contacts. He can change them all to
// customer / supplier / prospect in one go, or delete them all (after a
// clear "are you sure").
// =============================================================================
import { useState } from "react";
import { KINDS, changeKindOf, removeMany } from "../lib/contacts.js";
import { MUTED, ACCENT, RED, button } from "../lib/styles.js";

export default function ContactBulkBar({ ids, onDone, onClear }) {
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const n = ids.length;
  const plural = n === 1 ? "contact" : "contacts";

  async function act(label, work) {
    setBusy(label);
    setNote("");
    try {
      await work();
      onDone();
    } catch (err) {
      setNote(`⚠️ ${err.message}`);
    }
    setBusy("");
  }

  const changeTo = (kind) => act(`Changing ${n} ${plural}…`, () => changeKindOf(ids, kind.id));

  const remove = () => {
    if (!window.confirm(`Delete ${n} ${plural}? This can't be undone.`)) return;
    act(`Deleting ${n} ${plural}…`, () => removeMany(ids));
  };

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1,
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        padding: "10px 12px",
        marginBottom: 10,
        background: "#1A1A1A",
        border: `1px solid ${ACCENT}`,
        borderRadius: 10,
        fontSize: 13,
      }}
    >
      <b style={{ color: ACCENT }}>
        {n} {plural} ticked
      </b>
      <span style={{ color: MUTED, marginLeft: 8 }}>Change to:</span>
      {KINDS.map((k) => (
        <button
          key={k.id}
          onClick={() => changeTo(k)}
          disabled={!!busy}
          style={{ ...button(k.color, false), borderRadius: 999 }}
        >
          {k.label}
        </button>
      ))}
      <button onClick={remove} disabled={!!busy} style={button(RED, false)}>
        🗑 Delete
      </button>
      <span style={{ color: note ? RED : MUTED }}>{busy || note}</span>
      <button
        onClick={onClear}
        disabled={!!busy}
        style={{ ...button(MUTED, false), marginLeft: "auto" }}
      >
        Untick all
      </button>
    </div>
  );
}
