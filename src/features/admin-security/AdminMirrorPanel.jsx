/* eslint-disable */
/* Auto-extracted from AdminDashboardScreen.jsx — mirror panel */
import React from "react";
import { X } from "lucide-react";

export default function AdminMirrorPanel({
  T, LED, SHead, cardS, AMD_PHASES,
  mirror, mirrorData, setMirror, setMirrorData,
  statusColor,
}) {
  if (!mirror || !mirrorData) return null;
  const journal = mirrorData.journal ? Object.values(mirrorData.journal) : [];
  const wins = journal.filter((t) => t.result === "win");
  const pnl = journal.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 0 60px", minWidth: 320 }}>
      <div style={{ padding: "16px 28px", borderBottom: "1px solid rgba(191,90,242,0.3)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.5)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LED color={T.purple} size={10} />
          <div>
            <div style={{ color: T.purple, fontSize: 13, letterSpacing: 2, fontWeight: 700 }}>MIRROR VIEW — READ ONLY</div>
            <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{mirrorData.profile?.fullName} · {mirrorData.profile?.email}</div>
          </div>
        </div>
        <button onClick={() => { setMirror(null); setMirrorData(null); }}
          style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 14px", cursor: "pointer", color: T.muted, fontSize: 10, fontFamily: T.font, fontWeight: 600 }}>
          CLOSE
        </button>
      </div>

      <div style={{ padding: "24px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[
            { l: "Account Balance", v: mirrorData.accountState?.currentBalance ? `$${parseFloat(mirrorData.accountState.currentBalance).toLocaleString()}` : "—", c: T.green },
            { l: "High-Water Mark", v: mirrorData.accountState?.highWaterMark ? `$${parseFloat(mirrorData.accountState.highWaterMark).toLocaleString()}` : "—", c: T.blue },
            { l: "Firm", v: mirrorData.firmRules?.firmName || "—", c: T.gold },
            { l: "Status", v: mirrorData.profile?.status || "—", c: (statusColor || {})[mirrorData.profile?.status] || T.muted },
          ].map((s, i) => (
            <div key={i} style={cardS({ margin: 0, textAlign: "center", padding: "16px" })}>
              <div style={{ color: T.dim, fontSize: 10, letterSpacing: 1.5, marginBottom: 8, fontWeight: 600 }}>{s.l}</div>
              <div style={{ color: s.c, fontSize: 18, fontWeight: 700, fontFamily: T.mono }}>{s.v}</div>
            </div>
          ))}
        </div>

        {!journal.length ? (
          <div style={cardS({ textAlign: "center", color: T.dim, padding: 40, fontSize: 13 })}>No journal entries yet</div>
        ) : (
          <div style={cardS({ borderLeft: `4px solid ${T.purple}`, padding: 0, overflow: "hidden" })}>
            <div style={{ padding: "20px 24px" }}>
              <SHead icon="📔" title="TRADE JOURNAL MIRROR" color={T.purple} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 20 }}>
                {[
                  { l: "Total Trades", v: journal.length, c: T.text },
                  { l: "Win Rate", v: `${Math.round((wins.length / journal.length) * 100)}%`, c: wins.length / journal.length >= 0.5 ? T.green : T.red },
                  { l: "Total P&L", v: `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`, c: pnl >= 0 ? T.green : T.red },
                ].map((s, i) => (
                  <div key={i} style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "12px", textAlign: "center" }}>
                    <div style={{ color: T.dim, fontSize: 10, marginBottom: 6, fontWeight: 600 }}>{s.l}</div>
                    <div style={{ color: s.c, fontSize: 16, fontWeight: 700, fontFamily: T.mono }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Date", "Inst", "Dir", "Type", "AMD", "RRR", "Entry", "Exit", "P&L", "Result"].map((h) => (
                      <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B7280", fontSize: 10, letterSpacing: 1, background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {journal.slice(-20).reverse().map((t, i) => {
                    const pv = parseFloat(t.pnl || 0);
                    const amdColor = (AMD_PHASES[t.amdPhase] || AMD_PHASES.UNCLEAR).color;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #E5E7EB", background: i % 2 === 0 ? "#F9FAFB" : "#FFFFFF" }}>
                        <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: 11, fontFamily: T.mono }}>{t.date}</td>
                        <td style={{ padding: "10px 14px", color: "#111827", fontSize: 11, fontWeight: 700 }}>{t.instrument}</td>
                        <td style={{ padding: "10px 14px", color: t.direction === "Long" ? "#10B981" : "#EF4444", fontSize: 11, fontWeight: 600 }}>{t.direction}</td>
                        <td style={{ padding: "10px 14px", color: "#0EA5E9", fontSize: 11, fontWeight: 500 }}>{t.tradeType}</td>
                        <td style={{ padding: "10px 14px", color: amdColor, fontSize: 10, fontWeight: 600 }}>{(AMD_PHASES[t.amdPhase]?.label || t.amdPhase || "—").slice(0, 10)}</td>
                        <td style={{ padding: "10px 14px", color: "#D97706", fontSize: 11, fontFamily: T.mono }}>{t.rrr}</td>
                        <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: 11, fontFamily: T.mono }}>{t.entry || "—"}</td>
                        <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: 11, fontFamily: T.mono }}>{t.exit || "—"}</td>
                        <td style={{ padding: "10px 14px", color: pv >= 0 ? "#10B981" : "#EF4444", fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>{pv >= 0 ? "+" : ""}${pv.toFixed(0)}</td>
                        <td style={{ padding: "10px 14px", color: t.result === "win" ? "#10B981" : t.result === "loss" ? "#EF4444" : "#6B7280", fontSize: 11, fontWeight: 800 }}>{(t.result || "—").toUpperCase()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
