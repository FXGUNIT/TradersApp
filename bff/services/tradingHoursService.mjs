/**
 * tradingHoursService.mjs
 * Pure DST-aware time functions for NY trading hours logic.
 * No side effects, no network calls, no external dependencies.
 */

// IST offset: UTC + 5:30 = (5 * 3600 + 30 * 60) * 1000 ms
const IST_OFFSET_MS = (5 * 60 * 60 * 1000) + (30 * 60 * 1000);

/**
 * Returns true if New York is currently in Daylight Saving Time.
 * Uses Intl.DateTimeFormat with America/New_York timezone to compare
 * the UTC offset in January (standard time) vs July (daylight time).
 *
 * @param {Date} [date=new Date()] - Date to check
 * @returns {boolean} true if NY is in DST, false otherwise
 */
export function isNyInDst(date = new Date()) {
  // Get the offset (in minutes) for the given date in America/New_York
  const nyOffset = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'shortOffset',
  }).formatToParts(date).find(p => p.type === 'timeZoneName');

  // Format again to get hour/minute and compute offset
  // Simpler: compute offset by checking January and July offsets via a reference approach
  // Use January and July of the same year to determine standard vs daylight offsets
  const year = date.getUTCFullYear();

  // Get offset for January (standard time)
  const janDate = new Date(Date.UTC(year, 0, 15, 12)); // Jan 15, noon UTC
  const janParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'shortOffset',
  }).formatToParts(janDate);
  const janOffsetStr = janParts.find(p => p.type === 'timeZoneName')?.value ?? '';

  // Get offset for July (daylight time)
  const julDate = new Date(Date.UTC(year, 6, 15, 12)); // Jul 15, noon UTC
  const julParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'shortOffset',
  }).formatToParts(julDate);
  const julOffsetStr = julParts.find(p => p.type === 'timeZoneName')?.value ?? '';

  // If July offset differs from January offset, DST is observed
  // Parse offset strings like "GMT-4" or "GMT-5"
  const parseOffset = (str) => {
    if (!str) return 0;
    const match = str.match(/GMT([+-])(\d+)/);
    if (match) {
      return match[1] === '-' ? -parseInt(match[2], 10) : parseInt(match[2], 10);
    }
    return 0;
  };

  const janOffset = parseOffset(janOffsetStr);
  const julOffset = parseOffset(julOffsetStr);

  // July offset is larger (less negative) than January when DST is active
  // e.g., EST = -5, EDT = -4, so -4 > -5
  const nyOffsetForDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'shortOffset',
  }).formatToParts(date).find(p => p.type === 'timeZoneName')?.value ?? '';

  const dateOffset = parseOffset(nyOffsetForDate);

  // If date's offset matches July offset (DST), return true
  return dateOffset === julOffset && julOffset !== janOffset;
}

/**
 * Returns true if the given IST time falls within the NY lunch window.
 * NY lunch = 12:00–13:00 ET.
 * IST conversion: ET + 10:30 during DST, ET + 9:30 outside DST.
 * So lunch in IST:
 *   - DST on  : 21:30–22:30 IST  (21:30 inclusive, 22:30 exclusive)
 *   - DST off : 22:30–23:30 IST (22:30 inclusive, 23:30 exclusive)
 *
 * @param {number} istHour   - IST hour (0–23)
 * @param {number} istMinute  - IST minute (0–59)
 * @param {boolean|null} [isDst=null] - DST state; if null, calls isNyInDst()
 * @returns {boolean} true if inside NY lunch window
 */
export function isNyLunchBreakActive(istHour, istMinute, isDst = null) {
  const dst = isDst === null ? isNyInDst() : isDst;

  const [startH, startM] = dst ? [21, 30] : [22, 30];
  const [endH, endM]     = dst ? [22, 30] : [23, 30];

  // Convert start/end to minutes-since-midnight for comparison
  const currentMins = istHour * 60 + istMinute;
  const startMins   = startH * 60 + startM;   // inclusive
  const endMins     = endH * 60 + endM;        // exclusive

  return currentMins >= startMins && currentMins < endMins;
}

/**
 * Convenience wrapper: checks if NY lunch block is active right now (IST).
 *
 * @param {Date} [now=new Date()] - Current time (UTC)
 * @returns {{ allowed: boolean, reason: string|null, message: string|null }}
 */
export function isNyLunchBlockActive(now = new Date()) {
  // Convert UTC to IST
  const istMs = now.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istMs);

  const istHour   = istDate.getUTCHours();
  const istMinute = istDate.getUTCMinutes();

  const blocked = isNyLunchBreakActive(istHour, istMinute);

  if (blocked) {
    return {
      allowed: false,
      reason: 'NY_LUNCH',
      message: 'Trading blocked during NY lunch (12:00–13:00 ET / 21:30–22:30 IST during DST, 22:30–23:30 IST outside DST)',
    };
  }

  return { allowed: true, reason: null, message: null };
}