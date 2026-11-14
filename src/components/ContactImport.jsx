// =============================================================================
// IMPORT FROM EXCEL (on the Contacts tab)
// =============================================================================
// 1. Lars picks his .xlsx or .csv file.
// 2. Mission Control guesses which column is the company, email, etc. He can
//    change any guess, and say whether the list is customers or suppliers.
// 3. Import. Anyone already saved (same email) is skipped, so it's safe to
//    import the customers file and then the suppliers file, or to run it twice.
// =============================================================================
import { useState } from "react";
import {
  KINDS,
  FIELDS,
  readSpreadsheet,
  guessColumns,
  rowsToContacts,
  importContacts,
} from "../lib/contacts.js";
import { MUTED, BORDER, ACCENT, RED, field, button } from "../lib/styles.js";

export default function ContactImport({ onDone, onCancel }) {
  const [file, setFile] = useState(null); // { name, rows }
  const [hasHeadings, setHasHeadings] = useState(true);
  const [columns, setColumns] = useState({});
  const [defaultKind, setDefaultKind] = useState("customer");
  const [busy, setBusy] = useState("");
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState(null);

  async function pickFile(e) {
    const chosen = e.target.files[0];
    if (!chosen) return;
    setProblem("");
    setBusy("Reading the file…");
    try {
      const rows = await readSpreadsheet(chosen);
      if (rows.length === 0) throw new Error("That file looks empty.");
      setFile({ name: chosen.name, rows });
      setColumns(guessColumns(rows[0]));
    } catch (err) {
      setProblem(err.message || "Couldn't read that file.");
    }
    setBusy("");
  }

  const headings = file
    ? hasHeadings
      ? file.rows[0]
      : file.rows[0].map((_, i) => `Column ${i + 1}`)
    : [];
  const dataRows = file ? file.rows.slice(hasHeadings ? 1 : 0) : [];
  const contacts = file ? rowsToContacts(dataRows, columns, defaultKind) : [];

  async function runImport() {
    setProblem("");
    setBusy(`Importing ${contacts.length} contacts…`);
    try {
      setResult(await importContacts(contacts));
    } catch (err) {
      setProblem(err.message);
    }
    setBusy("");
  }

  const box = {
    background: "#1A1A1A",
    border: `1px solid ${ACCENT}`,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    fontSize: 13,
    lineHeight: 1.6,
  };

  if (result) {
    return (
      <div style={box}>
        <b>✓ Import finished.</b> Added <b>{result.added}</b> contacts.
        {result.skipped > 0 && ` Skipped ${result.skipped} already in your contacts.`}
        {result.problems?.length > 0 && (
          <div style={{ color: RED, marginTop: 8 }}>
            These rows weren't imported:
            <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
              {result.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button onClick={onDone} style={button(ACCENT, true)}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>⬆ Import from Excel</div>
      {!file && (
        <div style={{ color: MUTED, marginBottom: 10 }}>
          Choose your customer or supplier list (.xlsx or .csv). The first sheet is read. Nothing is
          saved until you press Import.
        </div>
      )}
      <input type="file" accept=".xlsx,.csv" onChange={pickFile} disabled={!!busy} />

      {file && (
        <>
          <div style={{ color: MUTED, margin: "12px 0 8px" }}>
            Found <b style={{ color: "#F0F0F0" }}>{dataRows.length}</b> rows in {file.name}. Check
            which column is which:
          </div>
          <label
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              color: MUTED,
              marginBottom: 10,
            }}
          >
            <input
              type="checkbox"
              checked={hasHeadings}
              onChange={(e) => setHasHeadings(e.target.checked)}
            />
            The first row has the column headings
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 8,
            }}
          >
            {FIELDS.map((f) => (
              <label key={f.id} style={{ color: MUTED }}>
                {f.label}
                <select
                  value={columns[f.id] ?? -1}
                  onChange={(e) => setColumns({ ...columns, [f.id]: Number(e.target.value) })}
                  style={{ ...field, marginTop: 2 }}
                >
                  <option value={-1}>— not in the file —</option>
                  {headings.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label style={{ color: MUTED }}>
              {columns.kind >= 0
                ? "When the Type column is blank, use"
                : "Everyone in this file is a"}
              <select
                value={defaultKind}
                onChange={(e) => setDefaultKind(e.target.value)}
                style={{ ...field, marginTop: 2 }}
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ color: MUTED, margin: "14px 0 6px" }}>
            First few, as they will be saved:
          </div>
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
              <tbody>
                {contacts.slice(0, 3).map((c, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {["kind", "company", "name", "email", "phone"].map((k) => (
                      <td key={k} style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                        {(k === "kind" ? KINDS.find((x) => x.id === c.kind)?.label : c[k]) || (
                          <span style={{ color: MUTED }}>—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {problem && <div style={{ color: RED, marginTop: 10 }}>⚠️ {problem}</div>}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14 }}>
        <span style={{ color: MUTED }}>{busy}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={onCancel} disabled={!!busy} style={button(MUTED, false)}>
            Cancel
          </button>
          {file && (
            <button
              onClick={runImport}
              disabled={!!busy || contacts.length === 0}
              style={button(ACCENT, true)}
            >
              Import {contacts.length} contacts
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
