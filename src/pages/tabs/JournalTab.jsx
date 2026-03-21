import React from 'react';
import { T } from '../../constants/theme.js';
import { cardS } from '../../utils/styleUtils.js';

export function JournalTab({ journal, setJournal }) {
          const wins = journal.filter(t => t.result === 'win');
          const losses = journal.filter(t => t.result === 'loss');
          const pnlTotal = journal.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
          const wr = journal.length ? (wins.length / journal.length) * 100 : 0;
          const avgWin = wins.length ? wins.reduce((s, t) => s + parseFloat(t.pnl || 0), 0) / wins.length : 0;
          const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + parseFloat(t.pnl || 0), 0) / losses.length) : 0;
          const pf = avgLoss > 0 && losses.length ? (avgWin * wins.length) / (avgLoss * losses.length) : null;

  return (
            <div>
              {/* Performance Dashboard */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
                {[
                  { l: "TOTAL P&L", v: `${pnlTotal >= 0 ? "+" : ""}$${pnlTotal.toFixed(2)}`, c: pnlTotal >= 0 ? T.green : T.red }, 
                  { l: "WIN RATE", v: `${wr.toFixed(1)}%`, c: wr >= 50 ? T.green : T.red }, 
                  { l: "PROFIT FACTOR", v: pf ? pf.toFixed(2) : "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â", c: pf && pf >= 1.5 ? T.green : pf && pf >= 1 ? T.gold : T.red }
                ].map((s, i) => (
                  <div key={i} style={cardS({ margin: 0, textAlign: "center", padding: "20px" })} className="glass-panel card-tilt">
                    <div style={{ color: T.dim, fontSize: 11, letterSpacing: 1.5, marginBottom: 8, fontWeight: 700 }}>{s.l}</div>
                    <div style={{ color: s.c, fontSize: 24, fontWeight: 800, fontFamily: T.mono }}>{s.v}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ color: T.muted, fontSize: 11, letterSpacing: 1.5, fontWeight: 700 }}>
                  TRADE HISTORY ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â {journal.length} ENTRIES
                </span>
              </div>

              {journal.length === 0 ? (
                <div style={{ background: "#FFFFFF", border: `1px solid #E5E7EB`, borderRadius: 12, padding: "60px", textAlign: "center", color: "#6B7280", fontSize: 14, fontWeight: 600, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }} className="glass-panel">
                  No trades logged yet
                </div>
              ) : (
                <div style={{ background: "#FFFFFF", border: `1px solid #E5E7EB`, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }} className="glass-panel">
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid #E5E7EB` }}>
                          {["DATE", "INST", "DIR", "TYPE", "AMD", "ENTRY", "EXIT", "P&L", "RESULT", ""].map((h, i) => (
                            <th key={i} style={{ padding: "14px 16px", textAlign: "left", color: "#6B7280", fontSize: 10, letterSpacing: 1.5, fontFamily: T.font, fontWeight: 700, whiteSpace: "nowrap", background: "#F9FAFB" }} className="gemini-gradient-text">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...journal].reverse().map((t, i) => { 
                          const pv = parseFloat(t.pnl || 0);
                          const isW = t.result === 'win';
                          const isL = t.result === 'loss';
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid #E5E7EB`, background: i % 2 === 0 ? "#F9FAFB" : "#FFFFFF" }}>
                              <td style={{ padding: "12px 16px", color: "#6B7280", fontSize: 11, whiteSpace: "nowrap", fontFamily: T.mono }}>{t.date}</td>
                              <td style={{ padding: "12px 16px", color: "#111827", fontSize: 12, fontWeight: 700 }}>{t.instrument}</td>
                              <td style={{ padding: "12px 16px" }}>
                                <span style={{ color: t.direction === 'Long' ? "#10B981" : "#EF4444", fontSize: 11, fontWeight: 600 }}>
                                  {t.direction === 'Long' ? 'BUY' : 'SELL'}
                                </span>
                              </td>
                              <td style={{ padding: "12px 16px", color: "#0EA5E9", fontSize: 11, fontWeight: 500 }}>{t.tradeType}</td>
                              <td style={{ padding: "12px 16px" }}>
                                <span style={{ color: "#D97706", fontSize: 10, fontWeight: 600 }}>{t.amdPhase?.slice(0, 10)}</span>
                              </td>
                              <td style={{ padding: "12px 16px", color: "#A1A1A6", fontSize: 11, fontFamily: T.mono }}>{t.entry || "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â"}</td>
                              <td style={{ padding: "12px 16px", color: "#A1A1A6", fontSize: 11, fontFamily: T.mono }}>{t.exit || "ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â"}</td>
                              <td style={{ padding: "12px 16px", color: pv >= 0 ? "#10B981" : "#EF4444", fontSize: 13, fontWeight: 800, fontFamily: T.mono }}>
                                {pv >= 0 ? "+" : ""}${pv.toFixed(0)}
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                <span style={{ color: isW ? "#10B981" : isL ? "#EF4444" : "#6B7280", fontSize: 11, fontWeight: 800 }}>
                                  {isW ? "WIN" : isL ? "LOSS" : "BE"}
                                </span>
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                <button 
                                  onClick={() => setJournal(prev => prev.filter((_, idx) => idx !== journal.length - 1 - i))} 
                                  style={{ background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.3)", borderRadius: 4, cursor: "pointer", color: T.red, fontSize: 10, padding: "4px 8px", fontWeight: 700 }}
                                >ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢</button>
                              </td>
                            </tr>
                          ); 
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
  );
}
