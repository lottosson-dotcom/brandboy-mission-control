// =============================================================================
// SORTED EMAILS (on the Inbox tab)
// =============================================================================
// "Check inbox now" asks COMPOSER to sort new emails and save reply drafts in
// Gmail. Each email shows what kind it is, a one-line summary, whether the
// sender is a known customer/supplier, and a link to the draft in Gmail.
// Unknown senders get "Add as prospect". Nothing is ever sent from here.
// =============================================================================
import { useState, useEffect } from "react";
import { callApi } from "../lib/api.js";
import { KINDS } from "../lib/contacts.js";
import { MUTED, BORDER, ACCENT, RED, button, bigButton } from "../lib/styles.js";

const CATEGORY = {
  lead: { label: "🔥 New lead", color: "#FF6B2B" },
  enquiry: { label: "❓ Enquiry", color: "#F5A623" },
  customer: { label: "Customer", color: "#22C55E" },
  supplier: { label: "Supplier", color: "#3B82F6" },
  other: { label: "Other", color: MUTED },
};

const pill = (color) => ({
  fontSize: 11,
  fontWeight: 700,
  color,
  border: `1px solid ${color}`,
  borderRadius: 999,
  padding: "1px 8px",
  whiteSpace: "nowrap",
});

export default function InboxItems({ account }) {
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading"); // loading | ready | tableMissing | error
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [showAll, setShowAll] = useState(false);

  async function load() {
    try {
      const data = await callApi("/api/inbox");
      setItems(data.items || []);
      setState(data.tableMissing ? "tableMissing" : "ready");
    } catch (err) {
      setNote(`⚠️ ${err.message}`);
      setState("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function check() {
    setBusy("COMPOSER is reading your new emails… (up to a minute)");
    setNote("");
    try {
      const r = await callApi("/api/inbox?check=1", { method: "POST" });
      if (r.tableMissing) {
        setState("tableMissing");
      } else if (!r.sorted) {
        setNote("✓ No new emails since the last check.");
      } else {
        setNote(
          `✓ Sorted ${r.sorted} new emails${r.drafts ? `, and saved ${r.drafts} reply drafts in Gmail` : ""}.` +
            (r.more ? ` ${r.more} more waiting: press Check inbox now again.` : ""),
        );
      }
      await load();
    } catch (err) {
      setNote(`⚠️ ${err.message}`);
    }
    setBusy("");
  }

  async function act(item, path, options) {
    try {
      const r = await callApi(path, options);
      if (r.tableMissing)
        throw new Error("Contacts isn't set up yet: Eric needs to run contacts.sql.");
      if (r.item) setItems((list) => list.map((i) => (i.id === item.id ? r.item : i)));
    } catch (err) {
      setNote(`⚠️ ${err.message}`);
    }
  }

  const gmailLink = (item) =>
    `https://mail.google.com/mail/?authuser=${encodeURIComponent(account)}#all/${item.thread_id}`;
  const toDo = items.filter((i) => i.status === "new" && i.category !== "other");
  const shown = showAll ? items : toDo;

  if (state === "tableMissing") {
    return (
      <div style={{ color: MUTED, lineHeight: 1.6 }}>
        Almost there: Eric needs to run the one-off setup script{" "}
        <code>docs/supabase/inbox_items.sql</code> in Supabase (SQL Editor). Then refresh.
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <button onClick={check} disabled={!!busy} style={bigButton}>
          {busy ? "Checking…" : "✉️ Check inbox now"}
        </button>
        <label
          style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: MUTED }}
        >
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show done and "other" emails too
        </label>
      </div>
      {(busy || note) && (
        <div style={{ fontSize: 13, marginBottom: 12, color: note.startsWith("⚠️") ? RED : MUTED }}>
          {busy || note}
        </div>
      )}
      {state === "loading" && <div style={{ color: MUTED }}>Loading…</div>}
      {state === "ready" && shown.length === 0 && (
        <div style={{ color: MUTED, fontSize: 13 }}>
          {items.length === 0
            ? "Nothing sorted yet. Press Check inbox now: COMPOSER reads emails from the last 3 days."
            : "All done: nothing waiting for you."}
        </div>
      )}

      <div style={{ borderTop: shown.length ? `1px solid ${BORDER}` : "none" }}>
        {shown.map((item) => {
          const cat = CATEGORY[item.category] || CATEGORY.other;
          const kind = KINDS.find((k) => k.id === item.contact_kind);
          return (
            <div
              key={item.id}
              style={{
                padding: "12px 4px",
                borderBottom: `1px solid ${BORDER}`,
                fontSize: 13,
                lineHeight: 1.5,
                opacity: item.status === "done" ? 0.55 : 1,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={pill(cat.color)}>{cat.label}</span>
                <b>{item.from_name || item.from_email}</b>
                {kind ? (
                  <span style={pill(kind.color)}>
                    {kind.label}
                    {item.contact_name ? `: ${item.contact_name}` : ""}
                  </span>
                ) : (
                  <button
                    onClick={() => act(item, `/api/inbox?prospect=${item.id}`, { method: "POST" })}
                    style={{ ...button(ACCENT, false), padding: "2px 8px", fontSize: 11 }}
                  >
                    ＋ Add as prospect
                  </button>
                )}
                <span style={{ marginLeft: "auto", color: MUTED, fontSize: 12 }}>
                  {item.received_at &&
                    new Date(item.received_at).toLocaleString("en-AU", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                </span>
              </div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{item.subject || "(no subject)"}</div>
              <div style={{ color: "#F0F0F0" }}>{item.summary}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <a
                  href={gmailLink(item)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...button(ACCENT, !!item.draft_id), textDecoration: "none" }}
                >
                  {item.draft_id ? "✍️ Reply draft ready: open in Gmail" : "Open in Gmail"}
                </a>
                <button
                  onClick={() =>
                    act(item, `/api/inbox?id=${item.id}`, {
                      method: "PATCH",
                      body: { status: item.status === "done" ? "new" : "done" },
                    })
                  }
                  style={button(MUTED, false)}
                >
                  {item.status === "done" ? "↩ Not done" : "✓ Done"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
