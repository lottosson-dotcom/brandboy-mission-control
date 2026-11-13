// =============================================================================
// SCHEDULED FUNCTION: runs the daily scans every morning
// =============================================================================
// Netlify runs this by itself on the schedule below; nobody visits a page.
// It only runs on the LIVE site (not on previews). To test it any time, use the
// "Run scans now" button on the Activity Log tab (netlify/functions/run-scans.js).
// What gets searched: src/scans.js.
// =============================================================================
import { runAllScans } from "../lib/scans.js";

export default async () => {
  const results = await runAllScans();
  console.log("Daily scans:", JSON.stringify(results));
};

export const config = {
  // Netlify schedules use UTC time. 19:00 UTC = 6am in Sydney during daylight
  // saving (October to April) and 5am the rest of the year.
  schedule: "0 19 * * *",
};
