/**
 * TerminalNav — extracted from MainTerminal.jsx for file size compliance.
 * Contains: quote banner + navigation tabs + autosave bar + action buttons.
 */
import React from "react";
import { T, glowBtn } from "./terminalStyles.js";
import { CSS_VARS } from "../../styles/cssVars.js";

export function QuoteBanner({ activeQuote }) {
  return (
    <div style={{
      padding: "14px 32px",
      background: `linear-gradient(90deg, ${CSS_VARS.accentGlow}, transparent)`,
      borderBottom: `1px solid ${CSS_VARS.borderSubtle}`,
    }}>
      <div style={{
        maxWidth: 1440,
        margin: "0 auto",
        color: T.blue,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.7,
        letterSpacing: 0.2,
      }}>
        {activeQuote}
      </div>
    </div>
  );
}

export function NavigationTabs({ activeTab, onTabChange }) {
  return (
    <div style={{
      background: CSS_VARS.card,
      borderBottom: `1px solid ${CSS_VARS.borderSubtle}`,
      padding: "0 32px",
      display: "flex",
      gap: 0,
      overflowX: "auto",
      boxShadow: "none"
    }}>
      {[
        { id: 'premarket', label: 'MORNING BRIEFING', sub: 'AMD · Macro · Fuel', color: T.blue },
        { id: 'trade', label: 'TRADE EXECUTION', sub: 'AMD-Exec · Compliance', color: T.orange },
        { id: 'journal', label: 'JOURNAL', sub: 'AMD Stats · P&L', color: T.purple },
        { id: 'account', label: 'ACCOUNT', sub: 'T&C · Drawdown · Rules', color: T.green }
      ].map(p => (
        <button
          key={p.id}
          type="button"
          onClick={() => {
            onTabChange(p.id);
          }}
          aria-label={
            p.id === "premarket" ? "Premarket"
              : p.id === "trade" ? "Trade"
              : p.id === "journal" ? "Journal"
              : p.id === "account" ? "Account"
              : p.label
          }
          style={{
            background: "transparent",
            border: "none",
            fontFamily: T.font,
            borderBottom: activeTab === p.id ? `3px solid ${p.color}` : "3px solid transparent",
            padding: "16px 24px",
            cursor: "pointer",
            marginBottom: -1,
            textAlign: "left",
            whiteSpace: "nowrap"
          }}
          className="btn-glass"
        >
          <div
            id={`tab-${p.id}-label`}
            style={{ color: activeTab === p.id ? p.color : CSS_VARS.textSecondary, fontSize: 12, letterSpacing: 1.5, fontWeight: 800 }}
          >
            {p.label}
          </div>
          <div aria-hidden="true" style={{ color: activeTab === p.id ? p.color : CSS_VARS.textSecondary, fontSize: 10, marginTop: 4, fontWeight: 500 }}>
            {p.sub}
          </div>
        </button>
      ))}
    </div>
  );
}

export function AutosaveBar({ draftStatus, onNavigateToConsciousness, onUndoLastChange, onResetPage, onResetAll, canUndo, activeTab, onDeleteJournalHistory, tabResetScope }) {
  return (
    <div style={{
      marginBottom: 16,
      padding: "14px 18px",
      borderRadius: 12,
      background: CSS_VARS.card,
      border: `1px solid ${CSS_VARS.borderSubtle}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    }}
    className="glass-panel"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{
          color: T.blue,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}>
          Autosave Vault
        </span>
        <span style={{ color: T.muted, fontSize: 12, lineHeight: 1.5 }}>
          {draftStatus.error
            ? `Autosave issue: ${draftStatus.error}`
            : `Saved at ${draftStatus.lastSavedAt ? new Date(draftStatus.lastSavedAt).toLocaleTimeString() : '—'}. Refresh-safe draft sync is active for this account.`}
        </span>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {typeof onNavigateToConsciousness === "function" && (
          <button
            type="button"
            onClick={onNavigateToConsciousness}
            style={glowBtn(T.purple, false)}
            className="btn-glass"
          >
            OPEN COLLECTIVE CONSCIOUSNESS
          </button>
        )}
        <button
          type="button"
          onClick={onUndoLastChange}
          disabled={!canUndo}
          style={glowBtn(T.blue, !canUndo)}
          className="btn-glass"
        >
          ↺ UNDO LAST CHANGE
        </button>
        <button
          type="button"
          onClick={() => onResetPage(tabResetScope)}
          style={glowBtn(T.red, false)}
          className="btn-glass"
        >
          RESET THIS PAGE
        </button>
        {activeTab === "journal" && (
          <button
            type="button"
            onClick={onDeleteJournalHistory}
            style={glowBtn(T.red, false)}
            className="btn-glass"
          >
            DELETE JOURNAL HISTORY
          </button>
        )}
        <button
          type="button"
          onClick={onResetAll}
          style={glowBtn(T.gold, false)}
          className="btn-glass"
        >
          CLEAR FULL WORKSPACE
        </button>
      </div>
    </div>
  );
}

export function DrawdownThrottleBanner({ throttleActive, activeRiskPct }) {
  if (!throttleActive) return null;
  return (
    <div style={{
      padding: "14px 20px",
      background: "var(--status-warning-soft, rgba(255,214,10,0.12))",
      border: `2px solid ${T.gold}`,
      borderRadius: 8,
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}>
      <span style={{ fontSize: 20 }}>⚠</span>
      <div>
        <div style={{ color: T.gold, fontSize: 13, fontWeight: 800, letterSpacing: 1 }}>
          DRAWDOWN THROTTLE ACTIVE: RISK HALVED TO PROTECT CAPITAL
        </div>
        <div style={{ color: CSS_VARS.statusWarning, fontSize: 11, marginTop: 3 }}>
          Distance to liquidation within 25% of max drawdown. Size reduced to {activeRiskPct}%.
        </div>
      </div>
    </div>
  );
}
