import { useState } from 'react';
import { T } from '../constants/theme.js';
import { authBtn, authCard } from '../utils/styleUtils.js';
import { AuthLogo } from './SharedUI.jsx';

export function WaitingRoom({ onRefresh, onLogout }) {
  const [checking, setChecking] = useState(false);
  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font, padding: 20 }}>
      <div style={{ ...authCard, maxWidth: 540, textAlign: "center" }} className="glass-panel">
        <AuthLogo />
        <div style={{ width: 120, height: 120, borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)" }}>
          <video
            src="/logo.mp4"
            autoPlay
            loop
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }}
            onError={(e) => {
              e.target.parentElement.innerHTML = '\u23F3';
              e.target.parentElement.style.fontSize = '48px';
              e.target.parentElement.style.display = 'flex';
              e.target.parentElement.style.alignItems = 'center';
              e.target.parentElement.style.justifyContent = 'center';
              e.target.parentElement.style.color = '#D97706';
            }}
          />
        </div>
        <div style={{ color: "#D97706", fontSize: 16, letterSpacing: 3, marginBottom: 20, fontWeight: 700 }}>
          APPLICATION PENDING
        </div>
        <div style={{ color: "#374151", fontSize: 14, lineHeight: 1.8, marginBottom: 28, padding: "20px 24px", background: "#FFFFFF", border: `1px solid #E5E7EB`, borderRadius: 12, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }}>
          It will take time to check if you are eligible to use the app or not.
        </div>
        <div style={{ color: "#6B7280", fontSize: 12, lineHeight: 1.9, marginBottom: 32 }}>
          Your application has been received and is under review by our team. You will be notified once your account is authorized. This typically takes 24-48 hours.
        </div>
        <div style={{ display: "flex", gap: 12, flexDirection: "column" }}>
          <button onClick={async () => { setChecking(true); await onRefresh(); setChecking(false); }} disabled={checking} style={authBtn("#000000", checking)} className="btn-glass">
            {checking ? "\u27F3 CHECKING STATUS..." : "\u21BA CHECK APPROVAL STATUS"}
          </button>
          <button onClick={onLogout} style={{ ...authBtn("#999999", false), background: "transparent" }} className="btn-glass">
            {"\u2190"} LOGOUT
          </button>
        </div>
      </div>
    </div>
  );
}
