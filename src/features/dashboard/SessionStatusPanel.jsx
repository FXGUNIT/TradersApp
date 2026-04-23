import React from "react";
import { Activity, BadgeCheck, CircleOff } from "lucide-react";
import { SectionCard } from "../consensus/SectionCard.jsx";
import { MetricRow } from "../consensus/MetricRow.jsx";

function prettifySession(session) {
  if (!session) {
    return "Unknown";
  }

  return String(session)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function SessionStatusPanel({ marketNow, activeInstrument }) {
  const isOpen = marketNow?.session && marketNow.session !== "closed";
  const accent = isOpen ? "var(--aura-status-success, #30D158)" : "var(--aura-status-warning, #F59E0B)";

  return (
    <SectionCard title="Session Status" icon={Activity} accent={accent}>
      <MetricRow
        icon={isOpen ? BadgeCheck : CircleOff}
        label="Market State"
        value={isOpen ? prettifySession(marketNow?.session) : "Closed"}
        sub={`${activeInstrument?.market || "NSE"} session`}
        color={accent}
      />
      <MetricRow
        icon={Activity}
        label="Trading Day"
        value={marketNow?.isTradingDay ? "Live" : "Non-trading"}
        sub={
          marketNow?.holidayName
            ? marketNow.holidayName
            : marketNow?.isWeekend
              ? "Weekend schedule"
              : "Regular calendar"
        }
      />
    </SectionCard>
  );
}

export default SessionStatusPanel;
