// =============================================================================
// SERVER FUNCTION: the agents' daily tasks (the "Daily Tasks" tab)
// =============================================================================
//   GET    /api/tasks            list every task
//   POST   /api/tasks            add one     { agent_id, name, prompt, enabled }
//   PATCH  /api/tasks?id=…       change one  (any of those fields)
//   DELETE /api/tasks?id=…       remove one
// Needs the passcode, like the chat. Tasks are checked here so a typo can't
// create something broken or expensive.
// =============================================================================
import { AGENTS } from "../../src/agents.js";
import {
  reply,
  checkPasscode,
  databaseIsSetUp,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  TableMissingError,
} from "../lib/server.js";

// Every enabled task runs each morning at the same time, so keep the number
// sensible (time limit and cost).
const MAX_ENABLED_TASKS = 8;
const MAX_NAME = 80;
const MAX_PROMPT = 1500;

// Checks the fields that were sent. Returns { task } or { problem }.
function cleanTask(input, { partial }) {
  const task = {};
  if ("agent_id" in input || !partial) {
    if (!AGENTS.some((a) => a.id === input.agent_id)) return { problem: "Pick one of the agents." };
    task.agent_id = input.agent_id;
  }
  if ("name" in input || !partial) {
    const name = String(input.name || "").trim();
    if (!name) return { problem: "Give the task a short name." };
    if (name.length > MAX_NAME) return { problem: `Keep the name under ${MAX_NAME} characters.` };
    task.name = name;
  }
  if ("prompt" in input || !partial) {
    const prompt = String(input.prompt || "").trim();
    if (prompt.length < 10) return { problem: "Describe what the agent should do." };
    if (prompt.length > MAX_PROMPT) {
      return { problem: `Keep "what to do" under ${MAX_PROMPT} characters.` };
    }
    task.prompt = prompt;
  }
  if ("enabled" in input) task.enabled = Boolean(input.enabled);
  return { task };
}

async function tooManyEnabled(excludeId) {
  const enabled = (await listTasks({ enabledOnly: true })).filter((t) => t.id !== excludeId);
  return enabled.length >= MAX_ENABLED_TASKS;
}

export default async (req) => {
  const denied = checkPasscode(req);
  if (denied) return denied;
  if (!databaseIsSetUp()) return reply(200, { tasks: [], notSetUp: true });

  const id = new URL(req.url).searchParams.get("id");
  try {
    if (req.method === "GET") return reply(200, { tasks: await listTasks() });

    if (req.method === "DELETE") {
      if (!id) return reply(400, { error: "Which task?" });
      return (await deleteTask(id))
        ? reply(200, { ok: true })
        : reply(404, { error: "That task no longer exists." });
    }

    const input = await req.json().catch(() => null);
    if (!input || typeof input !== "object") return reply(400, { error: "Invalid request" });

    if (req.method === "POST") {
      const { task, problem } = cleanTask(input, { partial: false });
      if (problem) return reply(400, { error: problem });
      if (task.enabled !== false && (await tooManyEnabled())) {
        return reply(400, {
          error: `You can have up to ${MAX_ENABLED_TASKS} tasks switched on. Switch one off first.`,
        });
      }
      return reply(200, { task: await createTask(task) });
    }

    if (req.method === "PATCH") {
      if (!id) return reply(400, { error: "Which task?" });
      const { task, problem } = cleanTask(input, { partial: true });
      if (problem) return reply(400, { error: problem });
      if (task.enabled === true && (await tooManyEnabled(id))) {
        return reply(400, {
          error: `You can have up to ${MAX_ENABLED_TASKS} tasks switched on. Switch one off first.`,
        });
      }
      const updated = await updateTask(id, task);
      return updated
        ? reply(200, { task: updated })
        : reply(404, { error: "That task no longer exists." });
    }

    return reply(405, { error: "Method not allowed" });
  } catch (err) {
    if (err instanceof TableMissingError) return reply(200, { tasks: [], tableMissing: true });
    console.error(err);
    return reply(502, { error: "Couldn't reach the database. Try again in a moment." });
  }
};

export const config = {
  path: "/api/tasks",
};
