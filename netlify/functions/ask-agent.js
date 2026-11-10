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
// PDFs: Netlify accepts requests up to about 6 MB, and a PDF grows by a third
// when sent from the browser, so the website keeps each PDF under 4 MB.
const MAX_PDFS = 2;
const MAX_PDF_CHARACTERS = 5_600_000;

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

  // A web search can make Claude "pause" part-way; we let it carry on, but only
  // while there's time left before Netlify's time limit.
  const startedAt = Date.now();
  const content = [];
  let data;
  for (;;) {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(request),
    });
    data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      console.error("Anthropic error", anthropicRes.status, data);
      return reply(502, {
        error: data?.error?.message || "Claude returned an error",
      });
    }
    content.push(...(data.content || []));
    if (data.stop_reason !== "pause_turn" || Date.now() - startedAt > CONTINUE_WITHIN_MS) break;
    request.messages = [...originalMessages, { role: "assistant", content }];
  }

  if (data.stop_reason === "refusal") {
    return reply(502, { error: "The agent declined that request. Try rephrasing it." });
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
    console.error("Empty answer", data.stop_reason, data.usage);
    return reply(502, {
      error: "The agent didn't manage an answer that time. Press Send to retry.",
    });
  }
  if (data.stop_reason === "max_tokens" || data.stop_reason === "pause_turn") {
    text += "\n\n_(Answer cut short. Ask me to continue.)_";
  }
  text += sourcesList(textBlocks);
  return reply(200, { text });
};

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
const CONTINUE_WITHIN_MS = 15000;

function webSearchRules() {
  const today = new Date().toLocaleDateString("en-AU", {
    dateStyle: "long",
    timeZone: "Australia/Sydney",
  });
  return [
    `Today is ${today}.`,
    "You can search the web. Use it for anything current or specific: tenders, DAs, companies, people, prices, rankings.",
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
