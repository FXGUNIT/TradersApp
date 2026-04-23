import React from "react";
import { Activity, ClipboardList, Clock, Radar } from "lucide-react";
import { SectionCard } from "./SectionCard.jsx";

const BRIEFING_ACCENT = "rgba(255, 149, 0, 0.82)";

function getWindowLabel(timing, alpha) {
  return timing?.best_window || timing?.best_entry_window || alpha?.best_alpha_window || "TBD";
}

function formatPercent(value) {
  return typeof value === "number" ? `${(value * 100).toFixed(0)}%` : "TBD";
}

function getBriefingState({ timing, signal, confidence }) {
  if (timing?.enter_now) {
    return {
      label: "Active Window",
      color: "#30D158",
      summary: `Signal is ${signal || "LIVE"} with ${(confidence * 100).toFixed(0)}% confidence. Enter only on candle close and keep sizing disciplined.`,
    };
  }

  if (timing?.in_best_window) {
    return {
      label: "Window Open",
      color: "#0A84FF",
      summary: "The historical alpha window is open, but the trigger is not fully aligned yet. Stay selective and wait for confirmation.",
    };
  }

  if (typeof timing?.minutes_to_best_window === "number" && timing.minutes_to_best_window > 0) {
    return {
      label: "Preparation",
      color: "#FF9F0A",
      summary: `Best session window opens in about ${timing.minutes_to_best_window} minutes. Use the time to define levels and risk before the window arrives.`,
    };
  }

  return {
    label: "Standby",
    color: "var(--text-secondary, #8E8E93)",
    summary: "No high-quality entry window is active. Keep the plan ready, but do not force a trade outside the session edge.",
  };
}

function BriefingTile({ icon: Icon, label, value, sub }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: "11px 12px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 1.3,
          textTransform: "uppercase",
          color: "var(--text-secondary, #8E8E93)",
        }}
      >
        <Icon size={12} />
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: 11, lineHeight: 1.5, color: "var(--text-tertiary)" }}>{sub}</div>
    </div>
  );
}

export const PreSessionBriefing = React.memo(function PreSessionBriefing({
  instrument,
  session,
  timing,
  alpha,
  signal,
  confidence = 0,
}) {
  const briefing = getBriefingState({ timing, signal, confidence });
  const windowLabel = getWindowLabel(timing, alpha);

  return (
    <SectionCard title="Pre-Session Briefing" icon={ClipboardList} accent={BRIEFING_ACCENT}>
      <div style={{ display: "grid", gap: 12 }}>
        <div
          style={{
            display: "grid",
            gap: 6,
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(255, 149, 0, 0.08)",
            border: "1px solid rgba(255, 149, 0, 0.22)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: briefing.color,
            }}
          >
            {briefing.label}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-primary)" }}>{briefing.summary}</div>
          <div style={{ fontSize: 11, lineHeight: 1.6, color: "var(--text-secondary)" }}>
            {timing?.reason || "Respect candle-close discipline and only commit when session context and signal quality line up."}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <BriefingTile
            icon={Radar}
            label="Instrument"
            value={instrument?.label || instrument?.symbol || "NIFTY"}
            sub={`${instrument?.market || "Market"} · ${instrument?.timeframe || "5min"} route`}
          />
          <BriefingTile
            icon={Clock}
            label="Best Window"
            value={windowLabel}
            sub={session?.name ? `${session.name} session` : "Session timing window"}
          />
          <BriefingTile
            icon={Activity}
            label="Edge Quality"
            value={formatPercent(timing?.P_profitable_entry_now ?? alpha?.alpha_confidence)}
            sub={`Stability ${formatPercent(alpha?.alpha_stability)}`}
          />
        </div>
      </div>
    </SectionCard>
  );
});

export default PreSessionBriefing;
