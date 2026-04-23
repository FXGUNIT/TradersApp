import React from "react";
import { Activity, Award, Clock } from "lucide-react";
import { SectionCard } from "./SectionCard.jsx";
import { MetricRow } from "./MetricRow.jsx";

function getBestWindowLabel(timing) {
  return timing?.best_window || timing?.best_entry_window || "TBD";
}

export const TimingRecommendation = React.memo(function TimingRecommendation({ timing }) {
  if (!timing) return null;

  return (
    <SectionCard title="Entry Timing" icon={Clock} accent="rgba(10,132,255,0.8)">
      <MetricRow
        icon={Clock}
        label="Enter Now"
        value={timing.enter_now ? "YES" : "WAIT"}
        color={timing.enter_now ? "#30D158" : "#FF453A"}
      />
      <MetricRow
        icon={Activity}
        label="P(Profitable Now)"
        value={`${((timing.P_profitable_entry_now || 0.5) * 100).toFixed(0)}%`}
      />
      <MetricRow
        icon={Award}
        label="Best Window"
        value={getBestWindowLabel(timing)}
        sub={
          typeof timing.minutes_to_best_window === "number" && timing.minutes_to_best_window > 0
            ? `${timing.minutes_to_best_window} min until preferred setup`
            : undefined
        }
      />
      {timing.candle_close_entry !== false && (
        <MetricRow
          icon={Clock}
          label="Wait for Candle Close"
          value="ALWAYS"
          sub="Never enter mid-candle"
          muted
        />
      )}
    </SectionCard>
  );
});

export default TimingRecommendation;
