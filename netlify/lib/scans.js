// =============================================================================
// RUNNING THE DAILY TASKS
// =============================================================================
// Lars sets up each agent's daily tasks on the "Daily Tasks" tab (stored in the
// daily_tasks table). Each morning every switched-on task runs once: the agent
// does what the task says (searching the web if it can) and writes a short
// report into the Activity Log. Its previous report is passed along so new
// items can be marked NEW. All tasks run at the same time to stay inside
// Netlify's time limit (30 seconds for scheduled runs).
// =============================================================================
import { AGENTS } from "../../src/agents.js";
import { buildRequest, callClaude, readClaudeStream, finalAnswer } from "./claude.js";
import { logActivity, readLatestEntry, listTasks } from "./server.js";

const TASK_TIME_LIMIT_MS = 24000; // leaves time to save the report
const TASK_MAX_TOKENS = 1500;
const TASK_MAX_SEARCHES = 2;

export const SCAN_LABEL = "🕕 Daily task";

// How every report is laid out (added after the task's own instructions).
const REPORT_FORMAT = [
  "This is your scheduled daily task: nobody is chatting with you, so just do it and write the report.",
  "Write a short report for Lars, as a list, with links where you have them.",
  "If you find nothing new or relevant, say so in one line: don't pad the report.",
].join(" ");

export function taskAction(task) {
  return `Daily task: ${task.name}`;
}

async function runTask(task, apiKey) {
  const agent = AGENTS.find((a) => a.id === task.agent_id);
  if (!agent) throw new Error(`Task "${task.name}" uses an unknown agent: ${task.agent_id}`);

  const previous = await readLatestEntry(taskAction(task));
  const prompt = [
    task.prompt,
    REPORT_FORMAT,
    previous?.detail && !previous.detail.startsWith("⚠️")
      ? `Your previous report is below. Mark items that weren't in it as **NEW**, and leave out ones that no longer apply (for example closed tenders).\n\n---\n${previous.detail.slice(0, 4000)}\n---`
      : "This is the first run, so everything counts as new.",
  ].join("\n\n");

  const request = buildRequest(agent, [{ role: "user", content: prompt }], TASK_MAX_TOKENS);
  if (request.tools) {
    request.tools = request.tools.map((t) => ({ ...t, max_uses: TASK_MAX_SEARCHES }));
  }

  const signal = AbortSignal.timeout(TASK_TIME_LIMIT_MS);
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
    console.error(`Task "${task.name}" failed:`, err);
    answer = { type: "error", error: signal.aborted ? "ran out of time" : "something went wrong" };
  }

  await logActivity({
    agent_name: agent.name,
    action: taskAction(task),
    detail:
      answer.type === "done"
        ? answer.text
        : `⚠️ This task didn't finish (${answer.error}). It will try again tomorrow, or press "Run now".`,
    client_project: SCAN_LABEL,
    color: agent.color,
  });
  return { id: task.id, name: task.name, ok: answer.type === "done" };
}

// Runs the switched-on tasks (or just one, if taskId is given) at the same
// time. Returns [{ id, name, ok }].
export async function runTasks(taskId) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Server is missing ANTHROPIC_API_KEY");
  const all = await listTasks({ enabledOnly: !taskId });
  const tasks = taskId ? all.filter((t) => t.id === taskId) : all;
  const results = await Promise.allSettled(tasks.map((task) => runTask(task, apiKey)));
  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { id: tasks[i].id, name: tasks[i].name, ok: false },
  );
}
