// =============================================================================
// SCAN REPORT: one daily-scan report in the Activity Log
// =============================================================================
// Shows the report nicely formatted (lists, bold, links), folded to a few lines
// with a "Show full report" button.
// =============================================================================
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ScanReport({ text }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 400;
  return (
    <div style={{ marginTop: 6 }}>
      <div
        className="mc-md"
        style={{
          fontSize: 13,
          color: "#F0F0F0",
          lineHeight: 1.55,
          maxHeight: open || !long ? "none" : 150,
          overflow: "hidden",
          maskImage: open || !long ? "none" : "linear-gradient(#000 60%, transparent)",
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}
        >
          {text}
        </ReactMarkdown>
      </div>
      {long && (
        <button
          onClick={() => setOpen(!open)}
          style={{
            background: "none",
            border: "none",
            color: "#FF9A5C",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 0 0",
          }}
        >
          {open ? "▲ Show less" : "▼ Show full report"}
        </button>
      )}
    </div>
  );
}
