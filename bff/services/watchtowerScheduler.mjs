// bff/services/watchtowerScheduler.mjs
// IST time-aware dynamic scheduler for Watchtower scan intervals.
// 9:00 IST – 23:59 IST → scan every 15 minutes
// 00:00 IST – 08:59 IST → scan every 60 minutes

export const IST_DAY_HOUR_START = 9;   // 9 AM IST
export const IST_DAY_HOUR_END = 23;     // 11:59 PM IST (inclusive)
export const DAY_INTERVAL_MS = 15 * 60 * 1000;   // 15 minutes
export const NIGHT_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes
const IST_OFFSET_HOURS = 5.5;  // IST = UTC + 5:30

/**
 * Returns the current IST hour (0-23) for a given UTC Date.
 */
export function getIstHour(utcDate = new Date()) {
  const utcMs = utcDate.getTime() + utcDate.getTimezoneOffset() * 60 * 1000;
  const istMs = utcMs + IST_OFFSET_HOURS * 60 * 60 * 1000;
  const istDate = new Date(istMs);
  return istDate.getUTCHours() + Math.floor(istDate.getUTCMinutes() / 60);
}

/**
 * Returns true if IST is between 9:00 and 23:59 inclusive.
 */
export function isIstDayHours(utcDate = new Date()) {
  const h = getIstHour(utcDate);
  return h >= IST_DAY_HOUR_START && h <= IST_DAY_HOUR_END;
}

/**
 * Returns the correct scan interval in ms for the given IST hour.
 */
export function getRefreshIntervalMs(istHour) {
  if (istHour >= IST_DAY_HOUR_START && istHour <= IST_DAY_HOUR_END) {
    return DAY_INTERVAL_MS;
  }
  return NIGHT_INTERVAL_MS;
}

/**
 * Returns the number of ms until the next IST day/night boundary,
 * so we can schedule a recalculation of the interval.
 */
export function computeNextBoundaryDelayMs(utcDate = new Date()) {
  const istHour = getIstHour(utcDate);
  // If in day hours (9-23), next boundary is at hour 24 (midnight IST next day)
  // If in night hours (0-8), next boundary is at hour 9 (9 AM IST)
  const targetHourIST = (istHour >= IST_DAY_HOUR_START && istHour <= IST_DAY_HOUR_END)
    ? 24  // midnight next
    : IST_DAY_HOUR_START;  // 9 AM

  // Convert target IST hour back to UTC
  const utcMs = utcDate.getTime() + utcDate.getTimezoneOffset() * 60 * 1000;
  const istMs = utcMs + IST_OFFSET_HOURS * 60 * 60 * 1000;
  const istDate = new Date(istMs);

  let hoursUntil = targetHourIST - istHour;
  if (hoursUntil <= 0) hoursUntil += 24;
  return hoursUntil * 60 * 60 * 1000;
}

export default { getIstHour, isIstDayHours, getRefreshIntervalMs, computeNextBoundaryDelayMs };
