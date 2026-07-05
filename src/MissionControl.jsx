import { useState, useEffect, useRef } from "react";
import { saveMemory, getMemories } from "./lib/agentMemory";
import ActivityLog from "./components/ActivityLog";
const C = {
  black:   "#0A0A0A",
  charcoal:"#141414",
  panel:   "#1A1A1A",
  border:  "#2A2A2A",
  accent:  "#FF6B2B",   // Brandboy orange
  accentD: "#CC5520",
  accentG: "linear-gradient(135deg,#FF6B2B,#FF9A5C)",
  gold:    "#F5A623",
  green:   "#22C55E",
  red:     "#EF4444",
  blue:    "#3B82F6",
  purple:  "#A855F7",
  teal:    "#14B8A6",
  cyan:    "#06B6D4",
  text:    "#F0F0F0",
  muted:   "#888",
  faint:   "#333",
};

// ── Agent definitions ─────────────────────────────────────────────────────────
const AGENTS = [
  {
    id: "scout",
    name: "SCOUT",
    title: "Lead Intelligence Agent",
    emoji: "🔍",
    color: C.blue,
    status: "ACTIVE",
    focus: "Sales & Marketing",
    description: "Researches and identifies new prospects across fit-out, signage, refurbishment, and construction sectors. Builds targeted contact lists with decision-maker details.",
    capabilities: ["Prospect research", "Contact discovery", "Industry scanning", "Competitor intel", "Market mapping"],
    systemPrompt: `You are SCOUT, Brandboy's Lead Intelligence Agent. Brandboy is an Australian commercial construction, fit-out, signage, and refurbishment company (brandboy.com.au). Your job is to help identify, research, and build targeted prospect lists across Australia. Focus on: retail chains needing refurbishment, corporates needing office fit-outs, businesses needing signage updates, property developers, and facility managers. Always provide structured output with company name, industry, location, estimated project value, key contact role, and why they're a good fit for Brandboy. Be specific, actionable, and business-focused.`,
  },
  {
    id: "writer",
    name: "COMPOSER",
    title: "Email & Outreach Agent",
    emoji: "✍️",
    color: C.purple,
    status: "ACTIVE",
    focus: "Sales & Marketing",
    description: "Drafts personalised outreach emails, follow-ups, and campaign sequences for Lars to approve before sending via team@brandboy.com.au.",
    capabilities: ["Email campaigns", "Follow-up sequences", "Proposal drafts", "LinkedIn outreach", "SMS scripts"],
    systemPrompt: `You are COMPOSER, Brandboy's Email & Outreach Agent. Brandboy is an Australian commercial construction, fit-out, signage, and refurbishment company. You write compelling, professional outreach emails to be sent from team@brandboy.com.au. Always write in a confident, professional but approachable Australian tone. Include: a compelling subject line, personalised opening referencing their business or industry, Brandboy's value proposition relevant to them, a clear call-to-action, and a professional sign-off. Keep emails concise (under 200 words). Await Lars's approval before flagging as ready to send. When asked, generate email sequences (initial + 2 follow-ups).`,
  },
  {
    id: "hunter",
    name: "HUNTER",
    title: "Project Opportunity Agent",
    emoji: "🎯",
    color: C.green,
    status: "ACTIVE",
    focus: "Business Development",
    description: "Scans for live tenders, government contracts, DA approvals, and project opportunities across all Brandboy service lines Australia-wide.",
    capabilities: ["Tender alerts", "DA tracking", "Govt contracts", "Retail pipeline", "Property intel"],
    systemPrompt: `You are HUNTER, Brandboy's Project Opportunity Agent. Brandboy is an Australian commercial construction, fit-out, signage, and refurbishment company operating nationally. Your job is to identify active project opportunities including: government tenders, council DA approvals for commercial builds, retail chain expansion announcements, corporate relocation news, and franchise network refurbishment cycles. Provide: project name, location, opportunity type, estimated value, timing window, how Brandboy can win it, and suggested first action. Prioritise NSW, QLD, VIC, ACT and WA. Flag high-value opportunities (>$500K) as PRIORITY.`,
  },
  {
    id: "ops",
    name: "OPS",
    title: "Operations & Backup Agent",
    emoji: "⚙️",
    color: C.gold,
    status: "ACTIVE",
    focus: "Operations",
    description: "Manages internal processes, client follow-ups, supplier coordination, job costing support, and backs up critical business data and decisions.",
    capabilities: ["Process automation", "Data backup logs", "Supplier comms", "Job tracking", "Risk flags"],
    systemPrompt: `You are OPS, Brandboy's Operations & Backup Agent. Brandboy is an Australian commercial construction, fit-out, signage, and refurbishment company. Your job is to support smooth operations including: tracking active jobs, flagging overdue client responses, drafting supplier communications, maintaining process checklists, and logging important decisions and data. Always think about efficiency, risk mitigation, and protecting Brandboy's business interests. Provide structured, actionable outputs. Flag any operational risks immediately. Help Lars stay across all moving parts of the business.`,
  },
  {
    id: "seo",
    name: "RANKR",
    title: "SEO & Digital Visibility Agent",
    emoji: "📈",
    color: C.teal,
    status: "ACTIVE",
    focus: "Marketing & Digital",
    description: "Owns brandboy.com.au's organic search performance. Audits pages, identifies keyword opportunities, writes optimised content, and builds Brandboy's authority in commercial fit-out and signage searches nationally.",
    capabilities: ["Keyword research", "Page audits", "Content briefs", "Meta optimisation", "Local SEO", "Blog strategy", "Backlink intel"],
    systemPrompt: `You are RANKR, Brandboy's SEO & Digital Visibility Agent. Brandboy is an Australian commercial construction, fit-out, signage, and refurbishment company at brandboy.com.au. Your job is to maximise Brandboy's organic search visibility across Google Australia. Focus areas: (1) Keyword research — identify high-intent keywords like "office fit-out Sydney", "retail signage Australia", "commercial refurbishment NSW", long-tail variations, and competitor gaps. (2) Page audits — analyse title tags, meta descriptions, heading structure, internal linking, page speed issues, and content gaps on brandboy.com.au. (3) Content creation — write SEO-optimised blog posts, service page copy, and location pages that rank and convert. (4) Local SEO — optimise for Google Business Profile, local citations, and suburb/city-level searches. (5) Backlink strategy — identify DA-building opportunities via industry directories, construction associations, and PR. Always produce structured, actionable outputs with priority scores. Format content in ready-to-publish format when writing copy.`,
  },
  {
    id: "crm",
    name: "NEXUS",
    title: "CRM & Pipeline Agent",
    emoji: "🗂️",
    color: C.cyan,
    status: "ACTIVE",
    focus: "Sales Operations",
    description: "Manages Brandboy's entire client and prospect pipeline. Tracks lead status, flags stalled deals, segments contacts by service type and value, and ensures no opportunity is ever dropped.",
    capabilities: ["Pipeline tracking", "Lead scoring", "Contact segmentation", "Deal stage mgmt", "Follow-up alerts", "Win/loss analysis", "Client retention"],
    systemPrompt: `You are NEXUS, Brandboy's CRM & Pipeline Management Agent. Brandboy is an Australian commercial construction, fit-out, signage, and refurbishment company. Your job is to manage the full client and prospect lifecycle. You help with: (1) Pipeline management — organise leads by stage (New → Contacted → Qualified → Proposal → Negotiation → Won/Lost), flag stalled deals over 7 days with no activity. (2) Lead scoring — score prospects 1–10 based on: project size, timeline urgency, decision-maker access, industry fit, and geographic priority. (3) Contact segmentation — group contacts by service line (fit-out, signage, refurbishment, construction), geography, and deal value. (4) Follow-up scheduling — recommend next actions and timing for every active prospect. (5) Reporting — produce weekly pipeline summaries with conversion rates, deal values, and priority actions for Lars. (6) Client retention — flag existing clients due for re-engagement, upsell, or maintenance work. Always output in structured tables or lists. Be precise about deal values and timing. Help Lars never lose track of a lead.`,
  },
  { id: "forge", name: "FORGE", title: "AI Developer Agent", emoji: "🔧", color: "#F97316", status: "ACTIVE", focus: "Technology & Build", description: "Brandboy's in-house AI developer. Builds, fixes, and ships code for Mission Control and all Brandboy digital tools.", capabilities: ["React development", "Bug fixing", "Feature builds", "API integration", "Claude Code", "Code review", "Deployment"], systemPrompt: "You are FORGE, Brandboy's AI Developer Agent. Brandboy is an Australian commercial construction, fit-out, signage, and refurbishment company. You build and maintain Mission Control. You write clean React code, fix bugs, and ship working solutions fast." },
];

// ── Utility: call Claude API ──────────────────────────────────────────────────
async function askAgent(agent, messages) {
  const res = await fetch("/api/ask-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemPrompt: agent.systemPrompt,
      messages,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || data.error);
  return data.content.map(b => b.text || "").join("");
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function StatusPill({ status, color }) {
  return (
    <span style={{
      background: color + "22",
      color,
      border: `1px solid ${color}44`,
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 700,
      padding: "2px 8px",
      letterSpacing: 1,
    }}>{status}</span>
  );
}

function AgentCard({ agent, onClick, active }) {
  return (
    <div onClick={() => onClick(agent)} style={{
      background: active ? agent.color + "15" : C.panel,
      border: `1px solid ${active ? agent.color : C.border}`,
      borderRadius: 10,
      padding: "14px 16px",
      cursor: "pointer",
      transition: "all 0.2s",
      position: "relative",
      overflow: "hidden",
    }}>
      {active && <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: agent.color,
      }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>{agent.emoji}</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, color: agent.color, letterSpacing: 1 }}>{agent.name}</div>
          <div style={{ fontSize: 10, color: C.muted }}>{agent.title}</div>
        </div>
        <StatusPill status={agent.status} color={agent.color} />
      </div>
      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{agent.description}</div>
      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
        {agent.capabilities.map(c => (
          <span key={c} style={{
            fontSize: 9, background: C.faint, color: C.muted,
            borderRadius: 3, padding: "2px 6px", letterSpacing: 0.5,
          }}>{c}</span>
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
    <div style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 12,
    }}>
      {!isUser && (
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: msg.agentColor + "22",
          border: `1px solid ${msg.agentColor}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, marginRight: 8, flexShrink: 0,
        }}>{msg.agentEmoji}</div>
      )}
      <div style={{
        maxWidth: "75%",
        background: isUser ? C.accent : C.panel,
        border: `1px solid ${isUser ? C.accentD : C.border}`,
        borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        padding: "10px 14px",
        fontSize: 13,
        color: C.text,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
      }}>
        {!isUser && (
          <div style={{ fontSize: 10, color: msg.agentColor, fontWeight: 700, marginBottom: 4, letterSpacing: 1 }}>
            {msg.agentName}
          </div>
        )}
        {msg.content}
        {msg.pending && (
          <span style={{ display: "inline-flex", gap: 3, marginLeft: 6 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{
                width: 5, height: 5, borderRadius: "50%",
                background: C.muted,
                animation: `pulse 1.2s ${i*0.2}s ease-in-out infinite`,
              }} />
            ))}
          </span>
        )}
      </div>
      {isUser && (
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: C.accent + "22", border: `1px solid ${C.accentD}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800, color: C.accent, marginLeft: 8, flexShrink: 0,
        }}>L</div>
      )}
    </div>
  );
}

function QuickTaskButton({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: C.faint, border: `1px solid ${C.border}`,
      color: C.muted, borderRadius: 6, padding: "6px 12px",
      fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
      transition: "all 0.15s",
    }}
      onMouseEnter={e => { e.target.style.borderColor = C.accent; e.target.style.color = C.accent; }}
      onMouseLeave={e => { e.target.style.borderColor = C.border; e.target.style.color = C.muted; }}
    >{label}</button>
  );
}

// ── KPI strip ─────────────────────────────────────────────────────────────────
const KPIS = [
  { label: "Agents Online", value: "7/7", color: C.green, id: "agents_online" },
  { label: "Tasks Today", value: "36", color: C.blue, id: "tasks" },
  { label: "Leads Found", value: "18", color: C.purple, id: "leads" },
  { label: "Emails Queued", value: "7", color: C.gold, id: "emails" },
  { label: "Opps Tracked", value: "5", color: C.accent, id: "opps" },
  { label: "SEO Keywords", value: "142", color: C.teal, id: "seo" },
  { label: "Pipeline Deals", value: "23", color: C.cyan, id: "pipeline" },
];

// ── KPI drawer data ────────────────────────────────────────────────────────────
const KPI_DETAIL = {
  tasks: {
    title: "Tasks Today",
    color: C.blue,
    emoji: "📋",
    items: [
      { label: "SCOUT: Research 5 retail chains NSW due for refurbishment", agent: "SCOUT", status: "done", priority: "high" },
      { label: "SCOUT: Map franchise networks expanding in QLD 2025", agent: "SCOUT", status: "done", priority: "medium" },
      { label: "SCOUT: Find facility managers Sydney CBD 50+ sites", agent: "SCOUT", status: "in progress", priority: "high" },
      { label: "COMPOSER: Draft cold email for Chemist Warehouse national", agent: "COMPOSER", status: "awaiting approval", priority: "high" },
      { label: "COMPOSER: Write 3-email follow-up sequence — signage prospects", agent: "COMPOSER", status: "awaiting approval", priority: "medium" },
      { label: "COMPOSER: Re-engagement email for past Brandboy client", agent: "COMPOSER", status: "done", priority: "medium" },
      { label: "HUNTER: Scan AusTender for commercial fit-out contracts", agent: "HUNTER", status: "done", priority: "high" },
      { label: "HUNTER: DA approvals commercial builds Sydney — weekly scan", agent: "HUNTER", status: "in progress", priority: "high" },
      { label: "HUNTER: Retail brand new store openings Q3 2025", agent: "HUNTER", status: "done", priority: "medium" },
      { label: "OPS: Weekly ops checklist — project managers", agent: "OPS", status: "done", priority: "medium" },
      { label: "RANKR: Audit homepage meta description and title tags", agent: "RANKR", status: "done", priority: "medium" },
      { label: "NEXUS: Flag deals with no activity in 7+ days", agent: "NEXUS", status: "in progress", priority: "high" },
      { label: "FORGE: Wire up KPI drawers across Mission Control", agent: "FORGE", status: "done", priority: "high" },
    ],
  },
  leads: {
    title: "Leads Found",
    color: C.purple,
    emoji: "🔍",
    items: [
      { label: "Chemist Warehouse — National Rollout", detail: "Store refresh program across 40+ locations, signage standardisation", score: 9, location: "National", value: "$2M+", status: "hot" },
      { label: "JLL Property — Sydney Portfolio", detail: "Facility manager for large commercial portfolio, ongoing tenancy fit-outs", score: 8, location: "Sydney CBD", value: "$1.5M+", status: "hot" },
      { label: "HCF Health Insurance", detail: "Office refurbishment — 15 branch locations", score: 6, location: "NSW/QLD", value: "$400K+", status: "warm" },
      { label: "Dexus REIT", detail: "Commercial property — office fit-out for incoming tenants", score: 7, location: "Sydney CBD", value: "$900K+", status: "warm" },
      { label: "Stockland", detail: "Retail precinct signage and wayfinding refresh", score: 6, location: "NSW/QLD", value: "$600K+", status: "warm" },
      { label: "NAB Bank", detail: "Branch signage standardisation — national program 2025", score: 7, location: "National", value: "$1M+", status: "warm" },
      { label: "Sydney Olympic Park Authority", detail: "Government — venue signage + maintenance contract", score: 8, location: "Sydney", value: "$700K+", status: "hot" },
      { label: "City of Sydney Council", detail: "DA approved — commercial precinct signage project", score: 6, location: "Sydney", value: "$350K+", status: "warm" },
      { label: "Vicinity Centres", detail: "Shopping centre — tenancy coordination and fit-out", score: 6, location: "VIC/NSW", value: "$800K+", status: "warm" },
    ],
  },
  emails: {
    title: "Emails Queued",
    color: C.gold,
    emoji: "✉️",
    items: [
      { label: "Chemist Warehouse — Initial Outreach", to: "facilities@chemistwarehouse.com.au", agent: "COMPOSER", subject: "Brandboy — Signage & Fit-Out Solutions for Chemist Warehouse", status: "awaiting approval", priority: "high", body: "Hi team,\n\nI'm reaching out from Brandboy — we're a Sydney-based commercial fit-out, signage, and refurbishment contractor with a track record across national retail rollouts.\n\nWith Chemist Warehouse's continued store expansion, I wanted to introduce ourselves as a potential partner for signage standardisation and fit-out work across new and refreshed locations. We handle everything end-to-end: design, fabrication, install, and compliance, with national coverage and dedicated project management.\n\nWould you be open to a short call this or next week to discuss your upcoming rollout schedule and how we could support it?\n\nThanks,\nLars\nBrandboy" },
      { label: "JLL Property — Facility Manager Intro", to: "commercial@au.jll.com", agent: "COMPOSER", subject: "Trusted Fit-Out Partner for Your Sydney Portfolio", status: "awaiting approval", priority: "high", body: "Hi team,\n\nMy name is Lars from Brandboy, a commercial fit-out, signage, and refurbishment contractor based in Sydney. I know JLL manages a large and varied commercial portfolio across NSW, and tenancy turnover often means tight fit-out timelines.\n\nWe specialise in fast-turnaround commercial fit-outs and signage for incoming tenants, with a strong track record on compliance, scheduling, and budget control — built specifically for facility and asset managers who can't afford delays.\n\nI'd love to get on your approved contractor list and discuss how we could support upcoming tenancy changes across your portfolio. Could we set up a 15-minute intro call?\n\nThanks,\nLars\nBrandboy" },
      { label: "Mirvac Group — Developer Outreach", to: "development@mirvac.com", agent: "COMPOSER", subject: "Brandboy — Commercial Fit-Out & Signage for Your Projects", status: "awaiting approval", priority: "medium", body: "Hi team,\n\nI'm Lars, founder of Brandboy — we deliver commercial fit-out, signage, and refurbishment work for developers and asset owners across NSW and QLD.\n\nGiven Mirvac's active development and commercial leasing pipeline, I wanted to introduce Brandboy as a sub-contractor option for tenancy fit-outs and wayfinding/signage packages. We work directly with project teams to keep handovers on schedule and to spec.\n\nHappy to share our capability statement and recent project references if useful — would you be open to a quick conversation about upcoming opportunities?\n\nThanks,\nLars\nBrandboy" },
      { label: "Fitness First — Refurbishment Follow-Up", to: "operations@fitnessfirst.com.au", agent: "COMPOSER", subject: "Following Up — Gym Refurbishment Solutions", status: "awaiting approval", priority: "medium", body: "Hi team,\n\nFollowing up on my earlier note — Brandboy specialises in commercial refurbishments, and gym fit-outs are very much in our wheelhouse: flooring, change rooms, signage, and full-facility refreshes with minimal disruption to trading hours.\n\nIf there's a refurbishment cycle planned for any Fitness First locations, we'd welcome the chance to quote. We can work around your operating hours and have experience coordinating multi-site refresh programs.\n\nLet me know if it'd be useful to jump on a quick call to talk through scope and timing.\n\nThanks,\nLars\nBrandboy" },
      { label: "Lendlease — Construction Partner", to: "procurement@lendlease.com", agent: "COMPOSER", subject: "Brandboy — Your Fit-Out & Signage Sub-Contractor Partner", status: "awaiting approval", priority: "medium", body: "Hi team,\n\nI'm Lars from Brandboy, a commercial fit-out, signage, and refurbishment contractor based in Sydney. We work as a sub-contractor partner on builds requiring tenancy fit-out, wayfinding, and signage packages.\n\nGiven Lendlease's pipeline of commercial and mixed-use developments, I wanted to introduce Brandboy as a reliable, compliance-focused partner for these scopes — we're used to working within larger project programs and tight head-contractor schedules.\n\nWould it be possible to get on your sub-contractor panel, or speak with someone in procurement about upcoming tender opportunities?\n\nThanks,\nLars\nBrandboy" },
      { label: "Past Client Re-engagement — Woolworths Facilities", to: "facilities@woolworthsgroup.com.au", agent: "COMPOSER", subject: "It's Been a While — Ready for Your Next Project?", status: "awaiting approval", priority: "low", body: "Hi team,\n\nIt's been a little while since we last worked together — hope things have been going well on your end.\n\nBrandboy has continued to grow our commercial fit-out and signage capability since then, and we'd love the opportunity to support any upcoming refurbishment, refresh, or signage projects across your network.\n\nIf there's anything in the pipeline, I'd welcome a quick catch-up to hear what's coming up and see where we could help.\n\nThanks,\nLars\nBrandboy" },
      { label: "Optus Retail — Store Refresh Sequence (Email 1)", to: "retail.ops@optus.com.au", agent: "COMPOSER", subject: "Brandboy — Retail Signage & Fit-Out for Optus Stores", status: "draft", priority: "medium", body: "Hi team,\n\nI'm Lars from Brandboy — we provide commercial fit-out and signage services to national retail brands, with experience delivering consistent in-store look-and-feel across multi-site rollouts.\n\nAs Optus continues refreshing retail locations, we'd welcome the chance to be considered for signage and fit-out work — from individual store refreshes through to coordinated national programs.\n\nWould you be open to a short call to discuss your store refresh schedule and how Brandboy could support it?\n\nThanks,\nLars\nBrandboy" },
    ],
  },
  opps: {
    title: "Opportunities Tracked",
    color: C.accent,
    emoji: "🎯",
    items: [
      { label: "NSW Government — Commercial Fit-Out Services Panel", detail: "AusTender ATM2025-CBD-001 — open tender for approved fit-out contractors", value: "$5M+ panel", deadline: "15 Aug 2025", type: "Government Tender", priority: "critical" },
      { label: "Westfield Bondi Junction — Tenancy Refresh", detail: "DA approved — 12 retail tenancies requiring full fit-out coordination", value: "$1.8M", deadline: "30 Jul 2025", type: "DA Approval", priority: "high" },
      { label: "Sydney Metro — Wayfinding Signage Contract", detail: "Transport for NSW procurement — station signage across 5 new stations", value: "$2.2M", deadline: "22 Aug 2025", type: "Government Tender", priority: "high" },
      { label: "Macquarie Park Corporate Hub — Office Fit-Out", detail: "Corporate relocation announced — 3 floors, 800 staff, full fit-out required", value: "$900K", deadline: "Ongoing", type: "Corporate Relocation", priority: "high" },
      { label: "Kmart Australia — Store Refresh Program", detail: "National refurbishment cycle announced — 40 stores in NSW/QLD first wave", value: "$3M+", deadline: "Sep 2025", type: "Retail Expansion", priority: "medium" },
    ],
  },
  seo: {
    title: "SEO Keywords Tracked",
    color: C.teal,
    emoji: "📈",
    items: [
      { label: "office fit out Sydney", position: 4, change: "+2", volume: "1,900/mo", status: "climbing" },
      { label: "commercial fit out Australia", position: 7, change: "+1", volume: "1,300/mo", status: "climbing" },
      { label: "retail signage Sydney", position: 12, change: "0", volume: "880/mo", status: "stable" },
      { label: "fit out companies Sydney", position: 3, change: "+3", volume: "720/mo", status: "climbing" },
      { label: "shop fit out NSW", position: 9, change: "-1", volume: "590/mo", status: "dropping" },
      { label: "office refurbishment Sydney", position: 6, change: "+2", volume: "480/mo", status: "climbing" },
      { label: "commercial signage Australia", position: 18, change: "0", volume: "390/mo", status: "stable" },
      { label: "retail fit out Melbourne", position: null, change: "—", volume: "640/mo", status: "not ranking" },
    ],
  },
  pipeline: {
    title: "Pipeline Deals",
    color: C.cyan,
    emoji: "🗂️",
    items: [
      { label: "ANZ Bank — Branch Refurbishment x4", stage: "Proposal", value: "$380K", days: 3, contact: "Sarah Mitchell — Facilities Manager" },
      { label: "Charter Hall — Office Fit-Out Level 12", stage: "Negotiation", value: "$620K", days: 1, contact: "James Okafor — Development Director" },
      { label: "Hungry Jack's — Signage Refresh x8 Stores", stage: "Qualified", value: "$290K", days: 5, contact: "Mark Chen — Operations Manager" },
      { label: "University of Sydney — Campus Signage", stage: "Proposal", value: "$450K", days: 2, contact: "Dr. Lisa Tan — Estates Director" },
      { label: "Dexus — Commercial Tenancy Fit-Out", stage: "Contacted", value: "$510K", days: 8, contact: "Paul Nguyen — Asset Manager" },
    ],
  },
};

// ── Quick task prompts per agent ───────────────────────────────────────────────
const QUICK_TASKS = {
  scout: [
    "Find 5 retail chains in NSW due for a store refresh",
    "Research top 10 franchise networks expanding in 2025",
    "Find facility managers in Sydney CBDs managing 50+ sites",
    "Identify corporates relocating offices in Melbourne",
  ],
  writer: [
    "Draft a cold outreach email for a national pharmacy chain",
    "Write a 3-email follow-up sequence for signage prospects",
    "Create a LinkedIn message for a property developer",
    "Draft a re-engagement email for a past Brandboy client",
  ],
  hunter: [
    "Find active government tenders for commercial fit-out",
    "Scan for DA approvals for commercial builds in Sydney",
    "Identify retail brands announcing new store openings",
    "Find corporate office relocations announced this quarter",
  ],
  ops: [
    "Create a weekly ops checklist for project managers",
    "Draft a supplier follow-up email template",
    "Build a risk register for a new fit-out project",
    "Summarise what data Brandboy should be backing up daily",
  ],
  seo: [
    "Find the top 10 keywords Brandboy should rank for",
    "Audit the brandboy.com.au homepage for SEO issues",
    "Write an SEO blog post on office fit-out trends in Sydney",
    "Create a local SEO strategy for Brandboy in NSW, VIC, QLD",
  ],
  crm: [
    "Build a lead scoring template for Brandboy prospects",
    "Create a 6-stage pipeline structure for fit-out deals",
    "Draft a weekly pipeline report template for Lars",
    "Segment our contacts by service line and deal value",
  ],
};

// ── Strategy modal content ────────────────────────────────────────────────────
const STRATEGY = [
  {
    phase: "WEEK 1–2",
    title: "Intelligence Gathering",
    agent: "SCOUT",
    color: C.blue,
    steps: [
      "SCOUT maps 200+ prospects across retail, corporate, govt, and franchise",
      "HUNTER scans all live tenders + DA approvals nationally",
      "OPS builds a prospect CRM template and data backup protocol",
      "Output: qualified prospect list with contact details + opportunity log",
    ],
  },
  {
    phase: "WEEK 3–4",
    title: "Campaign Launch",
    agent: "COMPOSER",
    color: C.purple,
    steps: [
      "COMPOSER drafts personalised email sequences per industry vertical",
      "Lars reviews + approves each campaign batch",
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
      "HUNTER flags new tenders + project opportunities weekly",
      "COMPOSER drafts proposal cover letters and capability summaries",
      "OPS tracks all active pipeline deals and flags stalled conversations",
      "Lars approves submissions — agents prep all supporting materials",
    ],
  },
  {
    phase: "ONGOING",
    title: "24/7 Automation",
    agent: "OPS",
    color: C.gold,
    steps: [
      "All agents run daily background tasks — reports delivered to Lars each morning",
      "SCOUT refreshes prospect list weekly with new targets",
      "COMPOSER queues follow-ups automatically after 5 business days",
      "OPS maintains data integrity and flags any business risks",
    ],
  },
  {
    phase: "MONTH 1–3",
    title: "SEO Foundation",
    agent: "RANKR",
    color: C.teal,
    steps: [
      "RANKR audits all brandboy.com.au pages for technical SEO gaps and quick wins",
      "Keyword map built across all service lines — fit-out, signage, refurbishment, construction",
      "12-month blog content calendar created with high-intent, rankable topics",
      "Local SEO optimised for Sydney, Melbourne, Brisbane, Perth, and Canberra",
    ],
  },
  {
    phase: "WEEK 1 ONWARDS",
    title: "CRM & Pipeline Control",
    agent: "NEXUS",
    color: C.cyan,
    steps: [
      "NEXUS builds Brandboy's 6-stage pipeline structure and lead scoring model",
      "All SCOUT-sourced prospects flow into NEXUS for scoring and prioritisation",
      "Weekly pipeline report delivered to Lars every Monday morning",
      "NEXUS flags stalled deals, re-engagement targets, and upsell opportunities with existing clients",
    ],
  },
];

// ── Main App ─────────────────────────────────────────────────────────────────
export default function MissionControl() {
  const [activeAgent, setActiveAgent] = useState(AGENTS[0]);
  const [conversations, setConversations] = useState({
    scout: [], writer: [], hunter: [], ops: [], seo: [], crm: [],
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("chat"); // chat | strategy | agents
  const [time, setTime] = useState(new Date());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerKey, setDrawerKey] = useState(null);
  const [sentEmails, setSentEmails] = useState([]);
  const [rejectedEmails, setRejectedEmails] = useState([]);
  const chatEndRef = useRef(null);

  function openDrawer(kpiId) {
    if (KPI_DETAIL[kpiId]) { setDrawerKey(kpiId); setDrawerOpen(true); }
  }

  function approveEmail(item, i) {
    const body = item.body || "";
    window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(item.to)}&su=${encodeURIComponent(item.subject)}&body=${encodeURIComponent(body)}`, '_blank');
    setSentEmails(prev => [...prev, i]);
  }

  function rejectEmail(i) {
    setRejectedEmails(prev => [...prev, i]);
  }

  function openAgentChat(agentName) {
    const agent = AGENTS.find(a => a.name === agentName);
    if (!agent) return;
    setActiveAgent(agent);
    setView("chat");
    setDrawerOpen(false);
  }

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
    setConversations(c => ({ ...c, [activeAgent.id]: newMsgs }));
    setInput("");
    setLoading(true);

    // Add pending bubble
    const pendingId = Date.now();
    setConversations(c => ({
      ...c,
      [activeAgent.id]: [
        ...newMsgs,
        { role: "assistant", content: "", pending: true, id: pendingId,
          agentName: activeAgent.name, agentColor: activeAgent.color, agentEmoji: activeAgent.emoji },
      ],
    }));

    try {
      const apiMsgs = newMsgs.map(m => ({ role: m.role, content: m.content }));
      const reply = await askAgent(activeAgent, apiMsgs);
      await saveMemory(
      activeAgent.name,
      "task",
      `User: ${text}\n\n${activeAgent.name}: ${reply}`,
      [activeAgent.focus, activeAgent.id]
    );
    await saveMemory(
      activeAgent.name,
      "task",
      `User: ${text}\n\n${activeAgent.name}: ${reply}`,
      [activeAgent.focus, activeAgent.id]
    );
      setConversations(c => {
        const cur = c[activeAgent.id].filter(m => !m.pending);
        return {
          ...c,
          [activeAgent.id]: [
            ...cur,
            { role: "assistant", content: reply,
              agentName: activeAgent.name, agentColor: activeAgent.color, agentEmoji: activeAgent.emoji },
          ],
        };
      });
    } catch (err) {
      setConversations(c => {
        const cur = c[activeAgent.id].filter(m => !m.pending);
        return {
          ...c,
          [activeAgent.id]: [
            ...cur,
            { role: "assistant", content: `⚠️ Error: ${err.message}`,
              agentName: activeAgent.name, agentColor: activeAgent.color, agentEmoji: activeAgent.emoji },
          ],
        };
      });
    }
    setLoading(false);
  }

  const quickTasks = QUICK_TASKS[activeAgent.id] || [];

  return (
    <div style={{
      minHeight: "100vh",
      background: C.black,
      color: C.text,
      fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${C.charcoal}; }
        ::-webkit-scrollbar-thumb { background: ${C.faint}; border-radius: 2px; }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; } 50% { opacity: 0; }
        }
        textarea:focus { outline: none; }
        button:active { transform: scale(0.97); }
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{
        background: C.charcoal,
        borderBottom: `1px solid ${C.border}`,
        padding: "0 24px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            background: C.accentG,
            borderRadius: 8,
            padding: "4px 12px",
            fontWeight: 900,
            fontSize: 15,
            letterSpacing: 1,
          }}>BB</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.5 }}>BRANDBOY MISSION CONTROL</div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1 }}>AI AGENT COMMAND CENTRE · SYDNEY AU</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Agents online indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%", background: C.green,
              animation: "pulse 2s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>7 AGENTS LIVE</span>
          </div>
          {/* Clock */}
          <div style={{ fontSize: 12, color: C.muted, fontVariantNumeric: "tabular-nums" }}>
            {time.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div style={{
        background: C.charcoal,
        borderBottom: `1px solid ${C.border}`,
        padding: "8px 24px",
        display: "flex",
        gap: 32,
        overflowX: "auto",
        flexShrink: 0,
      }}>
        {KPIS.map(k => (
          <div
            key={k.label}
            onClick={() => openDrawer(k.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
              cursor: KPI_DETAIL[k.id] ? "pointer" : "default",
              padding: "4px 8px", borderRadius: 8, transition: "background 0.15s",
            }}
            onMouseEnter={e => { if (KPI_DETAIL[k.id]) e.currentTarget.style.background = C.faint; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ fontSize: 18, fontWeight: 900, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 0.5 }}>
              {k.label}
              {KPI_DETAIL[k.id] && <span style={{ color: k.color, marginLeft: 4 }}>▾</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── NAV TABS ── */}
      <div style={{
        background: C.charcoal,
        borderBottom: `1px solid ${C.border}`,
        padding: "0 24px",
        display: "flex",
        gap: 0,
        flexShrink: 0,
      }}>
     {[["chat","💬 Talk to Agent"], ["agents","🤖 All Agents"], ["strategy","📋 Strategy"], ["activity","📡 Activity Log"]].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            background: "none",
            border: "none",
            borderBottom: view === v ? `2px solid ${C.accent}` : "2px solid transparent",
            color: view === v ? C.accent : C.muted,
            padding: "10px 20px",
            fontSize: 12,
            fontWeight: view === v ? 700 : 400,
            cursor: "pointer",
            letterSpacing: 0.5,
          }}>{label}</button>
        ))}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── LEFT SIDEBAR: Agent selector ── */}
        <div style={{
          width: 260,
          background: C.charcoal,
          borderRight: `1px solid ${C.border}`,
          padding: "16px 12px",
          overflowY: "auto",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, padding: "0 4px", marginBottom: 4 }}>
            SELECT AGENT
          </div>
          {AGENTS.map(a => (
            <AgentCard
              key={a.id}
              agent={a}
              onClick={ag => { setActiveAgent(ag); setView("chat"); }}
              active={activeAgent.id === a.id}
            />
          ))}
          {/* Lars identity */}
          <div style={{
            marginTop: "auto",
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: C.accentG,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: 14,
            }}>L</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12 }}>Lars</div>
              <div style={{ fontSize: 10, color: C.muted }}>Commander · Brandboy</div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* ═══ CHAT VIEW ═══ */}
          {view === "chat" && (
            <>
              {/* Agent header */}
              <div style={{
                background: C.panel,
                borderBottom: `1px solid ${C.border}`,
                padding: "12px 20px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexShrink: 0,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: activeAgent.color + "22",
                  border: `1px solid ${activeAgent.color}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                }}>{activeAgent.emoji}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: activeAgent.color }}>
                    {activeAgent.name}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>{activeAgent.title} · {activeAgent.focus}</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <StatusPill status="● ONLINE 24/7" color={activeAgent.color} />
                </div>
              </div>

              {/* Messages */}
              <div style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
              }}>
                {msgs.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>{activeAgent.emoji}</div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: activeAgent.color, marginBottom: 6 }}>
                      {activeAgent.name} is ready
                    </div>
                    <div style={{ fontSize: 13, color: C.muted, maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
                      {activeAgent.description}
                    </div>
                    <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                      {quickTasks.map(t => (
                        <QuickTaskButton key={t} label={t} onClick={() => send(t)} />
                      ))}
                    </div>
                  </div>
                )}
                {msgs.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
                <div ref={chatEndRef} />
              </div>

              {/* Quick tasks */}
              {msgs.length > 0 && (
                <div style={{
                  padding: "8px 20px",
                  background: C.panel,
                  borderTop: `1px solid ${C.border}`,
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  flexShrink: 0,
                }}>
                  {quickTasks.slice(0, 3).map(t => (
                    <QuickTaskButton key={t} label={t} onClick={() => send(t)} />
                  ))}
                </div>
              )}

              {/* Input */}
              <div style={{
                background: C.panel,
                borderTop: `1px solid ${C.border}`,
                padding: "12px 20px",
                display: "flex",
                gap: 10,
                flexShrink: 0,
              }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
                  }}
                  placeholder={`Give ${activeAgent.name} a task…`}
                  style={{
                    flex: 1,
                    background: C.charcoal,
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    color: C.text,
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
                    background: loading ? C.faint : C.accentG,
                    border: "none",
                    borderRadius: 10,
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    padding: "0 20px",
                    cursor: loading ? "not-allowed" : "pointer",
                    flexShrink: 0,
                    transition: "all 0.2s",
                  }}
                >
                  {loading ? "…" : "SEND ▶"}
                </button>
              </div>
            </>
          )}

          {/* ═══ ALL AGENTS VIEW ═══ */}
          {view === "agents" && (
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Your AI Agent Team</div>
                <div style={{ fontSize: 13, color: C.muted }}>
                  4 specialist agents working 24/7 across sales, marketing, BD, and operations
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {AGENTS.map(a => (
                  <div key={a.id} style={{
                    background: C.panel,
                    border: `1px solid ${a.color}44`,
                    borderRadius: 12,
                    padding: 20,
                    position: "relative",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 3,
                      background: a.color,
                    }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: a.color + "22",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 24,
                      }}>{a.emoji}</div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: a.color }}>{a.name}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{a.title}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6, marginBottom: 14 }}>
                      {a.description}
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>CAPABILITIES</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {a.capabilities.map(c => (
                          <span key={c} style={{
                            fontSize: 10, background: a.color + "15",
                            color: a.color, border: `1px solid ${a.color}33`,
                            borderRadius: 4, padding: "2px 8px",
                          }}>{c}</span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => { setActiveAgent(a); setView("chat"); }} style={{
                      background: a.color, border: "none", borderRadius: 8,
                      color: "#fff", fontWeight: 700, fontSize: 12,
                      padding: "8px 16px", cursor: "pointer", width: "100%",
                    }}>
                      TALK TO {a.name} →
                    </button>
                  </div>
                ))}
              </div>

              {/* Integration note */}
              <div style={{
                marginTop: 24,
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: 20,
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: C.accent }}>
                  📡 System Integration Map
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                  {[
                    { icon: "📧", label: "Email", desc: "team@brandboy.com.au — COMPOSER queues, Lars approves" },
                    { icon: "📊", label: "CRM", desc: "NEXUS manages full pipeline — lead scoring, stages, follow-ups" },
                    { icon: "🌐", label: "Web Leads", desc: "Website contact form feeds directly to SCOUT + NEXUS" },
                    { icon: "📈", label: "SEO", desc: "RANKR drives organic traffic to brandboy.com.au 24/7" },
                    { icon: "🎯", label: "Tenders", desc: "HUNTER monitors AusTender + state portals 24/7" },
                    { icon: "📁", label: "Data Backup", desc: "OPS archives all decisions, contacts, and pipeline daily" },
                    { icon: "🔍", label: "Prospects", desc: "SCOUT builds and refreshes targeted contact lists weekly" },
                    { icon: "📱", label: "Reports", desc: "Morning briefing + weekly pipeline summary delivered to Lars" },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: C.charcoal,
                      borderRadius: 8,
                      padding: "12px 14px",
                      border: `1px solid ${C.border}`,
                    }}>
                      <div style={{ fontSize: 18, marginBottom: 6 }}>{item.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ STRATEGY VIEW ═══ */}
            {view === "activity" && <ActivityLog />}
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

              {STRATEGY.map((s, i) => (
                <div key={i} style={{
                  background: C.panel,
                  border: `1px solid ${s.color}33`,
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 16,
                  position: "relative",
                  overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute", top: 0, left: 0, bottom: 0, width: 4,
                    background: s.color,
                  }} />
                  <div style={{ paddingLeft: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{
                        background: s.color + "22", color: s.color,
                        border: `1px solid ${s.color}44`,
                        borderRadius: 4, fontSize: 10, fontWeight: 800,
                        padding: "2px 10px", letterSpacing: 1,
                      }}>{s.phase}</span>
                      <span style={{
                        background: C.faint, color: C.muted,
                        borderRadius: 4, fontSize: 10, padding: "2px 8px",
                      }}>Lead: {s.agent}</span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>{s.title}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {s.steps.map((step, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: "50%",
                            background: s.color + "22", border: `1px solid ${s.color}44`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 800, color: s.color,
                            flexShrink: 0, marginTop: 1,
                          }}>{j + 1}</div>
                          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{step}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* Revenue targets */}
              <div style={{
                background: C.panel,
                border: `1px solid ${C.accent}44`,
                borderRadius: 12,
                padding: 20,
                marginTop: 8,
              }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.accent, marginBottom: 14 }}>
                  🎯 Target Outcomes — 90 Days
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", gap: 16 }}>
                  {[
                    { metric: "500+", label: "Prospects Researched", color: C.blue },
                    { metric: "200+", label: "Emails Sent", color: C.purple },
                    { metric: "30+", label: "Leads Qualified", color: C.green },
                    { metric: "10+", label: "Proposals Submitted", color: C.accent },
                    { metric: "Top 3", label: "Google Rankings", color: C.teal },
                    { metric: "$2M+", label: "Pipeline Value", color: C.cyan },
                  ].map(m => (
                    <div key={m.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color: m.color }}>{m.metric}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily rhythm */}
              <div style={{
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: 20,
                marginTop: 16,
              }}>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>⏰ Daily Agent Rhythm</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[
                    { time: "6:00 AM", agent: "OPS", task: "Morning briefing compiled — overnight activity summary delivered to Lars", color: C.gold },
                    { time: "7:00 AM", agent: "RANKR", task: "SEO rank tracking check — keyword position movements and traffic alerts", color: C.teal },
                    { time: "8:00 AM", agent: "SCOUT", task: "Daily prospect scan — new targets identified and added to pipeline", color: C.blue },
                    { time: "9:00 AM", agent: "NEXUS", task: "Pipeline review — flags stalled deals, scores new leads from SCOUT", color: C.cyan },
                    { time: "10:00 AM", agent: "COMPOSER", task: "Email queue ready for Lars review and approval", color: C.purple },
                    { time: "12:00 PM", agent: "HUNTER", task: "Tender and opportunity check — mid-day scan of AusTender + state portals", color: C.green },
                    { time: "3:00 PM", agent: "COMPOSER", task: "Follow-up emails triggered for outstanding leads (5+ business days old)", color: C.purple },
                    { time: "5:00 PM", agent: "NEXUS", task: "End-of-day pipeline update — deal stage changes, next actions logged", color: C.cyan },
                    { time: "6:00 PM", agent: "OPS", task: "Data backup and end-of-day CRM reconciliation", color: C.gold },
                    { time: "Overnight", agent: "RANKR", task: "Crawls competitor sites, identifies new keyword gaps, queues content briefs", color: C.teal },
                    { time: "Overnight", agent: "ALL", task: "Background research, lead enrichment, and opportunity monitoring continues", color: C.accent },
                  ].map((r, i) => (
                    <div key={i} style={{
                      display: "flex",
                      gap: 16,
                      padding: "10px 0",
                      borderBottom: i < 10 ? `1px solid ${C.faint}` : "none",
                      alignItems: "flex-start",
                    }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, color: C.muted,
                        minWidth: 70, flexShrink: 0, paddingTop: 2,
                      }}>{r.time}</div>
                      <div style={{
                        fontSize: 10, background: r.color + "22", color: r.color,
                        border: `1px solid ${r.color}44`,
                        borderRadius: 3, padding: "1px 8px", flexShrink: 0,
                        alignSelf: "flex-start", marginTop: 1,
                      }}>{r.agent}</div>
                      <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{r.task}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI DRAWER OVERLAY ── */}
      {drawerOpen && drawerKey && (() => {
        const d = KPI_DETAIL[drawerKey];
        return (
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
              zIndex: 1000, display: "flex", justifyContent: "flex-end",
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: 680, background: C.charcoal,
                borderLeft: `1px solid ${C.border}`,
                display: "flex", flexDirection: "column",
                height: "100%",
              }}
            >
              {/* Drawer header */}
              <div style={{
                padding: "24px 28px",
                borderBottom: `1px solid ${C.border}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 28 }}>{d.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 19, color: d.color }}>{d.title}</div>
                    <div style={{ fontSize: 13, color: C.muted }}>{d.items.length} items · click outside to close</div>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  style={{
                    background: C.faint, border: "none", borderRadius: 6,
                    color: C.muted, fontSize: 20, width: 38, height: 38,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >✕</button>
              </div>

              {/* Drawer items */}
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 28px" }}>

                {/* TASKS */}
                {drawerKey === "tasks" && d.items.map((item, i) => {
                  const agentColor = { SCOUT: C.blue, COMPOSER: C.purple, HUNTER: C.green, OPS: C.gold, RANKR: C.teal, NEXUS: C.cyan, FORGE: "#F97316" }[item.agent] || C.muted;
                  const statusColor = item.status === "done" ? C.green : item.status === "awaiting approval" ? C.gold : item.status === "in progress" ? C.blue : C.muted;
                  const statusBg = item.status === "done" ? C.green + "22" : item.status === "awaiting approval" ? C.gold + "22" : item.status === "in progress" ? C.blue + "22" : C.faint;
                  return (
                    <div
                      key={i}
                      onClick={() => openAgentChat(item.agent)}
                      title={`Open ${item.agent} in Chat`}
                      style={{
                        background: C.panel, borderRadius: 10, padding: "14px 18px",
                        marginBottom: 12, border: `1px solid ${C.border}`,
                        borderLeft: `4px solid ${agentColor}`,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, background: agentColor + "22", color: agentColor, border: `1px solid ${agentColor}44`, borderRadius: 4, padding: "2px 8px", fontWeight: 700 }}>{item.agent}</span>
                        <span style={{ fontSize: 12, background: statusBg, color: statusColor, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>{item.status.toUpperCase()}</span>
                        {item.priority === "high" && <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>● HIGH</span>}
                        <span style={{ fontSize: 11, color: agentColor, marginLeft: "auto" }}>💬 Open in Chat</span>
                      </div>
                      <div style={{ fontSize: 14, color: C.text, lineHeight: 1.6, marginBottom: item.status !== "done" ? 10 : 0 }}>{item.label}</div>
                      {item.status !== "done" && (
                        <div style={{ display: "flex", gap: 10 }}>
                          {item.status === "awaiting approval" && (
                            <button
                              onClick={e => { e.stopPropagation(); alert(`Approved: ${item.label}`); }}
                              style={{ flex: 1, background: C.green, border: "none", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 700, padding: "9px 0", cursor: "pointer" }}
                            >✓ Approve</button>
                          )}
                          {item.status === "in progress" && (
                            <button
                              onClick={e => { e.stopPropagation(); alert(`Marked done: ${item.label}`); }}
                              style={{ flex: 1, background: C.blue, border: "none", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 700, padding: "9px 0", cursor: "pointer" }}
                            >✓ Mark Done</button>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); alert(`Rejected: ${item.label}`); }}
                            style={{ flex: 1, background: C.red, border: "none", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 700, padding: "9px 0", cursor: "pointer" }}
                          >✕ Reject</button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* LEADS */}
                {drawerKey === "leads" && d.items.map((item, i) => {
                  const statusColor = item.status === "hot" ? C.red : item.status === "warm" ? C.gold : C.blue;
                  return (
                    <div key={i} style={{
                      background: C.panel, borderRadius: 10, padding: "14px 18px",
                      marginBottom: 12, border: `1px solid ${C.border}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 16, color: C.text }}>{item.label}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, background: statusColor + "22", color: statusColor, border: `1px solid ${statusColor}44`, borderRadius: 4, padding: "2px 8px", fontWeight: 700 }}>{item.status.toUpperCase()}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: statusColor }}>{item.score}/10</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>{item.detail}</div>
                      <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                        <span style={{ color: C.green, fontWeight: 600 }}>{item.value}</span>
                        <span style={{ color: C.muted }}>{item.location}</span>
                      </div>
                    </div>
                  );
                })}

                {/* EMAILS */}
                {drawerKey === "emails" && d.items.map((item, i) => {
                  const statusColor = item.status === "awaiting approval" ? C.gold : item.status === "draft" ? C.muted : C.green;
                  return (
                    <div key={i} style={{
                      background: C.panel, borderRadius: 10, padding: "14px 18px",
                      marginBottom: 12, border: `1px solid ${C.border}`,
                      position: "relative",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{item.label}</span>
                        {sentEmails.includes(i) ? (
                          <span style={{ fontSize: 12, background: C.green + "22", color: C.green, border: `1px solid ${C.green}44`, borderRadius: 4, padding: "2px 8px", fontWeight: 700 }}>SENT</span>
                        ) : rejectedEmails.includes(i) ? (
                          <span style={{ fontSize: 12, background: C.red + "22", color: C.red, border: `1px solid ${C.red}44`, borderRadius: 4, padding: "2px 8px", fontWeight: 700 }}>REJECTED</span>
                        ) : (
                          <span style={{ fontSize: 12, background: statusColor + "22", color: statusColor, border: `1px solid ${statusColor}44`, borderRadius: 4, padding: "2px 8px", fontWeight: 700 }}>{item.status.toUpperCase()}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: C.muted, marginBottom: 3 }}>To: {item.to}</div>
                      <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>Subject: {item.subject}</div>
                      {item.body && (
                        <div style={{
                          fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap",
                          background: C.faint, border: `1px solid ${C.border}`, borderRadius: 8,
                          padding: "14px 16px", marginBottom: 12,
                        }}>{item.body}</div>
                      )}
                      {item.status === "awaiting approval" && !sentEmails.includes(i) && !rejectedEmails.includes(i) && (
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <button
                            onClick={() => approveEmail(item, i)}
                            style={{ flex: 1, background: C.green, border: "none", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 700, padding: "9px 0", cursor: "pointer" }}
                          >✓ Approve & Send</button>
                          <button
                            onClick={() => rejectEmail(i)}
                            style={{ flex: 1, background: C.faint, border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 13, fontWeight: 700, padding: "9px 0", cursor: "pointer" }}
                          >✕ Reject</button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* OPPS */}
                {drawerKey === "opps" && d.items.map((item, i) => {
                  const priColor = item.priority === "critical" ? C.red : item.priority === "high" ? C.accent : C.gold;
                  return (
                    <div key={i} style={{
                      background: C.panel, borderRadius: 10, padding: "14px 18px",
                      marginBottom: 12, border: `1px solid ${priColor}44`,
                      borderLeft: `4px solid ${priColor}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{item.label}</span>
                        <span style={{ fontSize: 12, background: priColor + "22", color: priColor, borderRadius: 4, padding: "2px 8px", fontWeight: 700 }}>{item.priority.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: 13, color: C.muted, marginBottom: 8, lineHeight: 1.6 }}>{item.detail}</div>
                      <div style={{ display: "flex", gap: 16, fontSize: 13, flexWrap: "wrap" }}>
                        <span style={{ color: C.green, fontWeight: 700 }}>{item.value}</span>
                        <span style={{ color: C.muted }}>📅 {item.deadline}</span>
                        <span style={{ color: C.blue }}>{item.type}</span>
                      </div>
                    </div>
                  );
                })}

                {/* SEO */}
                {drawerKey === "seo" && d.items.map((item, i) => {
                  const statusColor = item.status === "climbing" ? C.green : item.status === "dropping" ? C.red : item.status === "not ranking" ? C.red : C.muted;
                  return (
                    <div key={i} style={{
                      background: C.panel, borderRadius: 10, padding: "14px 18px",
                      marginBottom: 12, border: `1px solid ${C.border}`,
                      display: "flex", alignItems: "center", gap: 16,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 3 }}>{item.label}</div>
                        <div style={{ fontSize: 13, color: C.muted }}>{item.volume} searches/mo</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: item.position ? C.teal : C.red }}>
                          {item.position ? `#${item.position}` : "—"}
                        </div>
                        <div style={{ fontSize: 12, color: statusColor, fontWeight: 700 }}>
                          {item.change !== "—" ? (item.change.startsWith("+") ? "▲" : item.change.startsWith("-") ? "▼" : "●") : "●"} {item.status}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* PIPELINE */}
                {drawerKey === "pipeline" && d.items.map((item, i) => {
                  const stageColor = { "Negotiation": C.green, "Proposal": C.blue, "Qualified": C.purple, "Contacted": C.gold, "New": C.muted }[item.stage] || C.muted;
                  return (
                    <div key={i} style={{
                      background: C.panel, borderRadius: 10, padding: "14px 18px",
                      marginBottom: 12, border: `1px solid ${C.border}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{item.label}</span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: C.cyan }}>{item.value}</span>
                      </div>
                      <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>{item.contact}</div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ fontSize: 12, background: stageColor + "22", color: stageColor, border: `1px solid ${stageColor}44`, borderRadius: 4, padding: "2px 8px", fontWeight: 700 }}>{item.stage.toUpperCase()}</span>
                        <span style={{ fontSize: 13, color: item.days >= 7 ? C.red : C.muted }}>
                          {item.days >= 7 ? "⚠️ " : ""}Last activity {item.days}d ago
                        </span>
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
