// =============================================================================
// ACTIVITY LOG AND DAILY TASKS (browser side)
// =============================================================================
// The browser never talks to the database directly. It asks the server
// functions (passcode-protected), which read and write it.
// =============================================================================
import { callApi } from "./api.js";

// Returns { entries, notSetUp }.
export function fetchActivity() {
  return callApi("/api/activity");
}

// Runs the switched-on daily tasks now (or one task, by id). Returns [{ id, name, ok }].
export async function runTasksNow(taskId) {
  const path = taskId ? `/api/run-scans?id=${encodeURIComponent(taskId)}` : "/api/run-scans";
  return (await callApi(path, { method: "POST" })).results || [];
}

// Returns { tasks, notSetUp, tableMissing }.
export function fetchTasks() {
  return callApi("/api/tasks");
}

export async function saveTask(task) {
  const { id, agent_id, name, prompt, enabled } = task;
  const fields = { agent_id, name, prompt, enabled };
  const data = id
    ? await callApi(`/api/tasks?id=${encodeURIComponent(id)}`, { method: "PATCH", body: fields })
    : await callApi("/api/tasks", { method: "POST", body: fields });
  return data.task;
}

export function removeTask(id) {
  return callApi(`/api/tasks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}
