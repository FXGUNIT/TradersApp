import React from 'react';
import { T } from '../constants/theme.js';
import { Tag, AMDPhaseTag, LED } from './SharedUI.jsx';
import { formatPhoneNumber } from '../utils/businessLogicUtils.jsx';

export function TerminalHeader({ fullGreeting, fr, currentAMD, throttleActive, complianceColor, parsed, profile, onLogout }) {
  return (
      <div style={{ background: "#FFFFFF", borderBottom: `1px solid #E5E7EB`, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)" }} className="glass-panel">
        
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
            {[10, 16, 12, 22, 14, 20, 11].map((h, i) => (
              <div key={i} style={{ width: 4, height: h, background: `hsl(${150 + i * 15},80%,60%)`, borderRadius: 2 }} />
            ))}
          </div>
          <div>
            <div style={{ color: "#111827", fontSize: 16, letterSpacing: 4, fontWeight: 800 }}>{fullGreeting}</div>
            <div style={{ color: "#6B7280", fontSize: 10, letterSpacing: 2, marginTop: 4, fontWeight: 600 }}>INSTITUTIONAL TERMINAL ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· v9</div>
          </div>
          
          {fr.parsed && <Tag label={fr.firmName} color={T.purple} />}
          <AMDPhaseTag phase={currentAMD} />
          {throttleActive && <Tag label="ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â  DRAWDOWN THROTTLE" color={T.gold} />}
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LED color={complianceColor} size={8} />
            <span style={{ color: T.muted, fontSize: 11, fontWeight: 600 }}>WATCHDOG</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LED color={parsed?.totalDays >= 20 ? T.green : T.dim} size={8} pulse={false} />
            <span style={{ color: T.muted, fontSize: 11, fontWeight: 600 }}>
              {parsed ? `${parsed.totalBars.toLocaleString()} bars` : 'no data'}
            </span>
          </div>
          
          <div style={{ color: T.text, fontSize: 12, letterSpacing: 1, fontWeight: 600 }}>
            {profile?.fullName || profile?.email}
            {profile?.mobile && <span style={{ color: T.muted, fontSize: 11, marginLeft: 12 }}>ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€¦Ã‚Â¾ {formatPhoneNumber(profile.mobile)}</span>}
          </div>
          
          <button onClick={onLogout} style={{ background: "rgba(255,69,58,0.15)", border: `1px solid rgba(255,69,58,0.3)`, borderRadius: 6, padding: "8px 16px", cursor: "pointer", color: T.red, fontSize: 11, fontFamily: T.font, letterSpacing: 1, fontWeight: 700 }} className="btn-glass">
            LOGOUT
          </button>
        </div>
      </div>

  );
}
