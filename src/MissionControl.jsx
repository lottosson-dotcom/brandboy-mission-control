import { useState, useEffect, useRef } from "react";
// Memory and Activity Log are switched off until login is added (docs/PLAN.md, phase 2).
const saveMemory = async () => {};
const ActivityLog = () => (
  <div style={{ padding: "24px", color: "#888", fontSize: "14px" }}>
    📡 Activity Log — coming soon.
  </div>
);
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
  muted: "#888",
  faint: "#333",
};
import { AGENTS, QUICK_TASKS } from "./agents.js";
// The passcode is asked for once and remembered in this browser.
// Cancel = nothing is saved and nothing is sent. A wrong passcode is forgotten
// straight away so the next message asks again.
const PASSCODE_KEY = "mc-passcode";
function readSavedPasscode() {
  try {
    return localStorage.getItem(PASSCODE_KEY) || "";
  } catch {
    return "";
  }
}
function savePasscode(code) {
  try {
    if (code) localStorage.setItem(PASSCODE_KEY, code);
    else localStorage.removeItem(PASSCODE_KEY);
  } catch {}
}
function askForPasscode(message) {
  const typed = (window.prompt(message) || "").trim();
  savePasscode(typed);
  return typed;
}
async function askAgent(agent, messages, isRetry = false) {
  const code =
    (!isRetry && readSavedPasscode()) ||
    askForPasscode(
      isRetry
        ? "That passcode didn't work. Paste the Mission Control passcode again:"
        : "Enter the Mission Control passcode",
    );
  if (!code) throw new Error("No passcode entered. Send the message again to try.");
  const res = await fetch("/api/ask-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-app-passcode": code },
    body: JSON.stringify({ agentId: agent.id, messages }),
  });
  if (res.status === 401) {
    savePasscode("");
    if (!isRetry) return askAgent(agent, messages, true);
    throw new Error("Wrong passcode. Send the message again to try another one.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data.text;
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
          <div style={{ fontSize: 10, color: "#888" }}>{agent.title}</div>
        </div>
        <StatusPill status={agent.status} color={agent.color} />
      </div>
      <div style={{ fontSize: 11, color: "#888", lineHeight: 1.5 }}>{agent.description}</div>
      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
        {agent.capabilities.map((c) => (
          <span
            key={c}
            style={{
              fontSize: 9,
              background: "#333",
              color: "#888",
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
          fontSize: 13,
          color: "#F0F0F0",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
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
        {msg.content}
        {msg.pending && (
          <span style={{ display: "inline-flex", gap: 3, marginLeft: 6 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#888",
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
        color: "#888",
        borderRadius: 6,
        padding: "6px 12px",
        fontSize: 11,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        e.target.style.borderColor = "#FF6B2B";
        e.target.style.color = "#FF6B2B";
      }}
      onMouseLeave={(e) => {
        e.target.style.borderColor = "#2A2A2A";
        e.target.style.color = "#888";
      }}
    >
      {label}
    </button>
  );
}
export default function MissionControl() {
  const [activeAgent, setActiveAgent] = useState(AGENTS[0]);
  const [conversations, setConversations] = useState(() =>
    Object.fromEntries(AGENTS.map((a) => [a.id, []])),
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("chat");
  const [time, setTime] = useState(new Date());
  const chatEndRef = useRef(null);
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, loading]);
  const msgs = conversations[activeAgent.id] || [];
  async function send(text) {
    if (!text.trim() || loading) return;
    const userMsg = { role: "user", content: text };
    const newMsgs = [...msgs, userMsg];
    setConversations((c) => ({ ...c, [activeAgent.id]: newMsgs }));
    setInput("");
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
      const apiMsgs = newMsgs.map((m) => ({ role: m.role, content: m.content }));
      const reply = await askAgent(activeAgent, apiMsgs);
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
      setConversations((c) => {
        const cur = c[activeAgent.id].filter((m) => !m.pending);
        return {
          ...c,
          [activeAgent.id]: [
            ...cur,
            {
              role: "assistant",
              content: `⚠️ Error: ${err.message}`,
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
        minHeight: "100vh",
        background: "#0A0A0A",
        color: "#F0F0F0",
        fontFamily: "'Inter',system-ui,sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`*{box-sizing:border-box;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#141414;}::-webkit-scrollbar-thumb{background:#333;border-radius:2px;}@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8);}50%{opacity:1;transform:scale(1.1);}}textarea:focus{outline:none;}button:active{transform:scale(0.97);}`}</style>
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
            <div style={{ fontSize: 10, color: "#888", letterSpacing: 1 }}>
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
          <div style={{ fontSize: 12, color: "#888" }}>
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
          ["activity", "📡 Activity Log"],
        ].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              background: "none",
              border: "none",
              borderBottom: view === v ? "2px solid #FF6B2B" : "2px solid transparent",
              color: view === v ? "#FF6B2B" : "#888",
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
              color: "#888",
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
              <div style={{ fontSize: 10, color: "#888" }}>Commander · Brandboy</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {activeAgent.title} · {activeAgent.focus}
                  </div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <StatusPill status="● ONLINE 24/7" color={activeAgent.color} />
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
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
                        color: "#888",
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
                <div ref={chatEndRef} />
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
              <div
                style={{
                  background: "#1A1A1A",
                  borderTop: "1px solid #2A2A2A",
                  padding: "12px 20px",
                  display: "flex",
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder={`Give ${activeAgent.name} a task…`}
                  style={{
                    flex: 1,
                    background: "#141414",
                    border: "1px solid #2A2A2A",
                    borderRadius: 10,
                    color: "#F0F0F0",
                    fontSize: 13,
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
                  disabled={loading || !input.trim()}
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
                <div style={{ fontSize: 13, color: "#888" }}>
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
                        <div style={{ fontSize: 12, color: "#888" }}>{a.title}</div>
                      </div>
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#F0F0F0", lineHeight: 1.6, marginBottom: 14 }}
                    >
                      {a.description}
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{ fontSize: 10, color: "#888", letterSpacing: 1, marginBottom: 6 }}
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
                <div style={{ fontSize: 13, color: "#888" }}>
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
                          color: "#888",
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
          {view === "activity" && (
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <ActivityLog />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
