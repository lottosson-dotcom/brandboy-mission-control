// =============================================================================
// SHARED CLAUDE HELPERS (used by the chat and by the daily scans)
// =============================================================================
// How we ask Claude, read its answer, handle web searches and list sources.
// Kept in one place so the chat (ask-agent.js) and the scheduled scans
// (daily-scan.js) behave exactly the same.
// =============================================================================
import { BRANDBOY_BRIEF } from "../../src/agents.js";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

// Builds the request for one agent. maxTokens = longest answer allowed.
export function buildRequest(agent, messages, maxTokens) {
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  return {
    model,
    max_tokens: maxTokens,
    // Sonnet 5.5 "thinks" before answering by default, and that thinking uses
    // up the token limit, which could leave the answer empty. These are quick
    // answers, so thinking is turned off: faster and never blank.
    // (This setting only exists on Sonnet 5.5; other models skip it.)
    ...(model === "claude-sonnet-5-5" && { thinking: { type: "between_tools" } }),
    // Every agent gets the shared Brandboy brief first, then its own job.
    system: [BRANDBOY_BRIEF, agent.systemPrompt, agent.webSearch && webSearchRules()]
      .filter(Boolean)
      .join("\n\n"),
    ...(agent.webSearch && { tools: [WEB_SEARCH_TOOL] }),
    messages,
  };
}

export function shorten(text, max) {
  const flat = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

// signal (optional) stops the call after a time limit.
export function callClaude(apiKey, request, signal) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ ...request, stream: true }),
    signal,
  });
}

// Reads Claude's live answer (server-sent events) and rebuilds the full reply
// from it, while passing each new piece of text on as it arrives.
export async function readClaudeStream(res, { onText, onSearch }) {
  const blocks = [];
  const toolInput = {};
  let stopReason = null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const event = JSON.parse(line.slice(5));
      if (event.type === "content_block_start") {
        const block = structuredClone(event.content_block);
        if (block.type === "text") block.text ||= "";
        blocks[event.index] = block;
        if (block.type === "server_tool_use") onSearch();
      } else if (event.type === "content_block_delta") {
        const block = blocks[event.index];
        const d = event.delta;
        if (d.type === "text_delta") {
          block.text += d.text;
          onText(d.text);
        } else if (d.type === "input_json_delta") {
          toolInput[event.index] = (toolInput[event.index] || "") + d.partial_json;
        } else if (d.type === "citations_delta") {
          (block.citations ||= []).push(d.citation);
        } else if (d.type === "thinking_delta") {
          block.thinking = (block.thinking || "") + d.thinking;
        } else if (d.type === "signature_delta") {
          block.signature = d.signature;
        }
      } else if (event.type === "content_block_stop") {
        if (toolInput[event.index] !== undefined) {
          blocks[event.index].input = JSON.parse(toolInput[event.index] || "{}");
        }
      } else if (event.type === "message_delta") {
        stopReason = event.delta?.stop_reason ?? stopReason;
      } else if (event.type === "error") {
        throw new Error(event.error?.message || "Claude stream error");
      }
    }
  }
  return { blocks: blocks.filter(Boolean), stopReason };
}

// Works out the final answer to show, or a friendly error.
export function finalAnswer(content, stopReason) {
  if (stopReason === "refusal") {
    return { type: "error", error: "The agent declined that request. Try rephrasing it." };
  }
  for (const block of content) {
    if (block.type === "web_search_tool_result" && block.content?.error_code) {
      console.error("Web search failed:", block.content.error_code);
    }
  }
  // Only keep the text written after the last search: the final answer, not
  // the "I'll search for…" notes in between.
  const lastSearch = content.findLastIndex(
    (block) => block.type === "server_tool_use" || block.type === "web_search_tool_result",
  );
  const textBlocks = content.slice(lastSearch + 1).filter((block) => block.type === "text");
  let text = textBlocks
    .map((block) => block.text)
    .join("")
    .trim();
  if (!text) {
    console.error("Empty answer", stopReason);
    return {
      type: "error",
      error: "The agent didn't manage an answer that time. Press Send to retry.",
    };
  }
  if (stopReason === "max_tokens" || stopReason === "pause_turn") {
    text += "\n\n_(Answer cut short. Ask me to continue.)_";
  }
  return { type: "done", text: text + sourcesList(textBlocks) };
}

// ---- Web search ----------------------------------------------------------------
// Only agents with `webSearch: true` in src/agents.js get this. Searches are
// capped so one answer can't take too long or cost too much.
export const WEB_SEARCH_TOOL = {
  // The basic version: searches directly. (The newer "dynamic filtering"
  // version runs extra code per search, which was slower and less reliable.)
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 3,
  // Results for Australia as a whole (no particular city or state).
  user_location: { type: "approximate", country: "AU", timezone: "Australia/Sydney" },
};
export const CONTINUE_WITHIN_MS = 35000;

export function webSearchRules() {
  const today = new Date().toLocaleDateString("en-AU", {
    dateStyle: "long",
    timeZone: "Australia/Sydney",
  });
  return [
    `Today is ${today}.`,
    "You can search the web. Use it for anything current or specific: tenders, DAs, companies, people, prices, rankings.",
    "Brandboy works across all of Australia. Search for Australian results (put Australia, or the state Lars mentions, in your searches), cover every state unless he names one, prefer .gov.au and .com.au sources, and leave out overseas results unless Lars asks for them.",
    "Use at most 3 searches, and keep the answer short enough to read on one screen.",
    "Never invent tenders, companies, names, phone numbers or emails. If you can't find something, say so plainly.",
  ].join(" ");
}

// Turns the web pages Claude quoted into a "Sources" list of links, so Lars can
// check where each fact came from.
export function sourcesList(textBlocks) {
  const seen = new Map();
  for (const block of textBlocks) {
    for (const c of block.citations || []) {
      if (c.url && !seen.has(c.url)) seen.set(c.url, (c.title || c.url).replace(/[[\]]/g, ""));
    }
  }
  if (!seen.size) return "";
  const links = [...seen].slice(0, 8).map(([url, title]) => `- [${title}](${url})`);
  return `\n\n**Sources**\n${links.join("\n")}`;
}
