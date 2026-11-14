// =============================================================================
// SHARED LOOKS for the form screens (Daily Tasks, Contacts)
// =============================================================================
// Same colours as the C palette in MissionControl.jsx.
// =============================================================================

export const MUTED = "#A3A3A3";
export const BORDER = "#2A2A2A";
export const ACCENT = "#FF6B2B";
export const RED = "#EF4444";

// A text box, drop-down or text area.
export const field = {
  width: "100%",
  background: "#141414",
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  color: "#F0F0F0",
  padding: "8px 10px",
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

// A small button: outlined, or filled with the colour.
export const button = (color, filled) => ({
  background: filled ? color : "#141414",
  border: `1px solid ${filled ? color : BORDER}`,
  color: filled ? "#fff" : color,
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
});

// The orange "＋ New …" button at the top of a screen.
export const bigButton = {
  background: "linear-gradient(135deg,#FF6B2B,#FF9A5C)",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  padding: "8px 14px",
  cursor: "pointer",
};
