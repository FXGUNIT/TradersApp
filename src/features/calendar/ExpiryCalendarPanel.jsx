import React from "react";
import { CalendarRange } from "lucide-react";
import { SectionCard } from "../consensus/SectionCard.jsx";

export function ExpiryCalendarPanel({ expiries = [] }) {
  return (
    <SectionCard title="Expiry Radar" icon={CalendarRange} accent="var(--aura-status-info, #0A84FF)">
      {expiries.length > 0 ? (
        <div className="cc-mini-list">
          {expiries.map((expiry) => (
            <div key={`${expiry.type}-${expiry.date}`} className="cc-mini-list__item">
              <div className="cc-mini-list__title">
                {expiry.type} expiry
              </div>
              <div className="cc-mini-list__meta">
                {expiry.date} · {expiry.daysUntil}d
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="cc-empty-panel">
          No expiry calendar data returned yet.
        </div>
      )}
    </SectionCard>
  );
}

export default ExpiryCalendarPanel;
