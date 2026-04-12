/**
 * Terminal AI Handlers
 * Extracted from MainTerminal.jsx for file size compliance.
 * Contains all async AI/trade handlers that close over React state.
 */

import { parseJsonChoice, parseRrrMultiple } from "./terminalStateHelpers.js";

/**
 * Build the Part 1 (premarket) text prompt from current state.
 */
export function buildPart1TextMsg({ parsed, ist }) {
  return `Run full Premarket Analysis. Today: ${parsed.days[parsed.days.length - 1]?.date} | ${ist.istStr}
Trading Hours ATR(14): ${parsed.tradingHoursAtr14} pts

Screenshots: ${parsed.p1NewsChart ? '✓ Calendar' : '✗ No calendar'} | ${parsed.p1PremarketChart ? '✓ Premarket chart' : '✗ No chart'} | ${parsed.p1KeyLevelsChart ? '✓ Key levels' : '✗ No levels'}
Apply ALL sections including SECTION AMD.`;
}

/**
 * Build the Part 2 (trade execution) text prompt from current state.
 */
export function buildPart2TextMsg({
  p1Out,
  displayedAmdPhase,
  liveAmdPhase,
  f,
  ptVal,
  maxRiskUSD,
  extractedVals,
  sd1Target,
  sd2Target,
  volatilityRegime,
  fr,
  curBal,
  hwmVal,
  slPts,
}) {
  return `PRE-ENTRY ANALYSIS + TRADE PLAN
=== PART 1 AMD CONTEXT ===
${p1Out ? p1Out.slice(0, 2500) + (p1Out.length > 2500 ? '\n[truncated]' : '') : 'No morning analysis.'}
Current AMD Phase (Part 1): ${displayedAmdPhase}
Live AMD Phase (Terminal): ${liveAmdPhase}

=== LIVE TRADE ===
Time (IST): ${f.timeIST || '?'} | Instrument: ${f.instrument} ($${ptVal}/pt)
Direction: ${f.direction} | Type: ${f.tradeType} | RRR: ${f.rrr}
Entry: ${f.entryPrice} | ATR: ${slPts || '?'} | Max Risk: $${maxRiskUSD || 0}
ADX: ${extractedVals.adx || '?'} | CI: ${extractedVals.ci || '?'} | VWAP: ${extractedVals.vwap || '?'}
VWAP SD1: ${sd1Target?.toFixed(2) || '?'} | SD2: ${sd2Target?.toFixed(2) || '?'}
Volatility Regime: ${volatilityRegime}
Notes: ${f.notes || 'none'}

=== FIRM COMPLIANCE ===
Max Daily Loss: $${fr.maxDailyLoss || '?'} | Max Drawdown: $${fr.maxDrawdown || '?'}
Current Balance: $${curBal || '?'} | HWM: $${hwmVal || '?'}`;
}

/**
 * Build screenshot content array for AI API (multi-image).
 */
export function buildScreenshotsContent({ mpChart, vwapChart, screenshots }) {
  const content = [];
  if (mpChart) content.push({ type: 'image', source: { type: 'base64', media_type: mpChart.type, data: mpChart.b64 } });
  if (vwapChart) content.push({ type: 'image', source: { type: 'base64', media_type: vwapChart.type, data: vwapChart.b64 } });
  screenshots.forEach(s => content.push({ type: 'image', source: { type: 'base64', media_type: s.type, data: s.b64 } }));
  return content;
}

/**
 * Build premarket screenshot content array for AI API.
 */
export function buildPremarketContent({ p1NewsChart, p1PremarketChart, p1KeyLevelsChart }) {
  const content = [];
  if (p1NewsChart) content.push({ type: 'image', source: { type: 'base64', media_type: p1NewsChart.type, data: p1NewsChart.b64 } });
  if (p1PremarketChart) content.push({ type: 'image', source: { type: 'base64', media_type: p1PremarketChart.type, data: p1PremarketChart.b64 } });
  if (p1KeyLevelsChart) content.push({ type: 'image', source: { type: 'base64', media_type: p1KeyLevelsChart.type, data: p1KeyLevelsChart.b64 } });
  return content;
}

/**
 * Parse AMD phase from Part 1 response text.
 */
export function parseAmdPhaseFromResponse(response, AMD_PHASES) {
  const amdMatch = response.match(/MACRO AMD PHASE:\s*([A-Z]+)/i);
  if (amdMatch && AMD_PHASES[amdMatch[1]]) {
    return amdMatch[1];
  }
  return null;
}

/**
 * Build a journal entry from P2 trade data.
 */
export function buildP2JournalEntry({ p2Jf, f, currentAMD, predictedP2TP1, predictedP2SL, today, contracts }) {
  return {
    date: today,
    instrument: f.instrument,
    direction: f.direction,
    tradeType: f.tradeType,
    amdPhase: p2Jf.amdPhase || currentAMD,
    rrr: f.rrr,
    result: p2Jf.result,
    entry: f.entryPrice,
    exit: p2Jf.exit,
    actualExit: p2Jf.exit,
    predictedTP1: Number.isFinite(predictedP2TP1) ? predictedP2TP1.toFixed(2) : "",
    predictedSL: Number.isFinite(predictedP2SL) ? predictedP2SL.toFixed(2) : "",
    contracts: String(contracts),
    pnl: p2Jf.pnl,
    session: 'Trading Hours',
    balAfter: p2Jf.balAfter,
    setup: `${f.timeIST || '?'} IST | ${f.direction} @ ${f.entryPrice} | ${f.rrr}`,
    lessons: p2Jf.lessons,
    id: `trade-${Date.now()}`,
  };
}

/**
 * Build a manual journal entry.
 */
export function buildManualJournalEntry({ jf, slPts }) {
  const entryPrice = Number.parseFloat(jf.entry);
  const fallbackPredictedTP1 = Number.isFinite(entryPrice)
    ? entryPrice + (jf.direction === "Long" ? 1 : -1) * slPts * parseRrrMultiple(jf.rrr)
    : null;
  return {
    ...jf,
    actualExit: jf.exit,
    predictedTP1: jf.predictedTP1 || (Number.isFinite(fallbackPredictedTP1) ? fallbackPredictedTP1.toFixed(2) : ""),
    id: `trade-${Date.now()}`,
  };
}

/**
 * Count consecutive losses from end of journal.
 */
export function countConsecutiveLosses(journal) {
  let streak = 0;
  for (let i = journal.length - 1; i >= 0; i--) {
    if (journal[i].result === "loss") streak++;
    else break;
  }
  return streak;
}

/**
 * Handle CSV file text — fallback inline parser (no worker).
 * Returns { days, totalBars, totalDays, tradingHoursAtr14, keyLevels }.
 */
export function parseCsvTextInline(text) {
  const lines = text.trim().split('\n');
  const days = [];
  let totalBars = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 6) continue;

    const date = cols[0]?.trim();
    const time = cols[1]?.trim();
    const open = parseFloat(cols[2]);
    const high = parseFloat(cols[3]);
    const low = parseFloat(cols[4]);
    const close = parseFloat(cols[5]);

    if (isNaN(open) || isNaN(close)) continue;

    const isPreMarket = time && time.length >= 4 && parseInt(time.slice(0, 2)) < 9;
    const isPostMarket = time && time.length >= 4 && parseInt(time.slice(0, 2)) >= 16;

    const tr = isNaN(high - low) ? 0 : high - low;

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
      const d = days[days.length - 1];
      d.bars++;
      if (isPreMarket) d.preMarket++;
      else if (!isPostMarket) d.tradingHours++;
      else d.postMarket++;
      d.atr14 = Math.max(d.atr14, tr);
      if (!isPreMarket && !isPostMarket) d.tradingHoursAtr14 = Math.max(d.tradingHoursAtr14, tr);
      d.dayHigh = Number.isFinite(d.dayHigh) ? Math.max(d.dayHigh, high) : high;
      d.dayLow = Number.isFinite(d.dayLow) ? Math.min(d.dayLow, low) : low;
    }
    totalBars++;
  }

  if (days.length >= 5) {
    days.sort((a, b) => new Date(a.date) - new Date(b.date));
    for (let i = 0; i < days.length; i++) {
      const fiveDaySlice = days.slice(Math.max(0, i - 4), i + 1);
      const fiveDaySum = fiveDaySlice.reduce((s, d) => s + (d.atr14 || 0), 0);
      days[i].fiveDayATR = fiveDaySum / fiveDaySlice.length;

      const twentyDaySlice = days.slice(Math.max(0, i - 19), i + 1);
      const twentyDaySum = twentyDaySlice.reduce((s, d) => s + (d.atr14 || 0), 0);
      days[i].twentyDayATR = twentyDaySum / twentyDaySlice.length;
    }
  }

  const tradingHoursAtr = days.reduce((s, d) => s + (d.tradingHoursAtr14 || 0), 0) / (days.length || 1);
  const priorDays = days.slice(0, -1);
  const priorWeek = priorDays.slice(-5);
  const prevDay = priorDays[priorDays.length - 1] || null;
  const priorWeekHighs = priorWeek.map((d) => d.dayHigh).filter(Number.isFinite);
  const priorWeekLows = priorWeek.map((d) => d.dayLow).filter(Number.isFinite);
  const keyLevels = {
    pdh: prevDay?.dayHigh ?? null,
    pdl: prevDay?.dayLow ?? null,
    pwh: priorWeekHighs.length ? Math.max(...priorWeekHighs) : null,
    pwl: priorWeekLows.length ? Math.min(...priorWeekLows) : null,
  };

  return { days, totalBars, totalDays: days.length, tradingHoursAtr14: tradingHoursAtr, keyLevels };
}