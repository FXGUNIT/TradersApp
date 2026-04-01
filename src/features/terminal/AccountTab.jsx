import React from "react";
import {
  T,
  SHead,
  Tag,
  Field,
  glowBtn,
  cardS,
} from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";
import { FileText } from "lucide-react";

const LINKEDIN_URL = "https://www.linkedin.com/in/singhgunit/";
const infoTint = "var(--status-info-soft, rgba(59,130,246,0.08))";

export default function AccountTab({
  // Account state
  accountState,
  setAccountState,
  // Firm rules
  firmRules,
  tcFileName,
  tcParsing,
  // Handlers
  handleFirmRulesDrop,
  onSaveAccount,
  showToast,
}) {
  return (
    <div>
      {/* T&C Upload */}
      <div style={cardS({ borderLeft: `4px solid ${T.green}` })} className="glass-panel card-tilt">
        <SHead icon={FileText} title="PROP FIRM TERMS & CONDITIONS" color={T.green} />
        <div
          onDrop={handleFirmRulesDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => document.getElementById("tcIn")?.click()}
          style={{
            border: `2px dashed ${firmRules.parsed ? T.green : CSS_VARS.borderSubtle}`,
            borderRadius: 10,
            padding: "32px",
            textAlign: "center",
            cursor: "pointer",
            background: CSS_VARS.surfaceGlass,
            marginBottom: 16,
            position: "relative",
            overflow: "hidden",
          }}
          className="glass-panel"
        >
          <input
            id="tcIn"
            type="file"
            accept=".pdf,.txt,.doc,.docx"
            style={{ display: "none" }}
            onChange={handleFirmRulesDrop}
          />
          <div style={{ fontSize: 32, marginBottom: 12, opacity: firmRules.parsed ? 1 : 0.2 }}>
            {firmRules.parsed ? "✓" : "📋"}
          </div>
          <div
            style={{
              color: firmRules.parsed ? T.green : T.muted,
              fontSize: 13,
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            {firmRules.parsed
              ? `T&C Loaded: ${firmRules.firmName || "Firm Rules"}`
              : "Drop T&C document or click to browse"}
          </div>
          <div style={{ color: T.muted, fontSize: 11 }}>
            Best results with text-extractable files.{" "}
            {tcFileName ? `Last file: ${tcFileName}` : ""}
          </div>
        </div>

        {tcParsing && (
          <div
            style={{
              color: T.blue,
              fontSize: 12,
              textAlign: "center",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            ⟳ AI ANALYZING COMPLIANCE RULES...
          </div>
        )}

        {firmRules.parseStatus && (
          <div
            style={{
              color: String(firmRules.parseStatus).startsWith("✓") ? T.green : T.red,
              fontSize: 12,
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            {firmRules.parseStatus}
          </div>
        )}

        {firmRules.parsed && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Tag
              label={`News: ${firmRules.newsTrading ? "Allowed" : "Blocked"}`}
              color={firmRules.newsTrading ? T.green : T.red}
            />
            <Tag
              label={`Overnight: ${firmRules.overnightHoldingAllowed ? "Allowed" : "Blocked"}`}
              color={firmRules.overnightHoldingAllowed ? T.green : T.red}
            />
            <Tag
              label={`Weekend: ${firmRules.weekendTrading ? "Allowed" : "Blocked"}`}
              color={firmRules.weekendTrading ? T.green : T.red}
            />
            <Tag
              label={`Copy: ${firmRules.copyTradingAllowed ? "Allowed" : "Blocked"}`}
              color={firmRules.copyTradingAllowed ? T.green : T.red}
            />
            <Tag
              label={`Hedging: ${firmRules.hedgingAllowed ? "Allowed" : "Blocked"}`}
              color={firmRules.hedgingAllowed ? T.green : T.red}
            />
            <Tag
              label={`Min Days: ${firmRules.minimumTradingDays || "0"}`}
              color={T.blue}
            />
            <Tag
              label={`EOD Flat: ${firmRules.eodFlatRequired ? "Required" : "Optional"}`}
              color={firmRules.eodFlatRequired ? T.gold : T.muted}
            />
          </div>
        )}

        {firmRules.parsed &&
          Array.isArray(firmRules.keyRules) &&
          firmRules.keyRules.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: 12,
              }}
            >
              {firmRules.keyRules.slice(0, 10).map((rule, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "10px 14px",
                    background: CSS_VARS.surfaceGlass,
                    border: `1px solid ${CSS_VARS.borderSubtle}`,
                    borderRadius: 8,
                    color: T.muted,
                    fontSize: 12,
                  }}
                >
                  • {rule}
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Live Account State */}
      <div style={cardS({ borderLeft: `4px solid ${T.blue}` })} className="glass-panel card-tilt">
        <SHead icon="💰" title="LIVE ACCOUNT STATE" color={T.blue} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
            color: T.green,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: T.green,
              display: "inline-block",
            }}
          />
          Sync Status
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <Field
            label="STARTING BALANCE ($)"
            value={accountState.startingBalance}
            onChange={(v) => setAccountState((p) => ({ ...p, startingBalance: v }))}
            type="number"
            mono
          />
          <Field
            label="CURRENT BALANCE ($)"
            value={accountState.currentBalance}
            onChange={(v) => setAccountState((p) => ({ ...p, currentBalance: v }))}
            type="number"
            mono
          />
          <Field
            label="HIGH-WATER MARK ($)"
            value={accountState.highWaterMark}
            onChange={(v) => setAccountState((p) => ({ ...p, highWaterMark: v }))}
            type="number"
            mono
          />
          <Field
            label="TODAY START BALANCE ($)"
            value={accountState.dailyStartBalance}
            onChange={(v) => setAccountState((p) => ({ ...p, dailyStartBalance: v }))}
            type="number"
            mono
          />
        </div>
        <button
          onClick={() => {
            if (onSaveAccount) onSaveAccount(accountState);
            showToast?.("Capture engine complete.", "success");
          }}
          style={glowBtn(T.orange, false)}
          className="btn-glass"
        >
          CAPTURE ENGINE
        </button>
        <button
          onClick={() => {
            if (onSaveAccount) onSaveAccount(accountState);
            showToast("Account state persisted to distributed ledger.", "success");
          }}
          style={glowBtn(T.blue, false)}
          className="btn-glass"
        >
          💾 SAVE TO CLOUD
        </button>

        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block",
            marginTop: 14,
            padding: "16px 18px",
            borderRadius: 12,
            textDecoration: "none",
            background: `linear-gradient(135deg, ${CSS_VARS.accentGlow}, ${infoTint})`,
            border: `1px solid ${CSS_VARS.accentPrimary}`,
          }}
        >
          <div
            style={{
              color: CSS_VARS.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            Trade with Gunit Singh
          </div>
          <div style={{ color: T.muted, fontSize: 11 }}>
            Follow on LinkedIn for insights
          </div>
        </a>
      </div>
    </div>
  );
}
