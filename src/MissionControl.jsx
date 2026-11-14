import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PdfChip } from "./components/PdfAttach.jsx";
import { readPdf } from "./lib/pdf.js";
import { accessHeaders, accessRefused, loginEnabled, logOut } from "./lib/auth.js";
import ActivityLog from "./components/ActivityLog.jsx";
import DailyTasks from "./components/DailyTasks.jsx";
import Contacts from "./components/Contacts.jsx";
import Inbox from "./components/Inbox.jsx";
// Agent memory is switched off until login is added (docs/PLAN.md, phase 2).
const saveMemory = async () => {};
const C = {
  black: "#0A0A0A",
  charcoal: "#141414",
  panel: "#1A1A1A",
  border: "#2A2A2A",
  accent: "#FF6B2B",
  accentD: "#CC5520",
  accentG: "linear-gradient(135deg,#FF6B2B,#FF9A5C)",
  gold: "#F5A623",
  green: "#22C55E",
  red: "#EF4444",
  blue: "#3B82F6",
  purple: "#A855F7",
  teal: "#14B8A6",
  cyan: "#06B6D4",
  text: "#F0F0F0",
  muted: "#A3A3A3",
  faint: "#333",
};
import { AGENTS, QUICK_TASKS } from "./agents.js";
// onProgress(textSoFar) is called while the answer streams in, so the chat can
// show the words as they're written. Returns the final, complete answer.
async function askAgent(agent, messages, onProgress, isRetry = false) {
  const access = await accessHeaders(isRetry);
  const res = await fetch("/api/ask-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...access },
    body: JSON.stringify({ agentId: agent.id, messages }),
  });
  if (res.status === 401 || res.status === 403) {
    if ((await accessRefused()) && !isRetry) return askAgent(agent, messages, onProgress, true);
    throw new Error("Not allowed in. Your message is back in the box: log in and press Send.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  // The answer arrives as one JSON line per event (see ask-agent.js).
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let soFar = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type === "text") {
        soFar += event.text;
        onProgress(soFar);
      } else if (event.type === "searching") {
        soFar = "";
        onProgress("🔎 _Searching the web…_");
      } else if (event.type === "done") {
        return event.text;
      } else if (event.type === "error") {
        throw new Error(event.error);
      }
    }
  }
  throw new Error("The answer stopped part-way. Press Send to retry.");
}
// ---- Saved chats ----------------------------------------------------------
// Chats are kept in this browser only (not on a server), so they survive a
// refresh. "New chat" clears one agent's chat.
const CHATS_KEY = "mc-chats";
function loadChats() {
  const empty = Object.fromEntries(AGENTS.map((a) => [a.id, []]));
  try {
    const saved = JSON.parse(localStorage.getItem(CHATS_KEY) || "{}");
    for (const id of Object.keys(empty)) {
      if (Array.isArray(saved[id])) empty[id] = saved[id].filter((m) => !m.pending);
    }
  } catch {}
  return empty;
}
function saveChats(conversations) {
  try {
    const clean = Object.fromEntries(
      Object.entries(conversations).map(([id, list]) => [
        id,
        list
          .filter((m) => !m.pending)
          // PDFs are too big to keep in the browser: save only the file name.
          .map((m) => (m.pdf ? { ...m, pdf: { name: m.pdf.name, size: m.pdf.size } } : m)),
      ]),
    );
    localStorage.setItem(CHATS_KEY, JSON.stringify(clean));
  } catch {}
}
// The server only accepts a limited amount of history (see ask-agent.js), so
// long chats send just the most recent part. The first message must be Lars's.
const HISTORY_MESSAGES = 30;
const HISTORY_CHARACTERS = 50000;
function recentHistory(messages) {
  let recent = messages.slice(-HISTORY_MESSAGES);
  const size = (list) => list.reduce((n, m) => n + m.content.length, 0);
  while (recent.length > 1 && size(recent) > HISTORY_CHARACTERS) recent = recent.slice(1);
  while (recent.length > 1 && recent[0].role !== "user") recent = recent.slice(1);
  return recent;
}
// Turns chat messages into what the server expects. Only the 2 most recent PDFs
// are sent along; older ones (or ones lost on a refresh) become a short note.
function toServerMessages(messages) {
  const withData = messages.filter((m) => m.pdf?.data);
  const keep = new Set(withData.slice(-2));
  return messages.map((m) => {
    const out = { role: m.role, content: m.content };
    if (!m.pdf) return out;
    if (keep.has(m)) return { ...out, pdf: { name: m.pdf.name, data: m.pdf.data } };
    return {
      ...out,
      content: `[Lars attached "${m.pdf.name}" earlier, but it is no longer available. If you need it, ask him to attach it again.]\n\n${m.content}`,
    };
  });
}
function StatusPill({ status, color }) {
  return (
    <span
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 8px",
        letterSpacing: 1,
      }}
    >
      {status}
    </span>
  );
}
function AgentCard({ agent, onClick, active }) {
  return (
    <div
      onClick={() => onClick(agent)}
      style={{
        background: active ? agent.color + "15" : "#1A1A1A",
        border: `1px solid ${active ? agent.color : "#2A2A2A"}`,
        borderRadius: 10,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all 0.2s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {active && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: agent.color,
          }}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>{agent.emoji}</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, color: agent.color, letterSpacing: 1 }}>
            {agent.name}
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>{agent.title}</div>
        </div>
        <StatusPill status={agent.status} color={agent.color} />
      </div>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{agent.description}</div>
      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
        {agent.capabilities.map((c) => (
          <span
            key={c}
            style={{
              fontSize: 10,
              background: "#333",
              color: C.muted,
              borderRadius: 3,
              padding: "2px 6px",
            }}
          >
            {c}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: agent.color + "99" }}>
        Focus: {agent.focus}
      </div>
    </div>
  );
}
function ChatBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 12,
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: msg.agentColor + "22",
            border: `1px solid ${msg.agentColor}44`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            marginRight: 8,
            flexShrink: 0,
          }}
        >
          {msg.agentEmoji}
        </div>
      )}
      <div
        style={{
          maxWidth: "75%",
          background: isUser ? "#FF6B2B" : "#1A1A1A",
          border: `1px solid ${isUser ? "#CC5520" : "#2A2A2A"}`,
          borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          padding: "10px 14px",
          fontSize: 14,
          color: "#F0F0F0",
          lineHeight: 1.6,
          whiteSpace: isUser ? "pre-wrap" : "normal",
        }}
      >
        {!isUser && (
          <div
            style={{
              fontSize: 10,
              color: msg.agentColor,
              fontWeight: 700,
              marginBottom: 4,
              letterSpacing: 1,
            }}
          >
            {msg.agentName}
          </div>
        )}
        {isUser ? (
          <>
            {msg.pdf && (
              <div style={{ marginBottom: msg.content ? 6 : 0 }}>
                <PdfChip pdf={msg.pdf} />
              </div>
            )}
            {msg.content}
          </>
        ) : (
          // Agents answer in Markdown (headings, bullets, tables). This turns it
          // into proper formatting instead of showing stray # and * symbols.
          <div className="mc-md">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        )}
        {msg.pending && (
          <span style={{ display: "inline-flex", gap: 3, marginLeft: 6 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: C.muted,
                  animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
                }}
              />
            ))}
          </span>
        )}
      </div>
      {isUser && (
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "#FF6B2B22",
            border: "1px solid #CC5520",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 800,
            color: "#FF6B2B",
            marginLeft: 8,
            flexShrink: 0,
          }}
        >
          L
        </div>
      )}
    </div>
  );
}
function QuickTaskButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "#333",
        border: "1px solid #2A2A2A",
        color: C.muted,
        borderRadius: 6,
        padding: "6px 12px",
        fontSize: 12,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        e.target.style.borderColor = "#FF6B2B";
        e.target.style.color = "#FF6B2B";
      }}
      onMouseLeave={(e) => {
        e.target.style.borderColor = "#2A2A2A";
        e.target.style.color = C.muted;
      }}
    >
      {label}
    </button>
  );
}
export default function MissionControl() {
  const [activeAgent, setActiveAgent] = useState(AGENTS[0]);
  const [conversations, setConversations] = useState(loadChats);
  const [input, setInput] = useState("");
  const [pdf, setPdf] = useState(null); // PDF waiting to be sent with the next message
  const [pdfProblem, setPdfProblem] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  // Coming back from Google's "Connect Gmail" screen (?gmail=connected etc.):
  // open the Inbox tab and show what happened, then tidy the address bar.
  const [gmailResult, setGmailResult] = useState(() =>
    new URLSearchParams(window.location.search).get("gmail"),
  );
  const [view, setView] = useState(gmailResult ? "inbox" : "chat");
  useEffect(() => {
    if (gmailResult) window.history.replaceState(null, "", window.location.pathname);
  }, [gmailResult]);
  const [time, setTime] = useState(new Date());
  const chatScrollRef = useRef(null);
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  // Keep the chats in this browser so a refresh doesn't wipe them.
  useEffect(() => saveChats(conversations), [conversations]);
  // Scroll only the chat panel to the newest message (not the whole page,
  // which used to make the page jump when it first opened).
  useEffect(() => {
    const box = chatScrollRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [conversations, loading, activeAgent.id, view]);
  const msgs = conversations[activeAgent.id] || [];
  function newChat() {
    if (msgs.length && !window.confirm(`Start a new chat with ${activeAgent.name}?`)) return;
    setConversations((c) => ({ ...c, [activeAgent.id]: [] }));
  }
  async function attachPdf(file) {
    const { pdf: read, problem } = await readPdf(file);
    setPdfProblem(problem || "");
    if (read) setPdf(read);
  }
  async function send(text) {
    if ((!text.trim() && !pdf) || loading) return;
    const userMsg = {
      role: "user",
      content: text.trim()
        ? text
        : "Summarise this document and point out anything important for Brandboy.",
      ...(pdf && { pdf }),
    };
    const newMsgs = [...msgs, userMsg];
    setConversations((c) => ({ ...c, [activeAgent.id]: newMsgs }));
    setInput("");
    setPdf(null);
    setPdfProblem("");
    setLoading(true);
    setConversations((c) => ({
      ...c,
      [activeAgent.id]: [
        ...newMsgs,
        {
          role: "assistant",
          content: "",
          pending: true,
          agentName: activeAgent.name,
          agentColor: activeAgent.color,
          agentEmoji: activeAgent.emoji,
        },
      ],
    }));
    try {
      // Error notes are only for Lars to see; they are never sent to the AI.
      const apiMsgs = toServerMessages(recentHistory(newMsgs.filter((m) => !m.error)));
      // Fill in the reply bubble as the words arrive.
      const showProgress = (partial) =>
        setConversations((c) => ({
          ...c,
          [activeAgent.id]: c[activeAgent.id].map((m) =>
            m.pending ? { ...m, content: partial } : m,
          ),
        }));
      const reply = await askAgent(activeAgent, apiMsgs, showProgress);
      await saveMemory(activeAgent.name, "task", `User: ${text}\n\n${activeAgent.name}: ${reply}`, [
        activeAgent.focus,
        activeAgent.id,
      ]);
      setConversations((c) => {
        const cur = c[activeAgent.id].filter((m) => !m.pending);
        return {
          ...c,
          [activeAgent.id]: [
            ...cur,
            {
              role: "assistant",
              content: reply,
              agentName: activeAgent.name,
              agentColor: activeAgent.color,
              agentEmoji: activeAgent.emoji,
            },
          ],
        };
      });
    } catch (err) {
      // The message didn't go through: take it out of the chat and put it back
      // in the text box, so pressing Send tries again without retyping.
      setInput(text);
      if (userMsg.pdf) setPdf(userMsg.pdf);
      setConversations((c) => {
        const cur = c[activeAgent.id].filter((m) => !m.pending && m !== userMsg);
        return {
          ...c,
          [activeAgent.id]: [
            ...cur,
            {
              role: "assistant",
              error: true,
              content: `⚠️ ${err.message}`,
              agentName: activeAgent.name,
              agentColor: activeAgent.color,
              agentEmoji: activeAgent.emoji,
            },
          ],
        };
      });
    }
    setLoading(false);
  }
  const quickTasks = QUICK_TASKS[activeAgent.id] || [];
  return (
    <div
      style={{
        height: "100vh",
        background: "#0A0A0A",
        color: "#F0F0F0",
        fontFamily: "'Inter',system-ui,sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`*{box-sizing:border-box;}body{margin:0;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#141414;}::-webkit-scrollbar-thumb{background:#333;border-radius:2px;}@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8);}50%{opacity:1;transform:scale(1.1);}}textarea:focus{outline:none;}button:active{transform:scale(0.97);}
.mc-md>*:first-child{margin-top:0;}.mc-md>*:last-child{margin-bottom:0;}
.mc-md p{margin:0 0 10px;}.mc-md ul,.mc-md ol{margin:0 0 10px;padding-left:22px;}.mc-md li{margin-bottom:4px;}
.mc-md h1,.mc-md h2,.mc-md h3,.mc-md h4{margin:14px 0 6px;line-height:1.3;color:#fff;}.mc-md h1{font-size:18px;}.mc-md h2{font-size:16px;}.mc-md h3,.mc-md h4{font-size:15px;}
.mc-md strong{color:#fff;}.mc-md a{color:#FF9A5C;}.mc-md hr{border:none;border-top:1px solid #2A2A2A;margin:12px 0;}
.mc-md code{background:#0A0A0A;border-radius:4px;padding:1px 5px;font-size:13px;}.mc-md pre{background:#0A0A0A;border-radius:6px;padding:10px;overflow-x:auto;}.mc-md pre code{padding:0;}
.mc-md blockquote{border-left:3px solid #FF6B2B;margin:0 0 10px;padding-left:10px;color:#A3A3A3;}
.mc-md table{border-collapse:collapse;margin:0 0 10px;font-size:13px;display:block;overflow-x:auto;}.mc-md th,.mc-md td{border:1px solid #2A2A2A;padding:5px 9px;text-align:left;vertical-align:top;}.mc-md th{background:#141414;color:#fff;}`}</style>
      <div
        style={{
          background: "#141414",
          borderBottom: "1px solid #2A2A2A",
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              background: "linear-gradient(135deg,#FF6B2B,#FF9A5C)",
              borderRadius: 8,
              padding: "4px 12px",
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: 1,
            }}
          >
            BB
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.5 }}>
              BRANDBOY MISSION CONTROL
            </div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1 }}>
              AI AGENT COMMAND CENTRE · SYDNEY AU
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#22C55E",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            <span style={{ fontSize: 11, color: "#22C55E", fontWeight: 700 }}>
              {AGENTS.length} AGENTS LIVE
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            {time.toLocaleTimeString("en-AU", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        </div>
      </div>
      <div
        style={{
          background: "#141414",
          borderBottom: "1px solid #2A2A2A",
          padding: "0 24px",
          display: "flex",
          gap: 0,
          flexShrink: 0,
        }}
      >
        {[
          ["chat", "💬 Talk to Agent"],
          ["agents", "🤖 All Agents"],
          ["strategy", "📋 Strategy"],
          ["inbox", "📥 Inbox"],
          ["contacts", "👥 Contacts"],
          ["tasks", "🕕 Daily Tasks"],
          ["activity", "📡 Activity Log"],
        ].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              background: "none",
              border: "none",
              borderBottom: view === v ? "2px solid #FF6B2B" : "2px solid transparent",
              color: view === v ? "#FF6B2B" : C.muted,
              padding: "10px 20px",
              fontSize: 12,
              fontWeight: view === v ? 700 : 400,
              cursor: "pointer",
              letterSpacing: 0.5,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div
          style={{
            width: 260,
            background: "#141414",
            borderRight: "1px solid #2A2A2A",
            padding: "16px 12px",
            overflowY: "auto",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              letterSpacing: 1,
              padding: "0 4px",
              marginBottom: 4,
            }}
          >
            SELECT AGENT
          </div>
          {AGENTS.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              onClick={(ag) => {
                setActiveAgent(ag);
                setView("chat");
              }}
              active={activeAgent.id === a.id}
            />
          ))}
          <div
            style={{
              marginTop: "auto",
              background: "#1A1A1A",
              border: "1px solid #2A2A2A",
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#FF6B2B,#FF9A5C)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 14,
              }}
            >
              L
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12 }}>Lars</div>
              <div style={{ fontSize: 10, color: C.muted }}>Commander · Brandboy</div>
            </div>
            {loginEnabled && (
              <button
                onClick={logOut}
                title="Log out of Mission Control on this device"
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.muted,
                  fontSize: 11,
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                Log out
              </button>
            )}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
          // Drag a PDF anywhere onto the chat to attach it.
          onDragOver={(e) => {
            if (view !== "chat" || !e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
          }}
          onDrop={(e) => {
            if (view !== "chat") return;
            e.preventDefault();
            setDragging(false);
            attachPdf(e.dataTransfer.files[0]);
          }}
        >
          {dragging && (
            <div
              style={{
                position: "absolute",
                inset: 12,
                zIndex: 5,
                border: `2px dashed ${C.accent}`,
                borderRadius: 12,
                background: "#0A0A0ADD",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 700,
                color: C.accent,
                pointerEvents: "none",
              }}
            >
              📄 Drop the PDF to attach it for {activeAgent.name}
            </div>
          )}
          {view === "chat" && (
            <>
              <div
                style={{
                  background: "#1A1A1A",
                  borderBottom: "1px solid #2A2A2A",
                  padding: "12px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: activeAgent.color + "22",
                    border: `1px solid ${activeAgent.color}44`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                  }}
                >
                  {activeAgent.emoji}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: activeAgent.color }}>
                    {activeAgent.name}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    {activeAgent.title} · {activeAgent.focus}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                  {msgs.length > 0 && (
                    <button
                      onClick={newChat}
                      disabled={loading}
                      style={{
                        background: C.faint,
                        border: `1px solid ${C.border}`,
                        color: C.text,
                        borderRadius: 6,
                        padding: "5px 12px",
                        fontSize: 12,
                        cursor: loading ? "not-allowed" : "pointer",
                      }}
                    >
                      ＋ New chat
                    </button>
                  )}
                  <StatusPill status="● ONLINE 24/7" color={activeAgent.color} />
                </div>
              </div>
              <div ref={chatScrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                {msgs.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>{activeAgent.emoji}</div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 16,
                        color: activeAgent.color,
                        marginBottom: 6,
                      }}
                    >
                      {activeAgent.name} is ready
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: C.muted,
                        maxWidth: 400,
                        margin: "0 auto",
                        lineHeight: 1.6,
                      }}
                    >
                      {activeAgent.description}
                    </div>
                    <div
                      style={{
                        marginTop: 24,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        justifyContent: "center",
                      }}
                    >
                      {quickTasks.map((t) => (
                        <QuickTaskButton key={t} label={t} onClick={() => send(t)} />
                      ))}
                    </div>
                  </div>
                )}
                {msgs.map((msg, i) => (
                  <ChatBubble key={i} msg={msg} />
                ))}
              </div>
              {msgs.length > 0 && (
                <div
                  style={{
                    padding: "8px 20px",
                    background: "#1A1A1A",
                    borderTop: "1px solid #2A2A2A",
                    display: "flex",
                    gap: 8,
                    overflowX: "auto",
                    flexShrink: 0,
                  }}
                >
                  {quickTasks.slice(0, 3).map((t) => (
                    <QuickTaskButton key={t} label={t} onClick={() => send(t)} />
                  ))}
                </div>
              )}
              {(pdf || pdfProblem) && (
                <div
                  style={{
                    background: "#1A1A1A",
                    borderTop: "1px solid #2A2A2A",
                    padding: "8px 20px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexShrink: 0,
                    fontSize: 12,
                  }}
                >
                  {pdf && <PdfChip pdf={pdf} onRemove={() => setPdf(null)} />}
                  {pdfProblem && <span style={{ color: C.red }}>⚠️ {pdfProblem}</span>}
                </div>
              )}
              <div
                style={{
                  background: "#1A1A1A",
                  borderTop: pdf || pdfProblem ? "none" : "1px solid #2A2A2A",
                  padding: "12px 20px",
                  display: "flex",
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    attachPdf(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  title="Attach a PDF (or drag one onto the chat)"
                  style={{
                    background: "#141414",
                    border: "1px solid #2A2A2A",
                    borderRadius: 10,
                    color: C.text,
                    fontSize: 18,
                    width: 44,
                    cursor: loading ? "not-allowed" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  📎
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder={
                    pdf
                      ? `Ask ${activeAgent.name} about this PDF (or just press Send for a summary)…`
                      : `Give ${activeAgent.name} a task… (📎 or drag in a PDF)`
                  }
                  style={{
                    flex: 1,
                    background: "#141414",
                    border: "1px solid #2A2A2A",
                    borderRadius: 10,
                    color: "#F0F0F0",
                    fontSize: 14,
                    padding: "10px 14px",
                    resize: "none",
                    minHeight: 44,
                    maxHeight: 120,
                    lineHeight: 1.5,
                    fontFamily: "inherit",
                  }}
                  rows={1}
                />
                <button
                  onClick={() => send(input)}
                  disabled={loading || (!input.trim() && !pdf)}
                  style={{
                    background: loading ? "#333" : "linear-gradient(135deg,#FF6B2B,#FF9A5C)",
                    border: "none",
                    borderRadius: 10,
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    padding: "0 20px",
                    cursor: loading ? "not-allowed" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  {loading ? "…" : "SEND ▶"}
                </button>
              </div>
            </>
          )}
          {view === "agents" && (
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>
                  Your AI Agent Team
                </div>
                <div style={{ fontSize: 13, color: C.muted }}>
                  {AGENTS.length} specialist agents working 24/7 across sales, marketing, BD, and
                  operations
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {AGENTS.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      background: "#1A1A1A",
                      border: `1px solid ${a.color}44`,
                      borderRadius: 12,
                      padding: 20,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        background: a.color,
                      }}
                    />
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          background: a.color + "22",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 24,
                        }}
                      >
                        {a.emoji}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: a.color }}>
                          {a.name}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted }}>{a.title}</div>
                      </div>
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#F0F0F0", lineHeight: 1.6, marginBottom: 14 }}
                    >
                      {a.description}
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 6 }}
                      >
                        CAPABILITIES
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {a.capabilities.map((c) => (
                          <span
                            key={c}
                            style={{
                              fontSize: 10,
                              background: a.color + "15",
                              color: a.color,
                              border: `1px solid ${a.color}33`,
                              borderRadius: 4,
                              padding: "2px 8px",
                            }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setActiveAgent(a);
                        setView("chat");
                      }}
                      style={{
                        background: a.color,
                        border: "none",
                        borderRadius: 8,
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 12,
                        padding: "8px 16px",
                        cursor: "pointer",
                        width: "100%",
                      }}
                    >
                      TALK TO {a.name} →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {view === "strategy" && (
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>
                  Brandboy AI Growth Strategy
                </div>
                <div style={{ fontSize: 13, color: C.muted }}>
                  Clear execution plan — what each agent does, when, and why
                </div>
              </div>
              {[
                {
                  phase: "WEEK 1-2",
                  title: "Intelligence Gathering",
                  agent: "SCOUT",
                  color: C.blue,
                  steps: [
                    "SCOUT maps 200+ prospects across retail, corporate, govt, and franchise",
                    "HUNTER scans all live tenders and DA approvals nationally",
                    "OPS builds a prospect CRM template and data backup protocol",
                    "Output: qualified prospect list with contact details and opportunity log",
                  ],
                },
                {
                  phase: "WEEK 3-4",
                  title: "Campaign Launch",
                  agent: "COMPOSER",
                  color: C.purple,
                  steps: [
                    "COMPOSER drafts personalised email sequences per industry vertical",
                    "Lars reviews and approves each campaign batch",
                    "team@brandboy.com.au sends approved emails in curated batches",
                    "SCOUT tracks opens, responses, and enriches respondent profiles",
                  ],
                },
                {
                  phase: "MONTH 2",
                  title: "Pipeline Building",
                  agent: "HUNTER",
                  color: C.green,
                  steps: [
                    "HUNTER flags new tenders and project opportunities weekly",
                    "COMPOSER drafts proposal cover letters and capability summaries",
                    "OPS tracks all active pipeline deals and flags stalled conversations",
                    "Lars approves submissions and agents prep all supporting materials",
                  ],
                },
                {
                  phase: "ONGOING",
                  title: "24/7 Automation",
                  agent: "OPS",
                  color: C.gold,
                  steps: [
                    "All agents run daily background tasks and reports delivered to Lars each morning",
                    "SCOUT refreshes prospect list weekly with new targets",
                    "COMPOSER queues follow-ups automatically after 5 business days",
                    "OPS maintains data integrity and flags any business risks",
                  ],
                },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    background: "#1A1A1A",
                    border: `1px solid ${s.color}33`,
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 16,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: 4,
                      background: s.color,
                    }}
                  />
                  <div style={{ paddingLeft: 12 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}
                    >
                      <span
                        style={{
                          background: s.color + "22",
                          color: s.color,
                          border: `1px solid ${s.color}44`,
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 10px",
                          letterSpacing: 1,
                        }}
                      >
                        {s.phase}
                      </span>
                      <span
                        style={{
                          background: "#333",
                          color: C.muted,
                          borderRadius: 4,
                          fontSize: 10,
                          padding: "2px 8px",
                        }}
                      >
                        Lead: {s.agent}
                      </span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>{s.title}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {s.steps.map((step, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: s.color + "22",
                              border: `1px solid ${s.color}44`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 800,
                              color: s.color,
                              flexShrink: 0,
                              marginTop: 1,
                            }}
                          >
                            {j + 1}
                          </div>
                          <div style={{ fontSize: 13, color: "#F0F0F0", lineHeight: 1.6 }}>
                            {step}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {view === "inbox" && (
            <Inbox result={gmailResult} onResultShown={() => setGmailResult(null)} />
          )}
          {view === "contacts" && <Contacts />}
          {view === "tasks" && <DailyTasks />}
          {view === "activity" && <ActivityLog />}
        </div>
      </div>
    </div>
  );
}
