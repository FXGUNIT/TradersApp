import React from "react";
import { Activity, Award, Clock, Gauge } from "lucide-react";
import { SectionCard } from "./SectionCard.jsx";
import { MetricRow } from "./MetricRow.jsx";

const SESSION_NAMES = ["Pre-Market", "Main Trading", "Post-Market"];
const SESSION_COLORS = ["rgba(255,159,10,0.7)", "rgba(10,132,255,0.9)", "rgba(124,58,237,0.9)"];

function getWindowLabel(timing, alpha) {
  return timing?.best_window || timing?.best_entry_window || alpha?.best_alpha_window || "TBD";
}

function getWindowSubtext(timing) {
  if (timing?.enter_now) {
    return "Live now - enter only on candle close";
  }

  if (timing?.in_best_window) {
    return "Window is open - wait for full confirmation";
  }

  if (typeof timing?.minutes_to_best_window === "number" && timing.minutes_to_best_window > 0) {
    return `${timing.minutes_to_best_window} min until preferred window`;
  }

  return timing?.reason || "Monitor session conditions";
}

export const SessionProbabilityPanel = React.memo(function SessionProbabilityPanel({
  session,
  timing,
  alpha,
}) {
  const sessionId = session?.id ?? 1;
  const accent = SESSION_COLORS[sessionId] || SESSION_COLORS[1];
  const probabilityNow = timing?.P_profitable_entry_now ?? alpha?.alpha_confidence;

  return (
    <SectionCard title="Session Map" icon={Clock} accent={accent}>
      <MetricRow
        icon={Clock}
        label="Current Session"
        value={session?.name || SESSION_NAMES[sessionId] || "Main Trading"}
        color={accent}
      />
      <MetricRow
        icon={Activity}
        label="Session Progress"
        value={`${((session?.session_pct || 0) * 100).toFixed(0)}%`}
        sub={`${session?.minutes_into_session || 0} min elapsed`}
      />
      <MetricRow
        icon={Gauge}
        label="P(Profitable Now)"
        value={typeof probabilityNow === "number" ? `${(probabilityNow * 100).toFixed(0)}%` : "TBD"}
        sub={
          typeof alpha?.alpha_stability === "number"
            ? `Stability ${(alpha.alpha_stability * 100).toFixed(0)}%`
            : "Session edge monitor"
        }
      />
      <MetricRow
        icon={Award}
        label="Best Alpha Window"
        value={getWindowLabel(timing, alpha)}
        sub={getWindowSubtext(timing)}
      />
    </SectionCard>
  );
});

export default SessionProbabilityPanel;
