import React from "react";
import { AMD_PHASES, SHead, T, cardS } from "./terminalHelperComponents";

export default function TerminalJournalOverview({
  equityCurveView,
  isJournalMetricsPending = false,
  metrics,
}) {
  return (
    <>
      {isJournalMetricsPending && (
        <div style={{ color: T.blue, fontSize: 11, marginBottom: 10 }}>
          Updating journal metrics...
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {[
          {
            l: "TOTAL P&L",
            v: `${metrics.pnlTotal >= 0 ? "+" : ""}$${metrics.pnlTotal.toFixed(2)}`,
            c: metrics.pnlTotal >= 0 ? T.green : T.red,
            sub: metrics.totalCommission > 0
              ? `Net (inc. routing): ${metrics.netPnlTotal >= 0 ? "+" : ""}$${metrics.netPnlTotal.toFixed(2)} · −$${metrics.totalCommission.toFixed(2)} fees`
              : null,
          },
          {
            l: "WIN RATE",
            v: `${metrics.wr.toFixed(1)}%`,
            c: metrics.wr >= 50 ? T.green : T.red,
          },
          {
            l: "PROFIT FACTOR",
            v: metrics.pf ? metrics.pf.toFixed(2) : "—",
            c:
              metrics.pf && metrics.pf >= 1.5
                ? T.green
                : metrics.pf && metrics.pf >= 1
                  ? T.gold
                  : T.red,
          },
          {
            l: "PREDICTION ACCURACY (L5)",
            v: `${metrics.predictionAccuracyL5 ? metrics.predictionAccuracyL5.toFixed(1) : "0.0"}%`,
            c:
              metrics.predictionAccuracyL5 >= 85
                ? T.green
                : metrics.predictionAccuracyL5 >= 70
                  ? T.gold
                  : T.red,
            sub: metrics.recentAccuracies.length
              ? metrics.recentAccuracies.map((value) => `${value.toFixed(0)}%`).join(" | ")
              : "No accuracy samples yet",
          },
        ].map((stat, index) => (
          <div
            key={index}
            style={cardS({ margin: 0, textAlign: "center", padding: "20px" })}
            className="glass-panel card-tilt"
          >
            <div
              style={{
                color: T.dim,
                fontSize: 11,
                letterSpacing: 1.5,
                marginBottom: 8,
                fontWeight: 700,
              }}
            >
              {stat.l}
            </div>
            <div
              style={{
                color: stat.c,
                fontSize: 24,
                fontWeight: 800,
                fontFamily: T.mono,
              }}
            >
              {stat.v}
            </div>
            {stat.sub && (
              <div
                style={{
                  color: T.muted,
                  fontSize: 10,
                  marginTop: 8,
                  lineHeight: 1.4,
                  fontWeight: 500,
                }}
              >
                {stat.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={cardS({ margin: 0, padding: "18px 20px" })}
          className="glass-panel card-tilt"
        >
          <SHead icon="▣" title="AMD PERFORMANCE BREAKDOWN" color={T.purple} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 10,
            }}
          >
            {metrics.amdBreakdown.map((bucket) => {
              const color = AMD_PHASES[bucket.phase]?.color || T.muted;
              return (
                <div
                  key={bucket.phase}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: `${color}12`,
                    border: `1px solid ${color}26`,
                  }}
                >
                  <div
                    style={{
                      color,
                      fontSize: 10,
                      letterSpacing: 1.2,
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    {bucket.label}
                  </div>
                  <div
                    style={{
                      color: T.text,
                      fontSize: 22,
                      fontFamily: T.mono,
                      fontWeight: 800,
                      marginTop: 4,
                    }}
                  >
                    {bucket.trades}
                  </div>
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      marginTop: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    {bucket.wins}W / {bucket.losses}L
                  </div>
                  <div style={{ color, fontSize: 11, fontWeight: 700, marginTop: 6 }}>
                    {bucket.wr.toFixed(0)}% WR
                  </div>
                  <div
                    style={{
                      color: bucket.pnl >= 0 ? T.green : T.red,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {bucket.pnl >= 0 ? "+" : ""}${bucket.pnl.toFixed(0)}
                  </div>
                </div>
              );
            })}
          </div>
          {metrics.bestAmdPhase && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(0,0,0,0.08)",
                color: T.muted,
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: T.gold, fontWeight: 800 }}>Best phase:</span>{" "}
              {metrics.bestAmdPhase.label} with {metrics.bestAmdPhase.wr.toFixed(1)}%
              {" "}win rate across {metrics.bestAmdPhase.trades} trades.
            </div>
          )}
        </div>

        <div
          style={cardS({ margin: 0, padding: "18px 20px" })}
          className="glass-panel card-tilt"
        >
          <SHead icon="≈" title="EQUITY CURVE" color={T.blue} />
          {equityCurveView.dots.length === 0 ? (
            <div style={{ color: T.muted, fontSize: 12, padding: "20px 0" }}>
              No equity data yet
            </div>
          ) : (
            <div>
              <svg
                viewBox="0 0 360 100"
                width="100%"
                height="100"
                role="img"
                aria-label="Equity curve"
              >
                <defs>
                  <linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={T.blue} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={T.blue} stopOpacity="0.02" />
                  </linearGradient>
                  {/* Gradient for the gap fill between equity and HWM */}
                  <linearGradient id="hwmGapFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={T.red} stopOpacity="0.12" />
                    <stop offset="100%" stopColor={T.red} stopOpacity="0.03" />
                  </linearGradient>
                </defs>
                <rect
                  x="0"
                  y="0"
                  width="360"
                  height="100"
                  rx="12"
                  fill="rgba(0,0,0,0.03)"
                />

                {/* Ghost HWM area fill (the drawdown gap) */}
                {equityCurveView.hwmPath && (
                  <>
                    {/* Fill gap from equity line down to HWM */}
                    <path
                      d={`${equityCurveView.path} L ${equityCurveView.hwmDots[equityCurveView.hwmDots.length - 1]?.x.toFixed(2)} ${equityCurveView.hwmDots[equityCurveView.hwmDots.length - 1]?.y.toFixed(2)} L ${equityCurveView.hwmDots[0]?.x.toFixed(2)} ${equityCurveView.hwmDots[0]?.y.toFixed(2)} Z`}
                      fill="url(#hwmGapFill)"
                      opacity="0.6"
                    />
                    {/* Ghost HWM line — barely visible (opacity 0.18) */}
                    <path
                      d={equityCurveView.hwmPath}
                      fill="none"
                      stroke={T.red}
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      opacity="0.2"
                      strokeDasharray="4 3"
                    />
                  </>
                )}

                <path
                  d={`${equityCurveView.path} L 346 86 L 14 86 Z`}
                  fill="url(#equityFill)"
                  opacity="0.9"
                />
                <path
                  d={equityCurveView.path}
                  fill="none"
                  stroke={metrics.pnlTotal >= 0 ? T.green : T.red}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {equityCurveView.dots.map((point) => (
                  <circle
                    key={`${point.index}-${point.tradeLabel}`}
                    cx={point.x}
                    cy={point.y}
                    r="3.8"
                    fill={
                      point.result === "win"
                        ? T.green
                        : point.result === "loss"
                          ? T.red
                          : T.gold
                    }
                  >
                    <title>{`${point.tradeLabel}: ${point.cumulativePnl >= 0 ? "+" : ""}$${point.cumulativePnl.toFixed(2)}`}</title>
                  </circle>
                ))}
              </svg>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  marginTop: 8,
                  color: T.muted,
                  fontSize: 10,
                }}
              >
                <span>Start $0</span>
                <span>
                  {equityCurveView.max >= 0
                    ? `High +$${equityCurveView.max.toFixed(0)}`
                    : `Low -$${Math.abs(equityCurveView.min).toFixed(0)}`}
                </span>
                <span>
                  End {metrics.netPnlTotal >= 0 ? "+" : ""}${metrics.netPnlTotal.toFixed(0)}
                  {metrics.totalCommission > 0 && (
                    <span style={{ opacity: 0.6 }}> net</span>
                  )}
                </span>
              </div>
              {/* HWM ghost legend */}
              {equityCurveView.hwmPath && (
                <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 16, height: 1.5, background: `${T.red}35`, borderTop: `1.5px dashed ${T.red}50`, opacity: 0.5 }} />
                    <span style={{ color: `${T.red}80`, fontSize: 9, letterSpacing: 1 }}>HWM (Ghost)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 10, height: 10, background: `${T.red}15`, border: `1px solid ${T.red}30`, borderRadius: 2 }} />
                    <span style={{ color: `${T.red}80`, fontSize: 9, letterSpacing: 1 }}>Drawdown zone</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
