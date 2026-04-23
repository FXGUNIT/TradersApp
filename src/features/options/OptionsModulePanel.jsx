import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { ExpiryAdvisor } from "./ExpiryAdvisor.jsx";
import { GreeksDisplayPanel } from "./GreeksDisplayPanel.jsx";
import { fetchOptionsChain, fetchOptionsExpiries } from "./optionsGateway.js";
import {
  buildExpiryPlan,
  buildFallbackStrikeRows,
  getAtmRow,
  getBiasLeg,
  getOptionsUnderlying,
  getSpotPrice,
  getVolRegimeSummary,
} from "./optionsMetrics.js";
import { OptionsStrikePanel } from "./OptionsStrikePanel.jsx";
import { PositionRiskCard } from "./PositionRiskCard.jsx";
import { VolRegimeIndicator } from "./VolRegimeIndicator.jsx";

export const OptionsModulePanel = React.memo(function OptionsModulePanel({
  activeInstrument,
  consensus,
}) {
  const underlying = useMemo(
    () => getOptionsUnderlying(activeInstrument),
    [activeInstrument],
  );
  const [expiries, setExpiries] = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState("");
  const [chainRows, setChainRows] = useState([]);
  const [chainSource, setChainSource] = useState("unavailable");
  const [loadingExpiries, setLoadingExpiries] = useState(false);
  const [loadingChain, setLoadingChain] = useState(false);
  const [error, setError] = useState(null);

  const loadExpiries = useCallback(async () => {
    setLoadingExpiries(true);
    setError(null);

    try {
      const result = await fetchOptionsExpiries({ symbol: underlying, count: 6 });
      const nextExpiries = Array.isArray(result?.expiries) ? result.expiries : [];
      setExpiries(nextExpiries);
      setSelectedExpiry((current) => {
        if (current && nextExpiries.some((expiry) => expiry.date === current)) {
          return current;
        }
        return nextExpiries[0]?.date || "";
      });
      if (result?.success === false) {
        setError(result?.error || "Options expiry feed unavailable.");
      }
    } catch (err) {
      setError(err?.message || "Options expiry feed unavailable.");
      setExpiries([]);
      setSelectedExpiry("");
    } finally {
      setLoadingExpiries(false);
    }
  }, [underlying]);

  const loadChain = useCallback(async () => {
    if (!selectedExpiry) {
      setChainRows([]);
      setChainSource("unavailable");
      return;
    }

    setLoadingChain(true);
    setError(null);

    try {
      const result = await fetchOptionsChain({
        symbol: underlying,
        expiry: selectedExpiry,
        strikeCount: 18,
        includeGreeks: true,
      });
      setChainRows(Array.isArray(result?.chain) ? result.chain : []);
      setChainSource(result?.source || "unavailable");
      if (result?.success === false) {
        setError(result?.error || "Live option chain unavailable.");
      }
    } catch (err) {
      setChainRows([]);
      setChainSource("unavailable");
      setError(err?.message || "Live option chain unavailable.");
    } finally {
      setLoadingChain(false);
    }
  }, [selectedExpiry, underlying]);

  useEffect(() => {
    loadExpiries();
  }, [loadExpiries]);

  useEffect(() => {
    loadChain();
  }, [loadChain]);

  const featureVector = consensus?.feature_vector || {};
  const spotPrice = useMemo(
    () => getSpotPrice({ chain: chainRows, featureVector }),
    [chainRows, featureVector],
  );
  const atmRow = useMemo(() => getAtmRow(chainRows, spotPrice), [chainRows, spotPrice]);
  const ladderRows = useMemo(() => {
    if (atmRow && chainRows.length > 0) {
      const atmIndex = chainRows.findIndex((row) => row?.strike === atmRow?.strike);
      const start = Math.max(0, atmIndex - 2);
      const end = Math.min(chainRows.length, atmIndex + 3);
      return chainRows.slice(start, end);
    }

    return buildFallbackStrikeRows(spotPrice, underlying);
  }, [atmRow, chainRows, spotPrice, underlying]);
  const biasLeg = useMemo(
    () => getBiasLeg({ atmRow, signal: consensus?.signal }),
    [atmRow, consensus?.signal],
  );
  const expiryPlan = useMemo(
    () =>
      buildExpiryPlan({
        expiries,
        timing: consensus?.timing,
        signal: consensus?.signal,
      }),
    [expiries, consensus?.timing, consensus?.signal],
  );
  const volRegime = useMemo(
    () => getVolRegimeSummary({ featureVector, chain: chainRows }),
    [featureVector, chainRows],
  );

  return (
    <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
      <div
        style={{
          display: "grid",
          gap: 10,
          padding: "14px 16px",
          borderRadius: 16,
          background:
            "radial-gradient(circle at top left, rgba(124,58,237,0.16), transparent 38%), rgba(255,255,255,0.03)",
          border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1.6,
                textTransform: "uppercase",
                color: "var(--aura-amd-manipulation, #7C3AED)",
              }}
            >
              Options Module
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
              {underlying} derivatives deck
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {spotPrice !== null
                ? `Spot reference ${new Intl.NumberFormat("en-IN", {
                    maximumFractionDigits: 2,
                  }).format(spotPrice)}`
                : "Spot reference waiting on the live chain or feature vector close."}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              loadExpiries();
              loadChain();
            }}
            disabled={loadingExpiries || loadingChain}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(124,58,237,0.45)",
              background: "rgba(124,58,237,0.08)",
              color: "var(--aura-amd-manipulation, #7C3AED)",
              fontSize: 11,
              fontWeight: 700,
              cursor: loadingExpiries || loadingChain ? "default" : "pointer",
            }}
          >
            <RefreshCw
              size={12}
              style={{ animation: loadingExpiries || loadingChain ? "cc-spin 1s linear infinite" : "none" }}
            />
            Refresh
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {expiries.map((expiry) => {
            const active = expiry.date === selectedExpiry;
            return (
              <button
                key={expiry.date}
                type="button"
                onClick={() => setSelectedExpiry(expiry.date)}
                style={{
                  borderRadius: 999,
                  border: active
                    ? "1px solid rgba(10,132,255,0.65)"
                    : "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
                  background: active ? "rgba(10,132,255,0.12)" : "rgba(255,255,255,0.03)",
                  color: active ? "var(--aura-status-info, #0A84FF)" : "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "8px 12px",
                  cursor: "pointer",
                }}
              >
                {expiry.date}
                {typeof expiry.daysUntil === "number" ? ` - ${expiry.daysUntil}d` : ""}
              </button>
            );
          })}
        </div>

        {error ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(255,159,10,0.08)",
              border: "1px solid rgba(255,159,10,0.24)",
              fontSize: 11,
              lineHeight: 1.6,
              color: "var(--text-secondary)",
            }}
          >
            <AlertTriangle size={14} color="#FF9F0A" />
            {error}
          </div>
        ) : null}
      </div>

      <div className="cc-dashboard-grid cc-dashboard-grid--secondary">
        <OptionsStrikePanel
          rows={ladderRows}
          atmStrike={atmRow?.strike ?? null}
          selectedExpiry={selectedExpiry}
          chainSource={chainSource}
        />
        <GreeksDisplayPanel atmRow={atmRow} chainSource={chainSource} />
      </div>

      <div className="cc-dashboard-grid cc-dashboard-grid--secondary">
        <ExpiryAdvisor
          plan={expiryPlan}
          signal={consensus?.signal}
          timing={consensus?.timing}
        />
        <PositionRiskCard
          symbol={underlying}
          signal={consensus?.signal}
          biasLeg={biasLeg}
          positionSizing={consensus?.position_sizing}
        />
        <VolRegimeIndicator
          regime={volRegime}
          expectedMove={consensus?.expected_move}
        />
      </div>
    </div>
  );
});

export default OptionsModulePanel;
