import React from "react";
import { SHead } from "./terminalHelperComponents.jsx";
import { CSS_VARS } from "../../styles/cssVars.js";
import VerdictRadar from "./VerdictRadar.jsx";

export default function VerdictSynthesis({ verdictScores }) {
  if (!verdictScores) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "16px 20px",
        background: CSS_VARS.card,
        border: `1px solid ${CSS_VARS.borderSubtle}`,
        borderRadius: 12,
        boxShadow: `0 1px 3px 0 ${CSS_VARS.borderSubtle}`,
      }}
      className="glass-panel"
    >
      <SHead
        icon="◈"
        title="VERDICT SYNTHESIS"
        color="var(--status-purple, #bf5af2)"
      />
      <VerdictRadar scores={verdictScores} size={180} animated />
    </div>
  );
}
