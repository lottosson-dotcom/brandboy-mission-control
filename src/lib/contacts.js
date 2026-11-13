// =============================================================================
// CONTACTS (browser side): customers, suppliers and prospects
// =============================================================================
// Talks to netlify/functions/contacts.js, and reads Lars's Excel / CSV file for
// the one-off import. The file is read on his computer; only the rows he
// chooses to import are sent to the server.
// =============================================================================
import { callApi } from "./api.js";

export const KINDS = [
  { id: "customer", label: "Customer", plural: "Customers", color: "#22C55E" },
  { id: "supplier", label: "Supplier", plural: "Suppliers", color: "#3B82F6" },
  { id: "prospect", label: "Prospect", plural: "Prospects", color: "#F5A623" },
];

export const FIELDS = [
  { id: "company", label: "Company" },
  { id: "name", label: "Contact person" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "notes", label: "Notes" },
  { id: "kind", label: "Type (customer/supplier)" },
];

// Returns { contacts, notSetUp, tableMissing }.
export function fetchContacts() {
  return callApi("/api/contacts");
}

export async function saveContact(contact) {
  const { id, kind, company, name, email, phone, notes } = contact;
  const fields = { kind, company, name, email, phone, notes };
  const data = id
    ? await callApi(`/api/contacts?id=${encodeURIComponent(id)}`, { method: "PATCH", body: fields })
    : await callApi("/api/contacts", { method: "POST", body: fields });
  return data.contact;
}

export function removeContact(id) {
  return callApi(`/api/contacts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

// Returns { added, skipped, problems }.
export function importContacts(contacts) {
  return callApi("/api/contacts?import=1", { method: "POST", body: { contacts } });
}

// ---- Reading the file --------------------------------------------------------

// Returns the rows of the file's first sheet as lists of text.
export async function readSpreadsheet(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return parseCsv(await file.text());
  if (name.endsWith(".xlsx")) {
    // Only loaded when needed, so the rest of the app stays quick to open.
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    return rows.map((row) => row.map((cell) => (cell == null ? "" : String(cell).trim())));
  }
  throw new Error(
    "Mission Control reads .xlsx and .csv files. In Excel, use File → Save As → Excel Workbook (.xlsx).",
  );
}

// Simple CSV reader: handles quotes, commas inside quotes, and Excel's ; files.
export function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const sep = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'; // "" inside quotes means one " character
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell.trim()]);
  return rows.filter((r) => r.some((c) => c));
}

// Guesses which column holds what, from the header names.
// Returns { company: 0, email: 3, … } (column numbers, or -1 for "not in file").
const HINTS = {
  email: ["email", "e-mail", "mail"],
  phone: ["phone", "mobile", "tel", "cell"],
  name: ["contact", "name", "person", "first", "full name"],
  company: [
    "company",
    "business",
    "organisation",
    "organization",
    "customer",
    "supplier",
    "client",
    "account",
    "trading",
  ],
  notes: ["note", "comment", "description", "memo"],
  kind: ["type", "category", "kind", "group"],
};

export function guessColumns(headers) {
  const lower = headers.map((h) => String(h).toLowerCase());
  const taken = new Set();
  const map = {};
  // Most specific first, so "Customer email" becomes email, not company.
  for (const field of ["email", "phone", "kind", "notes", "company", "name"]) {
    const col = lower.findIndex(
      (h, i) => !taken.has(i) && HINTS[field].some((hint) => h.includes(hint)),
    );
    map[field] = col;
    if (col >= 0) taken.add(col);
  }
  return map;
}

// Turns a cell from a "Type" column into customer / supplier / prospect.
export function kindFrom(text, fallback) {
  const t = String(text || "").toLowerCase();
  if (t.includes("supp") || t.includes("vendor")) return "supplier";
  if (t.includes("prosp") || t.includes("lead")) return "prospect";
  if (t.includes("cust") || t.includes("client")) return "customer";
  return fallback;
}

// Builds the contacts to import from the rows, the column choices and the
// type to use when the file doesn't say.
export function rowsToContacts(rows, columns, defaultKind) {
  const pick = (row, field) => (columns[field] >= 0 ? row[columns[field]] || "" : "");
  return rows
    .map((row) => ({
      kind: columns.kind >= 0 ? kindFrom(pick(row, "kind"), defaultKind) : defaultKind,
      company: pick(row, "company"),
      name: pick(row, "name"),
      email: pick(row, "email"),
      phone: pick(row, "phone"),
      notes: pick(row, "notes"),
    }))
    .filter((c) => c.company || c.name || c.email);
}
