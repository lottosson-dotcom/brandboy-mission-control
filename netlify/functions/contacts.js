// =============================================================================
// SERVER FUNCTION: customers, suppliers and prospects (the "Contacts" tab)
// =============================================================================
//   GET    /api/contacts            list every contact
//   POST   /api/contacts            add one        { kind, company, name, email, phone, notes }
//   POST   /api/contacts?import=1   add many       { contacts: [ … ] }  (the Excel import)
//   PATCH  /api/contacts?id=…       change one
//   DELETE /api/contacts?id=…       remove one
// Contacts are checked here so a bad row can't save rubbish. The import skips
// anyone already saved (same email, or same company + name when there's no
// email), so running it twice doesn't make doubles.
// =============================================================================
import {
  reply,
  checkAccess,
  databaseIsSetUp,
  listContacts,
  createContacts,
  updateContact,
  deleteContact,
  TableMissingError,
} from "../lib/server.js";

export const KINDS = ["customer", "supplier", "prospect"];
const MAX_IMPORT = 5000;
const LIMITS = { company: 150, name: 120, email: 200, phone: 50, notes: 2000 };

// Checks one contact. Returns { contact } or { problem }.
export function cleanContact(input, { partial = false } = {}) {
  const contact = {};
  if ("kind" in input || !partial) {
    const kind = String(input.kind || "customer").toLowerCase();
    if (!KINDS.includes(kind)) return { problem: "Type must be customer, supplier or prospect." };
    contact.kind = kind;
  }
  for (const [key, max] of Object.entries(LIMITS)) {
    if (key in input || !partial) {
      const value = String(input[key] ?? "").trim();
      if (value.length > max) return { problem: `Keep ${key} under ${max} characters.` };
      contact[key] = value;
    }
  }
  if (contact.email !== undefined) {
    contact.email = contact.email.toLowerCase();
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      return { problem: `"${contact.email}" doesn't look like an email address.` };
    }
  }
  if (!partial && !contact.company && !contact.name) {
    return { problem: "Give at least a company or a person's name." };
  }
  return { contact };
}

// What makes two contacts "the same" for the import.
export function sameKey(c) {
  return c.email
    ? `e:${c.email.toLowerCase()}`
    : `n:${(c.company || "").toLowerCase()}|${(c.name || "").toLowerCase()}`;
}

async function importMany(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return reply(400, { error: "Nothing to import." });
  if (rows.length > MAX_IMPORT) {
    return reply(400, { error: `That's more than ${MAX_IMPORT} rows. Split the file in two.` });
  }
  const seen = new Set((await listContacts()).map(sameKey));
  const toAdd = [];
  const problems = [];
  let skipped = 0;
  rows.forEach((row, i) => {
    const { contact, problem } = cleanContact(row || {});
    if (problem)
      return problems.push(
        `${row?.company || row?.name || row?.email || `Row ${i + 1}`}: ${problem}`,
      );
    const key = sameKey(contact);
    if (seen.has(key)) return skipped++;
    seen.add(key);
    toAdd.push({ ...contact, source: "import" });
  });
  // Save in batches so one big file doesn't hit the database's size limit.
  for (let i = 0; i < toAdd.length; i += 500) await createContacts(toAdd.slice(i, i + 500));
  return reply(200, { added: toAdd.length, skipped, problems: problems.slice(0, 20) });
}

export default async (req) => {
  const denied = await checkAccess(req);
  if (denied) return denied;
  if (!databaseIsSetUp()) return reply(200, { contacts: [], notSetUp: true });

  const params = new URL(req.url).searchParams;
  const id = params.get("id");
  try {
    if (req.method === "GET") return reply(200, { contacts: await listContacts() });

    if (req.method === "DELETE") {
      if (!id) return reply(400, { error: "Which contact?" });
      return (await deleteContact(id))
        ? reply(200, { ok: true })
        : reply(404, { error: "That contact no longer exists." });
    }

    const input = await req.json().catch(() => null);
    if (!input || typeof input !== "object") return reply(400, { error: "Invalid request" });

    if (req.method === "POST" && params.get("import")) return await importMany(input.contacts);

    if (req.method === "POST") {
      const { contact, problem } = cleanContact(input);
      if (problem) return reply(400, { error: problem });
      const [saved] = await createContacts([{ ...contact, source: "manual" }]);
      return reply(200, { contact: saved });
    }

    if (req.method === "PATCH") {
      if (!id) return reply(400, { error: "Which contact?" });
      const { contact, problem } = cleanContact(input, { partial: true });
      if (problem) return reply(400, { error: problem });
      const updated = await updateContact(id, contact);
      return updated
        ? reply(200, { contact: updated })
        : reply(404, { error: "That contact no longer exists." });
    }

    return reply(405, { error: "Method not allowed" });
  } catch (err) {
    if (err instanceof TableMissingError) return reply(200, { contacts: [], tableMissing: true });
    console.error(err);
    return reply(502, { error: "Couldn't reach the database. Try again in a moment." });
  }
};

export const config = {
  path: "/api/contacts",
};
