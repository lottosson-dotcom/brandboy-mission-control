// =============================================================================
// SERVER FUNCTION: talks to Claude on behalf of the website
// =============================================================================
// The website calls /api/ask-agent with { agentId, messages }. This function
// adds the secret Anthropic API key and the agent's private instructions, asks
// Claude, and sends the answer back.
//
// Safety rules built in (do not remove):
//   1. A passcode is required (APP_PASSCODE, set in Netlify). Without it,
//      anyone on the internet could use Brandboy's Anthropic account.
//   2. The website can only pick an agent by id. The instructions and the
//      model are chosen here on the server, never by the browser.
//   3. Conversations are capped in size so one request can't run up a big bill.
//
// Settings (Netlify → Site configuration → Environment variables):
//   ANTHROPIC_API_KEY   required — the Anthropic key
//   APP_PASSCODE        required — the passcode Lars types into the website
//   ANTHROPIC_MODEL     optional — defaults to DEFAULT_MODEL below
// =============================================================================
import { AGENTS } from "../../src/agents.js";

const DEFAULT_MODEL = "claude-sonnet-5-5";
// Kept at 1000: longer answers can exceed Netlify's ~10s function time limit.
// Streaming the reply (docs/PLAN.md, A3) removes this limit.
const MAX_OUTPUT_TOKENS = 1000;
const MAX_MESSAGES = 40;
const MAX_TOTAL_CHARACTERS = 60000;

function reply(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async (req) => {
  if (req.method !== "POST") {
    return reply(405, { error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const passcode = process.env.APP_PASSCODE;
  if (!apiKey || !passcode) {
    return reply(500, {
      error: "Server is missing ANTHROPIC_API_KEY or APP_PASSCODE",
    });
  }

  // Trim both sides so a stray space from copy-paste doesn't lock Lars out.
  if ((req.headers.get("x-app-passcode") || "").trim() !== passcode.trim()) {
    return reply(401, { error: "Wrong or missing passcode" });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "Invalid JSON body" });
  }

  const { agentId, messages } = body;
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) {
    return reply(400, { error: `Unknown agent: ${agentId}` });
  }

  const messagesAreValid =
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.length <= MAX_MESSAGES &&
    messages.every(
      (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    );
  if (!messagesAreValid) {
    return reply(400, { error: "messages must be a list of chat turns" });
  }

  const totalCharacters = messages.reduce((n, m) => n + m.content.length, 0);
  if (totalCharacters > MAX_TOTAL_CHARACTERS) {
    return reply(400, {
      error: "This conversation is too long. Start a new one.",
    });
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: agent.systemPrompt,
      messages,
    }),
  });

  const data = await anthropicRes.json();
  if (!anthropicRes.ok) {
    console.error("Anthropic error", anthropicRes.status, data);
    return reply(502, {
      error: data?.error?.message || "Claude returned an error",
    });
  }

  const text = (data.content || []).map((block) => block.text || "").join("");
  return reply(200, { text });
};

export const config = {
  path: "/api/ask-agent",
};
