// =============================================================================
// SERVER FUNCTION: the inbox agent (the "Inbox" tab)
// =============================================================================
//   GET   /api/inbox                 the sorted emails (newest first)
//   POST  /api/inbox?check=1         check Gmail now: sort new emails, save drafts
//   POST  /api/inbox?prospect=<id>   add that email's sender to Contacts as a prospect
//   PATCH /api/inbox?id=<id>         mark one as done / not done   { status }
// =============================================================================
import {
  reply,
  checkAccess,
  databaseIsSetUp,
  listInboxItems,
  readInboxItem,
  updateInboxItem,
  createContacts,
  TableMissingError,
} from "../lib/server.js";
import { gmailIsSetUp } from "../lib/gmail.js";
import { checkInbox } from "../lib/inbox.js";

// A company name from an email domain, e.g. jo@acme-fitouts.com.au → "Acme Fitouts".
export function companyFromEmail(email) {
  const domain = String(email).split("@")[1] || "";
  const name = domain.split(".")[0] || "";
  if (!name || /^(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|bigpond)$/i.test(name)) {
    return "";
  }
  return name
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function addAsProspect(id) {
  const item = await readInboxItem(id);
  if (!item) return reply(404, { error: "That email is no longer in the list." });
  if (item.contact_id) return reply(400, { error: "That sender is already in your contacts." });
  const [contact] = await createContacts([
    {
      kind: "prospect",
      company: companyFromEmail(item.from_email),
      name: item.from_name,
      email: item.from_email,
      phone: "",
      notes: `Added from the inbox: "${item.subject}"`.slice(0, 2000),
      source: "inbox",
    },
  ]);
  const updated = await updateInboxItem(id, {
    contact_id: contact.id,
    contact_kind: "prospect",
    contact_name: contact.company || contact.name,
  });
  return reply(200, { item: updated, contact });
}

export default async (req) => {
  const denied = await checkAccess(req);
  if (denied) return denied;
  if (!gmailIsSetUp() || !databaseIsSetUp()) return reply(200, { items: [], notSetUp: true });

  const params = new URL(req.url).searchParams;
  try {
    if (req.method === "GET") return reply(200, { items: await listInboxItems() });

    if (req.method === "POST" && params.get("check")) {
      try {
        return reply(200, await checkInbox());
      } catch (err) {
        if (err instanceof TableMissingError) throw err;
        console.error("Inbox check failed:", err);
        if (err.notConnected) return reply(400, { error: "Connect Gmail first." });
        if (err.needsReconnect) {
          return reply(400, {
            error: "Google has cancelled the Gmail connection. Press Reconnect.",
          });
        }
        if (err.name === "TimeoutError" || err.name === "AbortError") {
          return reply(504, { error: "That took too long. Press Check inbox now again." });
        }
        return reply(502, { error: "The inbox check didn't finish. Try again in a minute." });
      }
    }

    if (req.method === "POST" && params.get("prospect")) {
      return await addAsProspect(params.get("prospect"));
    }

    if (req.method === "PATCH" && params.get("id")) {
      const input = await req.json().catch(() => ({}));
      if (!["new", "done"].includes(input.status)) return reply(400, { error: "Invalid status" });
      const updated = await updateInboxItem(params.get("id"), { status: input.status });
      return updated
        ? reply(200, { item: updated })
        : reply(404, { error: "That email is no longer in the list." });
    }

    return reply(405, { error: "Method not allowed" });
  } catch (err) {
    if (err instanceof TableMissingError) {
      return reply(200, { items: [], tableMissing: true, which: err.message });
    }
    console.error(err);
    return reply(502, { error: "Couldn't reach the database. Try again in a moment." });
  }
};

export const config = {
  path: "/api/inbox",
};
