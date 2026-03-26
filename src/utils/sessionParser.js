export function getSession(h, m) {
  const t = h * 60 + m;
  if (t >= 23 * 60 || t < 4 * 60 + 30) return "PRE";
  if (t >= 4 * 60 + 30 && t < 11 * 60 + 30) return "TRADING";
  if (t >= 11 * 60 + 30 && t < 22 * 60) return "POSTMARKET";
  return "MAINTENANCE";
}

export function getTradingDate(ds, h) {
  if (h >= 23) {
    const y = parseInt(ds.slice(0, 4)),
      mo = parseInt(ds.slice(4, 6)) - 1,
      d = parseInt(ds.slice(6, 8));
    const dt = new Date(Date.UTC(y, mo, d + 1));
    return dt.toISOString().slice(0, 10).replace(/-/g, "");
  }
  return ds;
}

function agg(bars) {
  if (!bars.length) return null;
  return {
    o: bars[0].o,
    h: Math.max(...bars.map((b) => b.hi)),
    l: Math.min(...bars.map((b) => b.lo)),
    c: bars[bars.length - 1].c,
    v: bars.reduce((s, b) => s + b.v, 0),
    count: bars.length,
  };
}

export function parseAndAggregate(raw) {
  const lines = raw
    .trim()
    .split("\n")
    .filter((l) => {
      const t = l.trim().toLowerCase();
      return t && !t.startsWith("date") && !t.startsWith("time");
    });
  const minuteBars = [];
  for (const line of lines) {
    const sep = line.includes(";") ? ";" : ",";
    const p = line.trim().replace(/\r/g, "").split(sep);
    if (p.length < 5) continue;
    const dtRaw = p[0].trim();
    const [datePart, timePart] = dtRaw.includes(" ")
      ? dtRaw.split(" ")
      : [dtRaw.slice(0, 8), dtRaw.slice(8)];
    const h = parseInt(timePart.slice(0, 2)),
      m = parseInt(timePart.slice(2, 4));
    const [o, hi, lo, c, v] = p.slice(1, 6).map(Number);
    if (isNaN(o) || o <= 0) continue;
    minuteBars.push({ date: datePart, h, m, o, hi, lo, c, v: v || 0 });
  }
  if (!minuteBars.length) return { error: "No bars parsed." };
  const sessionMap = {};
  for (const bar of minuteBars) {
    const sess = getSession(bar.h, bar.m);
    if (sess === "MAINTENANCE") continue;
    const td = getTradingDate(bar.date, bar.h);
    if (!sessionMap[td])
      sessionMap[td] = { PRE: [], TRADING: [], POSTMARKET: [] };
    sessionMap[td][sess].push(bar);
  }
  const days = {};
  for (const [td, sess] of Object.entries(sessionMap)) {
    const allBars = [...sess.PRE, ...sess.TRADING, ...sess.POSTMARKET].sort(
      (a, b) =>
        (
          a.date +
          String(a.h).padStart(2, "0") +
          String(a.m).padStart(2, "0")
        ).localeCompare(
          b.date + String(b.h).padStart(2, "0") + String(b.m).padStart(2, "0"),
        ),
    );
    const full = agg(allBars);
    if (full) {
      const hourlyStats = {};
      for (const bar of sess.TRADING) {
        if (!hourlyStats[bar.h])
          hourlyStats[bar.h] = { hi: -Infinity, lo: Infinity };
        hourlyStats[bar.h].hi = Math.max(hourlyStats[bar.h].hi, bar.hi);
        hourlyStats[bar.h].lo = Math.min(hourlyStats[bar.h].lo, bar.lo);
      }
      days[td] = {
        date: td,
        pre: agg(sess.PRE),
        trading: agg(sess.TRADING),
        post: agg(sess.POSTMARKET),
        full,
        hourlyStats,
      };
    }
  }
  const sorted = Object.values(days).sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const oldest = [...sorted].reverse();
  const trs = [],
    atrVals = new Array(oldest.length).fill(null);
  for (let i = 0; i < oldest.length; i++) {
    const cur = oldest[i].full;
    trs.push(
      i === 0
        ? cur.h - cur.l
        : Math.max(
            cur.h - cur.l,
            Math.abs(cur.h - oldest[i - 1].full.c),
            Math.abs(cur.l - oldest[i - 1].full.c),
          ),
    );
  }
  if (trs.length >= 14) {
    let atr = trs.slice(0, 14).reduce((s, v) => s + v, 0) / 14;
    atrVals[13] = atr;
    for (let i = 14; i < trs.length; i++) {
      atr = (atr * 13 + trs[i]) / 14;
      atrVals[i] = atr;
    }
  }
  sorted.forEach((d, i) => {
    const idx = oldest.length - 1 - i;
    d.atr14 = atrVals[idx] ? Math.round(atrVals[idx] * 100) / 100 : null;
  });
  const tradOldest = oldest.map((d) => d.trading).filter(Boolean),
    tradTrs = [];
  for (let i = 0; i < tradOldest.length; i++) {
    const cur = tradOldest[i];
    tradTrs.push(
      i === 0
        ? cur.h - cur.l
        : Math.max(
            cur.h - cur.l,
            Math.abs(cur.h - tradOldest[i - 1].c),
            Math.abs(cur.l - tradOldest[i - 1].c),
          ),
    );
  }
  let tradAtr = null;
  if (tradTrs.length >= 14) {
    tradAtr = tradTrs.slice(0, 14).reduce((s, v) => s + v, 0) / 14;
    for (let i = 14; i < tradTrs.length; i++)
      tradAtr = (tradAtr * 13 + tradTrs[i]) / 14;
  }
  const hourlyHeatmap = {};
  for (const day of oldest.slice(-45)) {
    if (!day.trading || !day.hourlyStats) continue;
    const dayRange = day.trading.h - day.trading.l,
      dayNet = Math.abs(day.trading.c - day.trading.o),
      isTrending = dayRange > 0 && dayNet / dayRange > 0.45;
    for (const [hStr] of Object.entries(day.hourlyStats)) {
      const hr = parseInt(hStr);
      if (!hourlyHeatmap[hr])
        hourlyHeatmap[hr] = { trend: 0, range: 0, total: 0 };
      hourlyHeatmap[hr].total++;
      if (isTrending) hourlyHeatmap[hr].trend++;
      else hourlyHeatmap[hr].range++;
    }
  }
  return {
    days: sorted,
    tradingHoursAtr14: tradAtr ? Math.round(tradAtr * 100) / 100 : null,
    totalBars: minuteBars.length,
    totalDays: sorted.length,
    hourlyHeatmap,
  };
}

export function buildDataSummary(data) {
  const lines = [
    `PARSED: ${data.totalBars.toLocaleString()} bars → ${data.totalDays} trading days`,
    `Trading Hours ATR(14): ${data.tradingHoursAtr14 || "N/A"} pts`,
    "",
    "=== SESSION DATA (most recent first) ===",
    "",
  ];
  for (const d of data.days.slice(0, 20)) {
    const fmt = (s) =>
      s
        ? `O=${s.o} H=${s.h} L=${s.l} C=${s.c} Range=${Math.round((s.h - s.l) * 100) / 100} Net=${s.c - s.o >= 0 ? "+" : ""}${Math.round((s.c - s.o) * 100) / 100}`
        : "NO DATA";
    lines.push(`DATE: ${d.date} | ATR14=${d.atr14 || "N/A"}`);
    lines.push(`  Pre:     ${fmt(d.pre)}`);
    lines.push(`  Trading: ${fmt(d.trading)}`);
    lines.push(`  Post:    ${fmt(d.post)}`);
    lines.push(`  Full:    ${fmt(d.full)}`);
    lines.push("");
  }
  return lines.join("\n");
}
