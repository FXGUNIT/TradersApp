function normalizeLines(rawText = "") {
  return String(rawText)
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function looksLikeHeader(columns = []) {
  const first = String(columns[0] || "").trim().toLowerCase();
  const second = String(columns[1] || "").trim().toLowerCase();
  return first === "date" || second === "time" || first.includes("date");
}

function parseHour(timeValue = "") {
  const digits = String(timeValue).replace(/\D/g, "");
  if (digits.length < 2) {
    return Number.NaN;
  }
  return Number.parseInt(digits.slice(0, 2), 10);
}

function getSortValue(dateValue = "") {
  const digits = String(dateValue).replace(/\D/g, "");
  if (digits.length === 8) {
    return digits;
  }

  const parsed = Date.parse(dateValue);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  return String(dateValue);
}

function createEmptyResult(parseMsg) {
  return {
    ok: false,
    parsed: null,
    parseMsg,
  };
}

export function parseTerminalCsvText(rawText = "", onProgress) {
  const lines = normalizeLines(rawText);
  if (!lines.length) {
    return createEmptyResult("⚠ CSV export is empty");
  }

  const days = [];
  let totalBars = 0;
  let lastProgressReport = 0;
  const totalLines = lines.length;

  for (const line of lines) {
    const separator = line.includes(";") && !line.includes(",") ? ";" : ",";
    const columns = line.split(separator).map((value) => value.trim());
    if (looksLikeHeader(columns) || columns.length < 6) {
      continue;
    }

    const date = columns[0];
    const time = columns[1];
    const open = Number.parseFloat(columns[2]);
    const high = Number.parseFloat(columns[3]);
    const low = Number.parseFloat(columns[4]);
    const close = Number.parseFloat(columns[5]);

    if (!date || !time || Number.isNaN(open) || Number.isNaN(close)) {
      continue;
    }

    const hour = parseHour(time);
    if (!Number.isFinite(hour)) {
      continue;
    }

    const isPreMarket = hour < 9;
    const isPostMarket = hour >= 16;
    const tr = Number.isNaN(high - low) ? 0 : high - low;

    if (!days.length || days[days.length - 1].date !== date) {
      days.push({
        date,
        bars: 1,
        preMarket: isPreMarket ? 1 : 0,
        tradingHours: !isPreMarket && !isPostMarket ? 1 : 0,
        postMarket: isPostMarket ? 1 : 0,
        atr14: tr,
        tradingHoursAtr14: !isPreMarket && !isPostMarket ? tr : 0,
        dayHigh: high,
        dayLow: low,
      });
    } else {
      const currentDay = days[days.length - 1];
      currentDay.bars += 1;
      if (isPreMarket) {
        currentDay.preMarket += 1;
      } else if (!isPostMarket) {
        currentDay.tradingHours += 1;
      } else {
        currentDay.postMarket += 1;
      }
      currentDay.atr14 = Math.max(currentDay.atr14, tr);
      if (!isPreMarket && !isPostMarket) {
        currentDay.tradingHoursAtr14 = Math.max(currentDay.tradingHoursAtr14, tr);
      }
      currentDay.dayHigh = Number.isFinite(currentDay.dayHigh)
        ? Math.max(currentDay.dayHigh, high)
        : high;
      currentDay.dayLow = Number.isFinite(currentDay.dayLow)
        ? Math.min(currentDay.dayLow, low)
        : low;
    }

    totalBars += 1;

    // Report progress every ~2% of total lines (throttled to avoid message spam)
    if (onProgress && totalBars - lastProgressReport >= Math.max(1, Math.floor(totalLines / 50))) {
      lastProgressReport = totalBars;
      onProgress(Math.round((totalBars / totalLines) * 80)); // rows = 80% of work
    }
  }

  if (!totalBars || !days.length) {
    return createEmptyResult("⚠ No valid rows found — check export format");
  }

  days.sort((left, right) =>
    getSortValue(left.date).localeCompare(getSortValue(right.date)),
  );

  if (onProgress) onProgress(85); // sorting done

  if (days.length >= 5) {
    const totalDays = days.length;
    for (let index = 0; index < days.length; index += 1) {
      const fiveDaySlice = days.slice(Math.max(0, index - 4), index + 1);
      const fiveDaySum = fiveDaySlice.reduce((sum, day) => sum + (day.atr14 || 0), 0);
      days[index].fiveDayATR = fiveDaySum / fiveDaySlice.length;

      const twentyDaySlice = days.slice(Math.max(0, index - 19), index + 1);
      const twentyDaySum = twentyDaySlice.reduce(
        (sum, day) => sum + (day.atr14 || 0),
        0,
      );
      days[index].twentyDayATR = twentyDaySum / twentyDaySlice.length;

      // ATR rolling window = 20% of remaining work
      if (onProgress && index % Math.max(1, Math.floor(totalDays / 20)) === 0) {
        onProgress(85 + Math.round((index / totalDays) * 15));
      }
    }
  }

  const tradingHoursAtr14 =
    days.reduce((sum, day) => sum + (day.tradingHoursAtr14 || 0), 0) /
    (days.length || 1);
  const priorDays = days.slice(0, -1);
  const priorWeek = priorDays.slice(-5);
  const previousDay = priorDays[priorDays.length - 1] || null;
  const priorWeekHighs = priorWeek
    .map((day) => day.dayHigh)
    .filter((value) => Number.isFinite(value));
  const priorWeekLows = priorWeek
    .map((day) => day.dayLow)
    .filter((value) => Number.isFinite(value));
  const keyLevels = {
    pdh: previousDay?.dayHigh ?? null,
    pdl: previousDay?.dayLow ?? null,
    pwh: priorWeekHighs.length ? Math.max(...priorWeekHighs) : null,
    pwl: priorWeekLows.length ? Math.min(...priorWeekLows) : null,
  };

  if (days.length < 5) {
    return createEmptyResult(`⚠ Only ${days.length} days — need 5+`);
  }

  return {
    ok: true,
    parsed: {
      days,
      totalBars,
      totalDays: days.length,
      tradingHoursAtr14,
      keyLevels,
    },
    parseMsg: `✓ ${totalBars.toLocaleString()} bars → ${days.length} days`,
  };
}

export default {
  parseTerminalCsvText,
};
