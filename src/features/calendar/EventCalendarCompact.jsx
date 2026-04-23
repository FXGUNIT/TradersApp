import React from "react";
import { CalendarDays } from "lucide-react";
import { SectionCard } from "../consensus/SectionCard.jsx";

function isUpcomingHoliday(holiday, currentIsoDate) {
  if (!holiday?.date || !currentIsoDate) {
    return true;
  }

  return holiday.date >= currentIsoDate;
}

export function EventCalendarCompact({ holidays = [], marketNow }) {
  const upcomingHolidays = holidays
    .filter((holiday) => isUpcomingHoliday(holiday, marketNow?.isoDate))
    .slice(0, 3);

  return (
    <SectionCard title="Calendar Watch" icon={CalendarDays} accent="var(--aura-status-warning, #F59E0B)">
      {upcomingHolidays.length > 0 ? (
        <div className="cc-mini-list">
          {upcomingHolidays.map((holiday) => (
            <div key={holiday.date} className="cc-mini-list__item">
              <div className="cc-mini-list__title">{holiday.name}</div>
              <div className="cc-mini-list__meta">{holiday.date}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="cc-empty-panel">
          No upcoming exchange closures in the current calendar feed.
        </div>
      )}
    </SectionCard>
  );
}

export default EventCalendarCompact;
