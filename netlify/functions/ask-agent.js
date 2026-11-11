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
import { reply, checkPasscode, logActivity } from "../lib/server.js";

const DEFAULT_MODEL = "claude-sonnet-5-5";
// Answers are streamed, and Netlify allows 60 seconds per answer, so there's
// room for long answers (about 2,000 words).
const MAX_OUTPUT_TOKENS = 3000;
const MAX_MESSAGES = 40;
const MAX_TOTAL_CHARACTERS = 60000;
// PDFs: Netlify accepts requests up to about 6 MB, and a PDF grows by a third
// when sent from the browser, so the website keeps each PDF under 4 MB.
const MAX_PDFS = 2;
const MAX_PDF_CHARACTERS = 5_600_000;

export default async (req) => {
  if (req.method !== "POST") {
    return reply(405, { error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return reply(500, { error: "Server is missing ANTHROPIC_API_KEY" });
  const denied = checkPasscode(req);
  if (denied) return denied;

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
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        (m.pdf === undefined ||
          (m.role === "user" &&
            typeof m.pdf?.name === "string" &&
            typeof m.pdf?.data === "string")),
    );
  if (!messagesAreValid) {
    return reply(400, { error: "messages must be a list of chat turns" });
  }

  const pdfs = messages.filter((m) => m.pdf).map((m) => m.pdf);
  const pdfCharacters = pdfs.reduce((n, p) => n + p.data.length, 0);
  if (pdfs.length > MAX_PDFS || pdfCharacters > MAX_PDF_CHARACTERS) {
    return reply(400, {
      error: "Too many or too large PDFs in this chat. Start a new chat with just one.",
    });
  }

  const totalCharacters = messages.reduce((n, m) => n + m.content.length, 0);
  if (totalCharacters > MAX_TOTAL_CHARACTERS) {
    return reply(400, {
      error: "This conversation is too long. Start a new one.",
    });
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const request = {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    // Sonnet 5.5 "thinks" before answering by default, and that thinking uses
    // up the token limit above, which could leave the answer empty. These are
    // quick chat answers, so thinking is turned off: faster and never blank.
    // (This setting only exists on Sonnet 5.5; other models skip it.)
    ...(model === "claude-sonnet-5-5" && { thinking: { type: "between_tools" } }),
    system: agent.webSearch ? `${agent.systemPrompt}\n\n${webSearchRules()}` : agent.systemPrompt,
    ...(agent.webSearch && { tools: [WEB_SEARCH_TOOL] }),
    messages: messages.map(toClaudeMessage),
  };
  const originalMessages = request.messages;

  // The first call to Claude happens before we start answering, so problems
  // like a bad key still come back as a normal error message.
  const first = await callClaude(apiKey, request);
  if (!first.ok) {
    const data = await first.json().catch(() => ({}));
    console.error("Anthropic error", first.status, data);
    return reply(502, { error: data?.error?.message || "Claude returned an error" });
  }

  // From here the answer is STREAMED: the website receives one line per event
  //   {"type":"text","text":"..."}   more words of the answer
  //   {"type":"searching"}           a web search started (hide the words so far)
  //   {"type":"done","text":"..."}   the final, complete answer (with sources)
  //   {"type":"error","error":"..."} something went wrong part-way
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        const startedAt = Date.now();
        const content = [];
        let res = first;
        let stopReason;
        for (;;) {
          const turn = await readClaudeStream(res, {
            onText: (text) => send({ type: "text", text }),
            onSearch: () => send({ type: "searching" }),
          });
          content.push(...turn.blocks);
          stopReason = turn.stopReason;
          // A web search can make Claude "pause" part-way; let it carry on
          // while there's time left before Netlify's 60-second limit.
          if (stopReason !== "pause_turn" || Date.now() - startedAt > CONTINUE_WITHIN_MS) break;
          request.messages = [...originalMessages, { role: "assistant", content }];
          res = await callClaude(apiKey, request);
          if (!res.ok) throw new Error(`Claude returned ${res.status} on continue`);
        }
        const answer = finalAnswer(content, stopReason);
        send(answer);
        if (answer.type === "done") {
          // One line in the Activity Log: who did what. Skipped if the
          // database isn't set up; never breaks the chat.
          const question = messages.at(-1);
          await logActivity({
            agent_name: agent.name,
            action: shorten(question.content, 140),
            detail: shorten(answer.text.replace(/[#*_>|`[\]]/g, ""), 220),
            client_project: question.pdf ? `📄 ${question.pdf.name}` : null,
            color: agent.color,
          });
        }
      } catch (err) {
        console.error("Streaming failed:", err);
        send({ type: "error", error: "Something went wrong part-way. Press Send to retry." });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
};

function shorten(text, max) {
  const flat = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function callClaude(apiKey, request) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ ...request, stream: true }),
  });
}

// Reads Claude's live answer (server-sent events) and rebuilds the full reply
// from it, while passing each new piece of text on as it arrives.
async function readClaudeStream(res, { onText, onSearch }) {
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
function finalAnswer(content, stopReason) {
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

// ---- PDFs ----------------------------------------------------------------------
// A message with a PDF becomes "here's a document" + the question. The PDF is
// marked for caching, so follow-up questions about it cost about a tenth.
function toClaudeMessage(m) {
  if (!m.pdf) return { role: m.role, content: m.content };
  return {
    role: "user",
    content: [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: m.pdf.data },
        title: m.pdf.name.slice(0, 200),
        cache_control: { type: "ephemeral" },
      },
      { type: "text", text: m.content || "Please read this document." },
    ],
  };
}

// ---- Web search ----------------------------------------------------------------
// Only agents with `webSearch: true` in src/agents.js get this. Searches are
// capped so one answer can't take too long or cost too much.
const WEB_SEARCH_TOOL = {
  // The basic version: searches directly. (The newer "dynamic filtering"
  // version runs extra code per search, which was slower and less reliable.)
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 3,
  user_location: {
    type: "approximate",
    city: "Sydney",
    region: "New South Wales",
    country: "AU",
    timezone: "Australia/Sydney",
  },
};
const CONTINUE_WITHIN_MS = 35000;

function webSearchRules() {
  const today = new Date().toLocaleDateString("en-AU", {
    dateStyle: "long",
    timeZone: "Australia/Sydney",
  });
  return [
    `Today is ${today}.`,
    "You can search the web. Use it for anything current or specific: tenders, DAs, companies, people, prices, rankings.",
    "Brandboy works in Australia, mainly NSW and Sydney. Search for Australian results (put NSW, Sydney or Australia in your searches), prefer .gov.au and .com.au sources, and leave out overseas results unless Lars asks for them.",
    "Use at most 3 searches, and keep the answer short enough to read on one screen.",
    "Never invent tenders, companies, names, phone numbers or emails. If you can't find something, say so plainly.",
  ].join(" ");
}

// Turns the web pages Claude quoted into a "Sources" list of links, so Lars can
// check where each fact came from.
function sourcesList(textBlocks) {
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

export const config = {
  path: "/api/ask-agent",
};
