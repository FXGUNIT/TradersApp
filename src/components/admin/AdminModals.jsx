import React from 'react';
import { T, AMD_PHASES } from '../../constants/theme.js';
import { cardS, authBtn } from '../../utils/styleUtils.js';
import { LED, SHead } from '../../components/SharedUI.jsx';

// RULE #92: Mirror View for selected user - read-only data panel
export function AdminMirrorModal({ mirror, mirrorData, setMirror, setMirrorData }) {
  if (!mirror || !mirrorData) return null;
  const statusColor = { ACTIVE: T.green, PENDING: T.gold, BLOCKED: T.red };
  return (
          <div style={{ flex: 1, overflowY: "auto", padding: "0 0 60px", minWidth: 320 }}>
            
            <div style={{ padding: "16px 28px", borderBottom: `1px solid rgba(191,90,242,0.3)`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.5)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(20px)" }} className="glass-panel">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <LED color={T.purple} size={10} />
                <div>
                  <div style={{ color: T.purple, fontSize: 13, letterSpacing: 2, fontWeight: 700 }}>MIRROR VIEW ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â READ ONLY</div>
                  <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{mirrorData.profile?.fullName} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· {mirrorData.profile?.email}</div>
                </div>
              </div>
              <button onClick={() => { setMirror(null); setMirrorData(null); }} style={{ background: "transparent", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", color: T.muted, fontSize: 10, fontFamily: T.font, fontWeight: 600 }} className="btn-glass">
                ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ CLOSE
              </button>
            </div>
            
            <div style={{ padding: "24px 28px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 24 }}>
                {[ 
                  { l: "Account Balance", v: mirrorData.accountState?.currentBalance ? `$${parseFloat(mirrorData.accountState.currentBalance).toLocaleString()}` : "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â", c: T.green }, 
                  { l: "High-Water Mark", v: mirrorData.accountState?.highWaterMark ? `$${parseFloat(mirrorData.accountState.highWaterMark).toLocaleString()}` : "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â", c: T.blue }, 
                  { l: "Firm", v: mirrorData.firmRules?.firmName || "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â", c: T.gold }, 
                  { l: "Status", v: mirrorData.profile?.status || "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â", c: statusColor[mirrorData.profile?.status] || T.muted }, 
                ].map((s, i) => (
                  <div key={i} style={cardS({ margin: 0, textAlign: "center", padding: "16px" })} className="glass-panel">
                    <div style={{ color: T.dim, fontSize: 10, letterSpacing: 1.5, marginBottom: 8, fontWeight: 600 }}>{s.l}</div>
                    <div style={{ color: s.c, fontSize: 18, fontWeight: 700, fontFamily: T.mono }}>{s.v}</div>
                  </div>
                ))}
              </div>
              
              {(() => { 
                const journal = mirrorData.journal ? Object.values(mirrorData.journal) : []; 
                if (!journal.length) return <div style={cardS({ textAlign: "center", color: T.dim, padding: 40, fontSize: 13 })} className="glass-panel">No journal entries yet</div>; 
                
                const wins = journal.filter(t => t.result === 'win'); 
                const pnl = journal.reduce((s, t) => s + parseFloat(t.pnl || 0), 0); 
                
                return (
                  <div style={cardS({ borderLeft: `4px solid ${T.purple}`, padding: 0, overflow: "hidden" })} className="glass-panel">
                    <div style={{ padding: "20px 24px" }}>
                      <SHead icon="ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã‚Â" title="TRADE JOURNAL MIRROR" color={T.purple} />
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 20 }}>
                        {[
                          { l: "Total Trades", v: journal.length, c: T.text }, 
                          { l: "Win Rate", v: `${Math.round(wins.length / journal.length * 100)}%`, c: wins.length / journal.length >= 0.5 ? T.green : T.red }, 
                          { l: "Total P&L", v: `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`, c: pnl >= 0 ? T.green : T.red }
                        ].map((s, i) => (
                          <div key={i} style={{ background: "rgba(0,0,0,0.3)", border: `1px solid rgba(255,255,255,0.05)`, borderRadius: 8, padding: "12px", textAlign: "center" }} className="glass-panel">
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
                            {["Date", "Inst", "Dir", "Type", "AMD", "RRR", "Entry", "Exit", "P&L", "Result"].map(h => (
                              <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B7280", fontSize: 10, letterSpacing: 1, background: "#F9FAFB", borderBottom: `1px solid #E5E7EB`, whiteSpace: "nowrap", fontWeight: 700 }} className="gemini-gradient-text">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {journal.slice(-20).reverse().map((t, i) => { 
                            const pv = parseFloat(t.pnl || 0); 
                            const amdColor = (AMD_PHASES[t.amdPhase] || AMD_PHASES.UNCLEAR).color; 
                            return (
                              <tr key={i} style={{ borderBottom: `1px solid #E5E7EB`, background: i % 2 === 0 ? "#F9FAFB" : "#FFFFFF" }}>
                                <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: 11, fontFamily: T.mono }}>{t.date}</td>
                                <td style={{ padding: "10px 14px", color: "#111827", fontSize: 11, fontWeight: 700 }}>{t.instrument}</td>
                                <td style={{ padding: "10px 14px", color: t.direction === 'Long' ? "#10B981" : "#EF4444", fontSize: 11, fontWeight: 600 }}>{t.direction}</td>
                                <td style={{ padding: "10px 14px", color: "#0EA5E9", fontSize: 11, fontWeight: 500 }}>{t.tradeType}</td>
                                <td style={{ padding: "10px 14px", color: amdColor, fontSize: 10, fontWeight: 600 }}>{(AMD_PHASES[t.amdPhase]?.label || t.amdPhase || "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â").slice(0, 10)}</td>
                                <td style={{ padding: "10px 14px", color: "#D97706", fontSize: 11, fontFamily: T.mono }}>{t.rrr}</td>
                                <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: 11, fontFamily: T.mono }}>{t.entry || "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â"}</td>
                                <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: 11, fontFamily: T.mono }}>{t.exit || "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â"}</td>
                                <td style={{ padding: "10px 14px", color: pv >= 0 ? "#10B981" : "#EF4444", fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>{pv >= 0 ? "+" : ""}${pv.toFixed(0)}</td>
                                <td style={{ padding: "10px 14px", color: t.result === 'win' ? "#10B981" : t.result === 'loss' ? "#EF4444" : "#6B7280", fontSize: 11, fontWeight: 800 }}>{(t.result || "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â").toUpperCase()}</td>
                              </tr>
                            ); 
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                  </div>
                ); 
              })()}
            </div>
          </div>
  );
}

// RULE #24: Identity Documents Viewer - fixed overlay
export function AdminIdentityDocsModal({ selectedUserDocs, setSelectedUserDocs, searchFilteredUsers }) {
  if (!selectedUserDocs) return null;
  return (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)'
          }}>
            <div style={{
              background: 'rgba(20,20,20,0.95)',
              border: `1px solid ${T.green}40`,
              borderRadius: 12,
              padding: 28,
              maxWidth: 600,
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: `0 0 40px rgba(52,199,89,0.2)`,
              backdropFilter: 'blur(10px)'
            }} className="glass-panel">
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
                paddingBottom: 16,
                borderBottom: `1px solid ${T.green}30`
              }}>
                <div style={{
                  color: T.green,
                  fontSize: 14,
                  letterSpacing: 2,
                  fontWeight: 700
                }}>
                  ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾ IDENTITY DOCUMENTS (RULE #24)
                </div>
                <button
                  onClick={() => setSelectedUserDocs(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: T.muted,
                    fontSize: 20,
                    cursor: 'pointer',
                    padding: '4px 8px'
                  }}
                >
                  ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢
                </button>
              </div>
              
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: T.muted, fontSize: 12, marginBottom: 12, fontWeight: 600 }}>
                  User: {searchFilteredUsers.find(([uid]) => uid === selectedUserDocs)?.[1]?.fullName || 'Unknown'}
                </div>
                
                <div style={{
                  padding: 16,
                  background: 'rgba(52,199,89,0.1)',
                  borderRadius: 8,
                  border: `1px solid ${T.green}30`,
                  minHeight: 120,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 12
                }}>
                  <div style={{ color: T.green, fontSize: 14 }}>ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â</div>
                  <div style={{ color: T.muted, fontSize: 12, textAlign: 'center' }}>
                    Identity documents for this user will appear here.<br/>
                    <span style={{ fontSize: 11, color: T.dim }}>(Currently uploaded documents from Aadhar, Passport, License, PAN)</span>
                  </div>
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setSelectedUserDocs(null)}
                  style={{
                    ...authBtn(T.muted, false),
                    background: 'transparent'
                  }}
                  className="btn-glass"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
  );
}
