// =============================================================================
// DAILY SCANS: searches an agent runs by itself every morning
// =============================================================================
// Every morning (about 6am Sydney time) each scan below runs once: the agent
// searches the web and writes a short report into the Activity Log. Tenders
// that weren't in yesterday's report are marked NEW.
//
// To add a scan: copy a block, give it a new `name`, pick the agent (`agentId`
// from src/agents.js, it must have webSearch: true) and write what to look for
// in `prompt`, the way you'd ask the agent in the chat.
// Each scan costs a few cents per day (up to 2 web searches plus reading).
// =============================================================================

export const DAILY_SCANS = [
  {
    name: "NSW government signage tenders",
    agentId: "hunter",
    prompt:
      "Find currently open New South Wales government and council tenders for signage, wayfinding, branding or display work (check NSW eTendering at tenders.nsw.gov.au first).",
  },
  {
    name: "QLD government signage tenders",
    agentId: "hunter",
    prompt:
      "Find currently open Queensland government and council tenders for signage, wayfinding, branding or display work (check QTenders at qtenders.epw.qld.gov.au first).",
  },
];

// How every scan report is laid out (added to each prompt above).
export const SCAN_REPORT_FORMAT = [
  "Write a short report for Lars, as a list. For each tender give: the title, the buyer (department or council), the closing date, the value if it's shown, and the link.",
  "Mark anything worth over $500K as **PRIORITY**.",
  "Only include tenders that are open now. If you find none, say so in one line: don't pad the report.",
].join(" ");
