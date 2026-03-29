export function calcRoR(wr, avgWin, avgLoss, maxDD) {
  if (
    !wr ||
    wr <= 0 ||
    wr >= 1 ||
    !avgWin ||
    !avgLoss ||
    avgWin <= 0 ||
    avgLoss <= 0 ||
    !maxDD
  )
    return null;
  const n = maxDD / avgLoss,
    ratio = ((1 - wr) * avgLoss) / (wr * avgWin);
  if (ratio >= 1) return 0.99;
  return Math.pow(ratio, n);
}

const IST_OFFSET_MS = 5.5 * 3600 * 1000;
const MARKET_OPEN_MINUTES = 10 * 60;
const MARKET_CLOSE_MINUTES = 17 * 60;
const MARKET_WINDOW_LABEL = "10:00AM-5:00PM IST ONLY";

function formatCountdownParts(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    hh: String(hours).padStart(2, "0"),
    mm: String(minutes).padStart(2, "0"),
    ss: String(seconds).padStart(2, "0"),
  };
}

export function getISTState() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + IST_OFFSET_MS);

  const h = ist.getHours();
  const m = ist.getMinutes();
  const s = ist.getSeconds();
  const day = ist.getDay();
  const totalMinutes = h * 60 + m;
  const isWeekend = day === 0 || day === 6;
  const isOpen =
    !isWeekend &&
    totalMinutes >= MARKET_OPEN_MINUTES &&
    totalMinutes < MARKET_CLOSE_MINUTES;

  const nextBoundary = new Date(ist);
  let lbl = "";

  if (isOpen) {
    nextBoundary.setHours(17, 0, 0, 0);
    lbl = "MARKET CLOSES IN";
  } else {
    lbl = "MARKETS OPEN IN";

    if (isWeekend) {
      const daysToMonday = day === 6 ? 2 : 1;
      nextBoundary.setDate(nextBoundary.getDate() + daysToMonday);
      nextBoundary.setHours(10, 0, 0, 0);
    } else if (totalMinutes < MARKET_OPEN_MINUTES) {
      nextBoundary.setHours(10, 0, 0, 0);
    } else {
      nextBoundary.setDate(nextBoundary.getDate() + 1);
      while (nextBoundary.getDay() === 0 || nextBoundary.getDay() === 6) {
        nextBoundary.setDate(nextBoundary.getDate() + 1);
      }
      nextBoundary.setHours(10, 0, 0, 0);
    }
  }

  const secondsUntilBoundary = Math.max(
    0,
    Math.floor((nextBoundary.getTime() - ist.getTime()) / 1000),
  );
  const countdownParts = formatCountdownParts(secondsUntilBoundary);
  const countdown = `${countdownParts.hh}:${countdownParts.mm}:${countdownParts.ss}`;
  const countdownDisplay =
    countdownParts.days > 0
      ? `${countdownParts.days}D ${countdown}`
      : countdown;

  return {
    isOpen,
    isWeekend,
    day,
    h,
    m,
    s,
    lbl,
    countdown,
    countdownDisplay,
    countdownDays: countdownParts.days,
    secondsUntilBoundary,
    sessionWindowLabel: MARKET_WINDOW_LABEL,
    istStr: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} IST`,
  };
}
