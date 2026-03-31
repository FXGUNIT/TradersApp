import React, { useMemo } from "react";
import { T } from "./terminalHelperComponents.jsx";

/**
 * VerdictRadar — SVG radar chart synthesising 5 signal verdicts.
 *
 * The polygon morphs smoothly (CSS transition on d) when scores change.
 * mix-blend-mode: screen + glow gradient for the filled shape.
 *
 * Verdict axes (each 0–1, derived from readiness panel signals):
 *   0 — Trend Strength   : ADX (0-100) → 0-1
 *   1 — VWAP Alignment : |price − vwap| / atr (closer = higher)
 *   2 — Volume Profile  : volatilityRegime → low=1, medium=0.6, high=0.3
 *   3 — AMD Conviction  : phase certainty from signals
 *   4 — Risk/Reward     : RRR ratio → normalised to 0-1
 */
export const VERDICT_LABELS = [
  "TREND",
  "VWAP",
  "VOLUME",
  "AMD",
  "RRR",
];

/**
 * Derive the 5 verdict scores from readiness panel signals.
 * All inputs come from terminalDerivedState (computed by worker — no new heavy work).
 */
export function deriveVerdictScores({
  extractedVals = {},
  volatilityRegime = "medium",
  vr = 1,
  displayedAmdPhase = "UNCLEAR",
  tradeFormRRR = "1:2",
}) {
  // 0 — Trend Strength: ADX 0-100 → 0-1
  const adx = parseFloat(extractedVals?.adx || 0);
  const trendScore = Math.min(1, adx / 50); // ADX≥50 = full score

  // 1 — VWAP Alignment: smaller gap = stronger signal
  const price = parseFloat(extractedVals?.currentPrice || 0);
  const vwap = parseFloat(extractedVals?.vwap || 0);
  const atr = parseFloat(extractedVals?.atr || 1);
  const vwapGap = atr > 0 ? Math.abs(price - vwap) / atr : 1;
  const vwapScore = Math.max(0, Math.min(1, 1 - vwapGap));

  // 2 — Volume Profile: quiet markets (low vol) are cleaner for most setups
  const volumeScore =
    volatilityRegime === "low" ? 0.95
    : volatilityRegime === "medium" ? 0.6
    : volatilityRegime === "high" ? 0.3
    : 0.5;

  // 3 — AMD Conviction: more signals = more conviction
  const convictionPhase = String(displayedAmdPhase || "UNCLEAR").toUpperCase();
  const convictionScore =
    convictionPhase === "ACCUMULATION" ? 0.9
    : convictionPhase === "MANIPULATION" ? 0.85
    : convictionPhase === "DISTRIBUTION" ? 0.8
    : convictionPhase === "TRANSITION" ? 0.5
    : 0.3; // UNCLEAR

  // 4 — Risk/Reward Quality: higher RRR = better
  const rrrParts = String(tradeFormRRR || "1:2").split(":");
  const rrrVal = parseFloat(rrrParts[1] || "2");
  const rrrScore = Math.min(1, rrrVal / 3); // RRR 3:1 = full score

  return [trendScore, vwapScore, volumeScore, convictionScore, rrrScore];
}

/**
 * Convert a score (0–1) and axis angle to x,y on a circle.
 */
function scoreToXY(score, angle, cx, cy, radius) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * score * Math.cos(rad),
    y: cy + radius * score * Math.sin(rad),
  };
}

function axisEndpoint(angle, cx, cy, radius) {
  return scoreToXY(1, angle, cx, cy, radius);
}

export default function VerdictRadar({
  scores = [0, 0, 0, 0, 0],
  labels = VERDICT_LABELS,
  size = 200,
  animated = true,
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) * 0.75;
  const n = scores.length;
  const angleStep = 360 / n;

  // Generate 5 axis angles
  const angles = Array.from({ length: n }, (_, i) => i * angleStep);

  // Build polygon points for the score shape
  const scorePoints = scores.map((score, i) => {
    const pt = scoreToXY(score, angles[i], cx, cy, radius);
    return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
  });

  // Build polygon points for each grid ring (20%, 40%, 60%, 80%, 100%)
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0].map((ring) => {
    const pts = angles.map((angle) => {
      const pt = axisEndpoint(angle, cx, cy, radius * ring);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    });
    return pts.join(" ");
  });

  // Compute average score for the overall label
  const avgScore = scores.reduce((s, v) => s + v, 0) / n;
  const overallColor =
    avgScore >= 0.7 ? T.green
    : avgScore >= 0.4 ? T.gold
    : T.red;

  const gridColor = `${T.muted}20`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        aria-label="Verdict synthesis radar"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Screen blend gradient fill for the polygon */}
          <radialGradient id="verdictFillGrad" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={T.green} stopOpacity="0.35" />
            <stop offset="60%" stopColor={T.blue} stopOpacity="0.20" />
            <stop offset="100%" stopColor={T.purple} stopOpacity="0.10" />
          </radialGradient>

          {/* Glow filter for the polygon edge */}
          <filter id="verdictGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Grid rings ── */}
        {rings.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke={gridColor}
            strokeWidth={i === 4 ? 1.5 : 0.5}
            opacity={i === 4 ? 0.6 : 0.4}
          />
        ))}

        {/* ── Axis lines ── */}
        {angles.map((angle, i) => {
          const ep = axisEndpoint(angle, cx, cy, radius);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={ep.x.toFixed(1)}
              y2={ep.y.toFixed(1)}
              stroke={gridColor}
              strokeWidth={0.5}
              opacity={0.5}
            />
          );
        })}

        {/* ── Score polygon with glow ── */}
        <polygon
          points={scorePoints.join(" ")}
          fill="url(#verdictFillGrad)"
          stroke={overallColor}
          strokeWidth={2}
          strokeLinejoin="round"
          filter="url(#verdictGlow)"
          opacity={0.9}
          style={{
            transition: animated
              ? "points 0.5s ease, stroke 0.3s ease, fill 0.3s ease"
              : "none",
          }}
        />

        {/* ── Score dots on each axis ── */}
        {scores.map((score, i) => {
          const pt = scoreToXY(score, angles[i], cx, cy, radius);
          const labelPt = axisEndpoint(angles[i], cx, cy, radius + 16);
          const scoreColor =
            score >= 0.7 ? T.green
            : score >= 0.4 ? T.gold
            : T.red;

          return (
            <g key={i}>
              <circle
                cx={pt.x.toFixed(1)}
                cy={pt.y.toFixed(1)}
                r={score >= 0.7 ? 4 : 3}
                fill={scoreColor}
                style={{
                  filter: `drop-shadow(0 0 4px ${scoreColor})`,
                  transition: "all 0.5s ease",
                }}
              />
              {/* Axis label */}
              <text
                x={labelPt.x}
                y={labelPt.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={T.muted}
                fontSize={7.5}
                fontFamily={T.font}
                fontWeight={700}
                letterSpacing={1}
              >
                {labels[i]}
              </text>
              {/* Score value */}
              <text
                x={pt.x.toFixed(1)}
                y={(pt.y + (labelPt.y - pt.y) * 0.4).toFixed(1)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={scoreColor}
                fontSize={7}
                fontFamily={T.mono}
                fontWeight={800}
                style={{ transition: "fill 0.5s ease" }}
              >
                {(score * 100).toFixed(0)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Overall verdict badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 14px",
          background: `${overallColor}15`,
          border: `1px solid ${overallColor}40`,
          borderRadius: 20,
        }}
      >
        <span
          style={{
            color: overallColor,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 2,
          }}
        >
          VERDICT{" "}
          {(avgScore * 100).toFixed(0)}
          %
        </span>
        <span style={{ color: T.muted, fontSize: 9, fontWeight: 600 }}>
          {avgScore >= 0.7
            ? "HIGH CONFIDENCE"
            : avgScore >= 0.4
              ? "MODERATE"
              : "LOW CONVICTION"}
        </span>
      </div>
    </div>
  );
}
