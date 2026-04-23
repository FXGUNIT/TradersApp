import React from "react";
import { CalendarClock } from "lucide-react";
import { SectionCard } from "../consensus/SectionCard.jsx";
import { MetricRow } from "../consensus/MetricRow.jsx";

function formatExpiry(expiry) {
  if (!expiry?.date) {
    return "—";
  }

  const label = expiry.daysUntil !== null && expiry.daysUntil !== undefined
    ? `${expiry.date} · ${expiry.daysUntil}d`
    : expiry.date;

  return label;
}

export const ExpiryAdvisor = React.memo(function ExpiryAdvisor({
  plan,
  signal,
  timing,
}) {
  return (
    <SectionCard title="Expiry Advisor" icon={CalendarClock} accent="rgba(124,58,237,0.82)">
      <MetricRow
        icon={CalendarClock}
        label="Primary Expiry"
        value={formatExpiry(plan?.primary)}
        sub={plan?.horizonLabel || "Routing horizon"}
        color="rgba(124,58,237,0.9)"
      />
      <MetricRow
        icon={CalendarClock}
        label="Backup Expiry"
        value={formatExpiry(plan?.backup)}
        sub="Fallback if front expiry becomes too tight"
      />
      <MetricRow
        icon={CalendarClock}
        label="Bias Leg"
        value={signal === "LONG" ? "CALL" : signal === "SHORT" ? "PUT" : "WAIT"}
        sub={timing?.enter_now ? "Signal is active" : "Wait for timing confirmation"}
      />
      <div
        style={{
          marginTop: 8,
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(124,58,237,0.06)",
          border: "1px solid rgba(124,58,237,0.15)",
          fontSize: 11,
          lineHeight: 1.6,
          color: "var(--text-secondary)",
        }}
      >
        {plan?.rationale || "Expiry routing will populate once the calendar feed is available."}
      </div>
    </SectionCard>
  );
});

export default ExpiryAdvisor;
