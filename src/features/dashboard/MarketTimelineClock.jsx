import React, { useEffect, useState } from "react";
import { Clock3, TimerReset } from "lucide-react";
import { SectionCard } from "../consensus/SectionCard.jsx";
import { MetricRow } from "../consensus/MetricRow.jsx";

function formatIstTime(isoValue) {
  if (!isoValue) {
    return "Waiting for market clock";
  }

  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) {
    return "Waiting for market clock";
  }

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(parsed);
}

function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "Now";
  }

  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function MarketTimelineClock({ marketNow, observedAtMs }) {
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const updateClock = () => setNowMs(Date.now());
    updateClock();

    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const effectiveNowMs = nowMs || observedAtMs || 0;
  const elapsedSinceFetch = Math.max(effectiveNowMs - (observedAtMs || effectiveNowMs), 0);
  const remainingMs = Math.max((marketNow?.timeToNextEventMs || 0) - elapsedSinceFetch, 0);

  return (
    <SectionCard title="Market Clock" icon={Clock3} accent="var(--aura-status-info, #0A84FF)">
      <MetricRow
        icon={Clock3}
        label="Current IST"
        value={formatIstTime(marketNow?.istTime)}
        sub={marketNow?.isoDate || "Live market calendar"}
        color="var(--aura-status-info, #0A84FF)"
      />
      <MetricRow
        icon={TimerReset}
        label="Next Transition"
        value={marketNow?.nextEvent || "Pending"}
        sub={formatCountdown(remainingMs)}
      />
    </SectionCard>
  );
}

export default MarketTimelineClock;
