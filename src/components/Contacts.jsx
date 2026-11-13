// =============================================================================
// CONTACTS SCREEN: Brandboy's customers, suppliers and prospects
// =============================================================================
// Lars imports his list from Excel once, then adds and changes contacts here.
// The inbox agent uses this list to know who an email is from.
// =============================================================================
import { useState, useEffect } from "react";
import { KINDS, fetchContacts } from "../lib/contacts.js";
import { MUTED, BORDER, ACCENT, RED, field, button, bigButton } from "../lib/styles.js";
import ContactCard from "./ContactCard.jsx";
import ContactImport from "./ContactImport.jsx";

const SHOW_AT_ONCE = 200;

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [state, setState] = useState("loading"); // loading | ready | notSetUp | tableMissing | error
  const [problem, setProblem] = useState("");
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);

  async function load() {
    setState("loading");
    try {
      const data = await fetchContacts();
      setContacts(data.contacts || []);
      setState(data.notSetUp ? "notSetUp" : data.tableMissing ? "tableMissing" : "ready");
    } catch (err) {
      setProblem(err.message);
      setState("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const addContact = () => {
    setImporting(false);
    setContacts([
      {
        key: Date.now(),
        kind: kind === "all" ? "customer" : kind,
        company: "",
        name: "",
        email: "",
        phone: "",
        notes: "",
      },
      ...contacts,
    ]);
  };
  // Keep the card's key after saving, so it doesn't jump or lose its place.
  const replace = (saved, old) =>
    setContacts(contacts.map((c) => (c === old ? { ...saved, key: old.key || saved.id } : c)));
  const drop = (old) => setContacts(contacts.filter((c) => c !== old));

  const words = search.toLowerCase().trim();
  const shown = contacts.filter(
    (c) =>
      !c.id || // new, unsaved contacts always show
      ((kind === "all" || c.kind === kind) &&
        (!words ||
          [c.company, c.name, c.email, c.phone, c.notes].some((v) =>
            (v || "").toLowerCase().includes(words),
          ))),
  );
  const count = (k) => contacts.filter((c) => c.id && c.kind === k).length;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}
      >
        <div style={{ fontWeight: 800, fontSize: 18 }}>👥 Contacts</div>
        {state === "ready" && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => setImporting(!importing)} style={button(ACCENT, false)}>
              ⬆ Import from Excel
            </button>
            <button onClick={addContact} style={bigButton}>
              ＋ New contact
            </button>
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 16, lineHeight: 1.6 }}>
        Your customers, suppliers and prospects. The agents use this to know who an email is from.
        Click a contact to change it.
      </div>

      {state === "loading" && <div style={{ color: MUTED }}>Loading…</div>}
      {state === "error" && <div style={{ color: RED }}>⚠️ {problem}</div>}
      {state === "notSetUp" && (
        <div style={{ color: MUTED }}>
          Contacts need the database. Eric needs to add the Supabase settings in Netlify.
        </div>
      )}
      {state === "tableMissing" && (
        <div style={{ color: MUTED, lineHeight: 1.6 }}>
          Almost there: Eric needs to run the one-off setup script{" "}
          <code>docs/supabase/contacts.sql</code> in Supabase (SQL Editor). Then refresh.
        </div>
      )}

      {state === "ready" && importing && (
        <ContactImport
          onDone={() => {
            setImporting(false);
            load();
          }}
          onCancel={() => setImporting(false)}
        />
      )}

      {state === "ready" && (
        <>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {[{ id: "all", plural: "All", color: ACCENT }, ...KINDS].map((k) => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                style={{ ...button(k.color, kind === k.id), borderRadius: 999 }}
              >
                {k.plural} ({k.id === "all" ? contacts.filter((c) => c.id).length : count(k.id)})
              </button>
            ))}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Search name, company, email…"
              style={{ ...field, width: 260, marginLeft: "auto" }}
            />
          </div>
          {contacts.length === 0 && (
            <div style={{ color: MUTED, lineHeight: 1.6 }}>
              No contacts yet. Press <b>⬆ Import from Excel</b> to bring in your customer and
              supplier list, or <b>＋ New contact</b> to add one.
            </div>
          )}
          {contacts.length > 0 && shown.length === 0 && (
            <div style={{ color: MUTED }}>Nobody matches that search.</div>
          )}
          <div style={{ borderTop: shown.length ? `1px solid ${BORDER}` : "none" }}>
            {shown.slice(0, SHOW_AT_ONCE).map((c) => (
              <ContactCard key={c.key || c.id} contact={c} onSaved={replace} onDeleted={drop} />
            ))}
          </div>
          {shown.length > SHOW_AT_ONCE && (
            <div style={{ color: MUTED, fontSize: 13, marginTop: 10 }}>
              Showing the first {SHOW_AT_ONCE} of {shown.length}. Search to find the rest.
            </div>
          )}
        </>
      )}
    </div>
  );
}
