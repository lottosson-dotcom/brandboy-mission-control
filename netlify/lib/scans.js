// =============================================================================
// RUNNING THE DAILY SCANS (see src/scans.js for the list of searches)
// =============================================================================
// Each scan: the agent searches the web, writes a short report, and the report
// is saved in the Activity Log. Yesterday's report is passed along so new
// tenders can be marked NEW. All scans run at the same time to stay inside
// Netlify's time limit (30 seconds for scheduled runs).
// =============================================================================
import { AGENTS } from "../../src/agents.js";
import { DAILY_SCANS, SCAN_REPORT_FORMAT } from "../../src/scans.js";
import { buildRequest, callClaude, readClaudeStream, finalAnswer } from "./claude.js";
import { logActivity, readLatestEntry } from "./server.js";

const SCAN_TIME_LIMIT_MS = 24000; // leaves time to save the report
const SCAN_MAX_TOKENS = 1500;
const SCAN_MAX_SEARCHES = 2;

export const SCAN_LABEL = "🕕 Daily scan";

export function scanAction(scan) {
  return `Daily scan: ${scan.name}`;
}

async function runScan(scan, apiKey) {
  const agent = AGENTS.find((a) => a.id === scan.agentId && a.webSearch);
  if (!agent) throw new Error(`Scan "${scan.name}" needs an agent that can search the web`);

  const previous = await readLatestEntry(scanAction(scan));
  const prompt = [
    scan.prompt,
    SCAN_REPORT_FORMAT,
    previous?.detail
      ? `Your previous report is below. Mark tenders that weren't in it as **NEW**, and leave out ones that have closed.\n\n---\n${previous.detail.slice(0, 4000)}\n---`
      : "This is the first run, so everything counts as new.",
  ].join("\n\n");

  const request = buildRequest(agent, [{ role: "user", content: prompt }], SCAN_MAX_TOKENS);
  request.tools = request.tools.map((t) => ({ ...t, max_uses: SCAN_MAX_SEARCHES }));

  const signal = AbortSignal.timeout(SCAN_TIME_LIMIT_MS);
  let answer;
  try {
    const content = [];
    let stopReason;
    for (let round = 0; round < 3; round++) {
      const res = await callClaude(apiKey, request, signal);
      if (!res.ok) throw new Error(`Claude returned ${res.status}: ${await res.text()}`);
      const turn = await readClaudeStream(res, { onText: () => {}, onSearch: () => {} });
      content.push(...turn.blocks);
      stopReason = turn.stopReason;
      if (stopReason !== "pause_turn") break;
      request.messages = [request.messages[0], { role: "assistant", content }];
    }
    answer = finalAnswer(content, stopReason);
  } catch (err) {
    console.error(`Scan "${scan.name}" failed:`, err);
    answer = {
      type: "error",
      error: signal.aborted ? "ran out of time" : "something went wrong",
    };
  }

  await logActivity({
    agent_name: agent.name,
    action: scanAction(scan),
    detail:
      answer.type === "done"
        ? answer.text
        : `⚠️ This scan didn't finish (${answer.error}). It will try again tomorrow, or press "Run scans now".`,
    client_project: SCAN_LABEL,
    color: agent.color,
  });
  return { name: scan.name, ok: answer.type === "done" };
}

// Runs every scan at once. Returns [{ name, ok }].
export async function runAllScans() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Server is missing ANTHROPIC_API_KEY");
  const results = await Promise.allSettled(DAILY_SCANS.map((scan) => runScan(scan, apiKey)));
  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { name: DAILY_SCANS[i].name, ok: false },
  );
}
