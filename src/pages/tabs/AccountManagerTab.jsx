import React from 'react';
import { T } from '../../constants/theme.js';
import { cardS, glowBtn } from '../../utils/styleUtils.js';
import { SHead, Field } from '../../components/SharedUI.jsx';
import { ExchangeFacilityBadge } from '../../utils/businessLogicUtils.jsx';

export function AccountManagerTab({ fr, tcParsing, accountState, sacc, onSaveAccount, onTcDrop, showToast }) {
  return (
          <div>
            {/* Exchange Facility Badge */}
            <ExchangeFacilityBadge />

            <div style={cardS({ borderLeft: `4px solid ${T.green}` })} className="glass-panel card-tilt">
              <SHead icon="ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹" title="PROP FIRM TERMS & CONDITIONS" color={T.green} />
              <div 
                onDrop={onTcDrop} 
                onDragOver={e => e.preventDefault()} 
                onClick={() => document.getElementById('tcIn').click()} 
                style={{ border: `2px dashed ${fr.parsed ? T.green : "rgba(255,255,255,0.15)"}`, borderRadius: 10, padding: "32px", textAlign: "center", cursor: "pointer", background: "rgba(0,0,0,0.3)", marginBottom: 16, position: "relative", overflow: "hidden" }} 
                className="glass-panel"
              >
                <input id="tcIn" type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: "none" }} onChange={onTcDrop} />
                <div style={{ fontSize: 32, marginBottom: 12, opacity: fr.parsed ? 1 : 0.2 }}>
                  {fr.parsed ? "ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ" : "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹"}
                </div>
                <div style={{ color: fr.parsed ? T.green : T.muted, fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
                  {fr.parsed ? `T&C Loaded: ${fr.firmName}` : "Drop T&C document or click to browse"}
                </div>
              </div>
              
              {tcParsing && <div style={{ color: T.blue, fontSize: 12, textAlign: "center", fontWeight: 600 }}>ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â³ AI ANALYZING COMPLIANCE RULES...</div>}
              {fr.parseStatus && <div style={{ color: fr.parseStatus.startsWith('ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ') ? T.green : T.red, fontSize: 12, textAlign: "center", marginTop: 8 }}>{fr.parseStatus}</div>}
            </div>

            <div style={cardS({ borderLeft: `4px solid ${T.blue}` })} className="glass-panel card-tilt">
              <SHead icon="ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€šÃ‚Â°" title="LIVE ACCOUNT STATE" color={T.blue} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
                <Field label="STARTING BALANCE ($)" value={accountState.startingBalance} onChange={sacc('startingBalance')} type="number" mono />
                <Field label="CURRENT BALANCE ($)" value={accountState.currentBalance} onChange={sacc('currentBalance')} type="number" mono />
                <Field label="HIGH-WATER MARK ($)" value={accountState.highWaterMark} onChange={sacc('highWaterMark')} type="number" mono />
                <Field label="TODAY START BALANCE ($)" value={accountState.dailyStartBalance} onChange={sacc('dailyStartBalance')} type="number" mono />
              </div>
              <button 
                onClick={() => { if (onSaveAccount) onSaveAccount(accountState); showToast('Account state persisted to distributed ledger.', 'success'); }} 
                style={glowBtn(T.blue, false)} 
                className="btn-glass"
              >
                ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€šÃ‚Â¾ SAVE TO CLOUD
              </button>
            </div>

            {fr.parsed && (
              <div style={cardS({ borderLeft: `4px solid ${T.purple}` })} className="glass-panel card-tilt">
                <SHead icon="ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“" title="EXTRACTED FIRM RULES" color={T.purple} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
                  {fr.keyRules && fr.keyRules.map((rule, idx) => (
                    <div key={idx} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: T.muted, fontSize: 12 }}>
                      ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ {rule}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
  );
}
