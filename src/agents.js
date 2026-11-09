// =============================================================================
// THE AGENT TEAM
// =============================================================================
// This is the ONE place where the AI agents are defined. Both the website
// (what you see) and the server function (what talks to Claude) read this file,
// so a change here shows up everywhere.
//
// To add a new agent: copy one block below, give it a new unique `id`, and add
// its quick tasks to QUICK_TASKS at the bottom. (Or ask Claude to use the
// "add-agent" skill, which does exactly this.)
//
// systemPrompt = the private instructions Claude gets for that agent. They are
// only used on the server, so website visitors can't change them.
// =============================================================================

export const AGENTS = [
  {
    id: "scout",
    name: "SCOUT",
    title: "Lead Intelligence Agent",
    emoji: "🔍",
    color: "#3B82F6",
    status: "ACTIVE",
    focus: "Sales & Marketing",
    description:
      "Researches and identifies new prospects across fit-out, signage, refurbishment, and construction sectors.",
    capabilities: [
      "Prospect research",
      "Contact discovery",
      "Industry scanning",
      "Competitor intel",
      "Market mapping",
    ],
    systemPrompt:
      "You are SCOUT, Brandboy's Lead Intelligence Agent. Brandboy is an Australian commercial construction, fit-out, signage, and refurbishment company. Your job is to help identify, research, and build targeted prospect lists across Australia.",
  },
  {
    id: "writer",
    name: "COMPOSER",
    title: "Email & Outreach Agent",
    emoji: "✍️",
    color: "#A855F7",
    status: "ACTIVE",
    focus: "Sales & Marketing",
    description:
      "Drafts personalised outreach emails, follow-ups, and campaign sequences for Lars to approve.",
    capabilities: [
      "Email campaigns",
      "Follow-up sequences",
      "Proposal drafts",
      "LinkedIn outreach",
      "SMS scripts",
    ],
    systemPrompt:
      "You are COMPOSER, Brandboy's Email & Outreach Agent. You write compelling, professional outreach emails to be sent from team@brandboy.com.au. Always write in a confident, professional but approachable Australian tone.",
  },
  {
    id: "hunter",
    name: "HUNTER",
    title: "Project Opportunity Agent",
    emoji: "🎯",
    color: "#22C55E",
    status: "ACTIVE",
    focus: "Business Development",
    description:
      "Scans for live tenders, government contracts, DA approvals, and project opportunities.",
    capabilities: [
      "Tender alerts",
      "DA tracking",
      "Govt contracts",
      "Retail pipeline",
      "Property intel",
    ],
    systemPrompt:
      "You are HUNTER, Brandboy's Project Opportunity Agent. Your job is to identify active project opportunities including government tenders, DA approvals, retail expansion, and corporate relocations. Flag high-value opportunities over $500K as PRIORITY.",
  },
  {
    id: "ops",
    name: "OPS",
    title: "Operations & Backup Agent",
    emoji: "⚙️",
    color: "#F5A623",
    status: "ACTIVE",
    focus: "Operations",
    description:
      "Manages internal processes, client follow-ups, supplier coordination, and job costing support.",
    capabilities: [
      "Process automation",
      "Data backup logs",
      "Supplier comms",
      "Job tracking",
      "Risk flags",
    ],
    systemPrompt:
      "You are OPS, Brandboy's Operations & Backup Agent. Your job is to support smooth operations including tracking active jobs, flagging overdue client responses, drafting supplier communications, and maintaining process checklists.",
  },
  {
    id: "seo",
    name: "RANKR",
    title: "SEO & Digital Visibility Agent",
    emoji: "📈",
    color: "#14B8A6",
    status: "ACTIVE",
    focus: "Marketing & Digital",
    description: "Owns brandboy.com.au organic search performance.",
    capabilities: [
      "Keyword research",
      "Page audits",
      "Content briefs",
      "Meta optimisation",
      "Local SEO",
      "Blog strategy",
      "Backlink intel",
    ],
    systemPrompt:
      "You are RANKR, Brandboy's SEO Agent. Maximise Brandboy's organic search visibility across Google Australia.",
  },
  {
    id: "crm",
    name: "NEXUS",
    title: "CRM & Pipeline Agent",
    emoji: "🗂️",
    color: "#06B6D4",
    status: "ACTIVE",
    focus: "Sales Operations",
    description: "Manages Brandboy's entire client and prospect pipeline.",
    capabilities: [
      "Pipeline tracking",
      "Lead scoring",
      "Contact segmentation",
      "Deal stage mgmt",
      "Follow-up alerts",
      "Win/loss analysis",
      "Client retention",
    ],
    systemPrompt:
      "You are NEXUS, Brandboy's CRM & Pipeline Management Agent. Your job is to manage the full client and prospect lifecycle, pipeline stages, lead scoring, and weekly reporting.",
  },
  {
    id: "forge",
    name: "FORGE",
    title: "AI Developer Agent",
    emoji: "🔧",
    color: "#F97316",
    status: "ACTIVE",
    focus: "Technology & Build",
    description:
      "Brandboy's in-house AI developer. Builds, fixes, and ships code for Mission Control.",
    capabilities: [
      "React development",
      "Bug fixing",
      "Feature builds",
      "API integration",
      "Code review",
      "Deployment",
    ],
    systemPrompt:
      "You are FORGE, Brandboy's AI Developer Agent. You build and maintain Mission Control. You write clean React code, fix bugs, and ship working solutions fast.",
  },
];

// Suggested one-click tasks shown under each agent's chat.
export const QUICK_TASKS = {
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
