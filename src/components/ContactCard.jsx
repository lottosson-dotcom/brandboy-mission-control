// =============================================================================
// CONTACT CARD: one customer, supplier or prospect on the Contacts tab
// =============================================================================
// Shows one line per contact. Click it to change the details; new contacts
// open straight in edit mode.
// =============================================================================
import { useState } from "react";
import { KINDS, saveContact, removeContact } from "../lib/contacts.js";
import { MUTED, BORDER, ACCENT, RED, field, button } from "../lib/styles.js";

const EDITABLE = ["kind", "company", "name", "email", "phone", "notes"];

export function KindBadge({ kind }) {
  const k = KINDS.find((x) => x.id === kind) || KINDS[0];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: k.color,
        border: `1px solid ${k.color}`,
        borderRadius: 999,
        padding: "1px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {k.label}
    </span>
  );
}

export default function ContactCard({ contact, onSaved, onDeleted }) {
  const isNew = !contact.id;
  const [open, setOpen] = useState(isNew);
  const [draft, setDraft] = useState(contact);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const changed = isNew || EDITABLE.some((k) => (draft[k] || "") !== (contact[k] || ""));
  const set = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });

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
      const saved = await saveContact(draft);
      setDraft(saved);
      setOpen(false);
      onSaved(saved, contact);
    });

  const remove = () => {
    const label = contact.company || contact.name;
    if (!isNew && !window.confirm(`Delete ${label} from your contacts?`)) return;
    act("Deleting…", async () => {
      if (!isNew) await removeContact(contact.id);
      onDeleted(contact);
    });
  };

  const cancel = () => {
    if (isNew) return onDeleted(contact);
    setDraft(contact);
    setNote("");
    setOpen(false);
  };

  if (!open) {
    return (
      <div
        onClick={() => setOpen(true)}
        title="Click to change"
        style={{
          display: "grid",
          gridTemplateColumns:
            "90px minmax(120px,1.4fr) minmax(100px,1fr) minmax(140px,1.4fr) 120px",
          gap: 10,
          alignItems: "center",
          padding: "9px 12px",
          borderBottom: `1px solid ${BORDER}`,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <KindBadge kind={contact.kind} />
        <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {contact.company || "—"}
        </b>
        <span style={{ color: MUTED, overflow: "hidden", textOverflow: "ellipsis" }}>
          {contact.name}
        </span>
        <span style={{ color: MUTED, overflow: "hidden", textOverflow: "ellipsis" }}>
          {contact.email}
        </span>
        <span style={{ color: MUTED, whiteSpace: "nowrap" }}>{contact.phone}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#1A1A1A",
        border: `1px solid ${ACCENT}`,
        borderRadius: 10,
        padding: 14,
        margin: "8px 0",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 10,
        }}
      >
        <select value={draft.kind} onChange={set("kind")} style={field}>
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          value={draft.company}
          onChange={set("company")}
          placeholder="Company"
          style={field}
          autoFocus={isNew}
        />
        <input
          value={draft.name}
          onChange={set("name")}
          placeholder="Contact person"
          style={field}
        />
        <input
          value={draft.email}
          onChange={set("email")}
          placeholder="Email"
          type="email"
          style={field}
        />
        <input value={draft.phone} onChange={set("phone")} placeholder="Phone" style={field} />
      </div>
      <textarea
        value={draft.notes}
        onChange={set("notes")}
        rows={2}
        placeholder="Notes, e.g. who they are, what work we do for them"
        style={{ ...field, marginTop: 10, resize: "vertical", lineHeight: 1.5 }}
      />
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}
      >
        <span style={{ fontSize: 12, color: note.startsWith("⚠️") ? RED : MUTED }}>
          {busy || note}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {!isNew && (
            <button onClick={remove} disabled={!!busy} style={button(RED, false)}>
              Delete
            </button>
          )}
          <button onClick={cancel} disabled={!!busy} style={button(MUTED, false)}>
            Cancel
          </button>
          {changed && (
            <button onClick={save} disabled={!!busy} style={button(ACCENT, true)}>
              {isNew ? "Add contact" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
