/**
 * TerminalHeader — extracted from MainTerminal.jsx for file size compliance.
 */
import React from "react";
import { T, Tag, AMDPhaseTag } from "./terminalStyles.js";
import { CSS_VARS } from "../../styles/cssVars.js";

export default function TerminalHeader({ profile, fr, displayedAmdPhase, throttleActive, onLogout }) {
  const getGreetingName = () => profile?.fullName || profile?.email || "Officer";
  const greeting = `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${getGreetingName()}`;

  return (
    <div style={{
      background: CSS_VARS.card,
      borderBottom: `1px solid ${CSS_VARS.borderSubtle}`,
      padding: "16px 32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 16,
      boxShadow: `0 1px 2px 0 ${CSS_VARS.borderSubtle}`
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Logo bars */}
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
          {[10, 16, 12, 22, 14, 20, 11].map((h, i) => (
            <div key={i} style={{ width: 4, height: h, background: `hsl(${150 + i * 15},80%,60%)`, borderRadius: 2 }} />
          ))}
        </div>
        <div>
          <div style={{ color: T.text, fontSize: 16, letterSpacing: 4, fontWeight: 800 }}>
            {greeting}
          </div>
          <div style={{ color: T.blue, fontSize: 11, letterSpacing: 3, marginTop: 4, fontWeight: 700 }}>
            Execution Workspace
          </div>
          <div style={{ color: T.muted, fontSize: 10, letterSpacing: 2, marginTop: 4, fontWeight: 600 }}>
            INSTITUTIONAL TERMINAL · v9
          </div>
        </div>
        {fr.parsed && <Tag label={fr.firmName} color={T.purple} />}
        <AMDPhaseTag phase={displayedAmdPhase} />
        {throttleActive && <Tag label="⚠ DRAWDOWN THROTTLE" color={T.gold} />}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <span style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>
          {profile?.fullName || profile?.email}
        </span>
        <button
          onClick={onLogout}
          style={{
            background: "transparent",
            border: "none",
            padding: "4px 8px",
            cursor: "pointer",
            color: T.muted,
            fontSize: 11,
            letterSpacing: 1,
            fontWeight: 600,
            fontFamily: T.font,
          }}
        >
          LOGOUT
        </button>
      </div>
    </div>
  );
}