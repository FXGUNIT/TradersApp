/**
 * TradeSetupPanel — extracted from TradeTab.jsx for file size compliance.
 * Trade form fields + RiskSlider + throttle warning + Entry Price.
 */
import React from "react";
import {
  T,
  Field,
  SHead,
  cardS,
  inp,
  lbl,
} from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";
import { RiskSlider } from "./RiskSlider.jsx";
import { Zap } from "lucide-react";

const warningTint = "var(--status-warning-soft, rgba(255,214,10,0.12))";

export default function TradeSetupPanel({
  f,
  sf,
  slPts,
  ptVal,
  accountState,
  drawdownType,
  throttleActive,
}) {
  return (
    <>
      {/* Trade Setup */}
      <div style={cardS({ borderLeft: `4px solid ${T.orange}` })} className="glass-panel card-tilt">
        <SHead icon={Zap} title="TRADE SETUP" color={T.orange} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          <Field
            label="TIME (IST)"
            value={f.timeIST}
            onChange={sf("timeIST")}
            options={[
              { v: "9:30", l: "9:30 AM" },
              { v: "10:00", l: "10:00 AM" },
              { v: "11:00", l: "11:00 AM" },
              { v: "12:00", l: "12:00 PM" },
            ]}
          />
          <Field
            label="INSTRUMENT"
            value={f.instrument}
            onChange={sf("instrument")}
            options={[{ v: "MNQ", l: "MNQ · $2/pt" }, { v: "MES", l: "MES · $5/pt" }]}
          />
          <Field
            label="DIRECTION"
            value={f.direction}
            onChange={sf("direction")}
            options={[{ v: "Long", l: "↑ Long" }, { v: "Short", l: "↓ Short" }]}
          />
          <Field
            label="TRADE TYPE"
            value={f.tradeType}
            onChange={sf("tradeType")}
            options={[{ v: "Trend", l: "Trend" }, { v: "MR", l: "Mean Reversion" }]}
          />
          <Field
            label="ACCOUNT BALANCE ($)"
            value={f.accountBalance}
            onChange={sf("accountBalance")}
            type="number"
            mono
          />
          <RiskSlider
            value={f.riskPct ?? "0.3"}
            onChange={sf("riskPct")}
            onCommit={(riskPct) => sf("riskPct")(riskPct)}
            currentBalance={accountState?.currentBalance}
            startingBalance={accountState?.startingBalance}
            highWaterMark={accountState?.highWaterMark}
            maxDrawdown={0}
            drawdownType={drawdownType ?? "trailing"}
            slPts={slPts ?? 0}
            ptVal={ptVal ?? 1}
            throttleActive={throttleActive ?? false}
          />
        </div>

        {throttleActive && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 16px",
              background: warningTint,
              border: `1px solid ${CSS_VARS.statusWarning}`,
              borderRadius: 6,
              color: T.gold,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ⚠ Drawdown throttle active: risk halved to {f.riskPct}%
          </div>
        )}
      </div>

      {/* Entry Price */}
      <div style={cardS()}>
        <label style={lbl}>ENTRY PRICE</label>
        <input
          type="number"
          value={f.entryPrice}
          onChange={(e) => sf("entryPrice")(e.target.value)}
          placeholder="exact entry level"
          style={inp}
          className="input-glass"
        />
      </div>
    </>
  );
}
