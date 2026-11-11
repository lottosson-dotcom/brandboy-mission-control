// =============================================================================
// PDF ATTACHMENTS
// =============================================================================
// Lets Lars drop a PDF (a tender, a brief, a floor plan) into the chat and ask
// an agent about it. The PDF goes to Claude with the message; it is NOT stored
// anywhere. Saved chats keep only the file name, so after a refresh the PDF has
// to be attached again to ask more about it.
// =============================================================================

import { formatSize } from "../lib/pdf.js";

// The little "📄 tender.pdf · 1.2 MB" label, with an optional ✕ to remove it.
export function PdfChip({ pdf, onRemove }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "#0A0A0A",
        border: "1px solid #2A2A2A",
        borderRadius: 6,
        padding: "4px 8px",
        fontSize: 12,
        color: "#F0F0F0",
        maxWidth: "100%",
      }}
    >
      <span>📄</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {pdf.name}
      </span>
      {pdf.size ? <span style={{ color: "#A3A3A3" }}>· {formatSize(pdf.size)}</span> : null}
      {onRemove && (
        <button
          onClick={onRemove}
          title="Remove PDF"
          style={{
            background: "none",
            border: "none",
            color: "#A3A3A3",
            cursor: "pointer",
            fontSize: 13,
            padding: 0,
            marginLeft: 2,
          }}
        >
          ✕
        </button>
      )}
    </span>
  );
}
