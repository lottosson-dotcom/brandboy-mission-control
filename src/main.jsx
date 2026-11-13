import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import MissionControl from "./MissionControl.jsx";
import LoginGate from "./components/LoginGate.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LoginGate>
      <MissionControl />
    </LoginGate>
  </StrictMode>,
);
