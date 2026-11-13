// =============================================================================
// SCHEDULED FUNCTION: runs the agents' daily tasks every morning
// =============================================================================
// Netlify runs this by itself on the schedule below; nobody visits a page.
// It only runs on the LIVE site (not on previews). To test any time, use
// "Run now" on the Daily Tasks tab (netlify/functions/run-scans.js).
// What gets done: the switched-on tasks on the Daily Tasks tab.
// =============================================================================
import { runTasks } from "../lib/scans.js";
import { databaseIsSetUp } from "../lib/server.js";

export default async () => {
  if (!databaseIsSetUp()) return;
  try {
    console.log("Daily tasks:", JSON.stringify(await runTasks()));
  } catch (err) {
    console.error("Daily tasks couldn't run:", err);
  }
};

export const config = {
  // Netlify schedules use UTC time. 19:00 UTC = 6am in Sydney during daylight
  // saving (October to April) and 5am the rest of the year.
  schedule: "0 19 * * *",
};
