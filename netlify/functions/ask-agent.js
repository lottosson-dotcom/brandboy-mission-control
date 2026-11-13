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
//   ANTHROPIC_MODEL     optional — defaults to DEFAULT_MODEL in netlify/lib/claude.js
// =============================================================================
import { AGENTS } from "../../src/agents.js";
import { reply, checkPasscode, logActivity } from "../lib/server.js";
import {
  buildRequest,
  callClaude,
  readClaudeStream,
  finalAnswer,
  shorten,
  CONTINUE_WITHIN_MS,
} from "../lib/claude.js";

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

  const request = buildRequest(agent, messages.map(toClaudeMessage), MAX_OUTPUT_TOKENS);
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

export const config = {
  path: "/api/ask-agent",
};
