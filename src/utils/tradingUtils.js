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

export function getISTState() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + 5.5 * 3600 * 1000);

  const h = ist.getHours();
  const m = ist.getMinutes();
  const s = ist.getSeconds();

  const tot = h * 60 + m;
  const OPEN = 10 * 60;
  const CLOSE = 17 * 60;

  const isOpen = tot >= OPEN && tot < CLOSE;
  let sec, lbl;

  if (tot < OPEN) {
    sec = (OPEN - tot) * 60 - s;
    lbl = "OPENS IN";
  } else if (tot < CLOSE) {
    sec = (CLOSE - tot) * 60 - s;
    lbl = "CLOSES IN";
  } else {
    sec = (24 * 60 - tot + OPEN) * 60 - s;
    lbl = "OPENS IN";
  }

  const ch = String(Math.floor(sec / 3600)).padStart(2, "0");
  const cm = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const cs = String(sec % 60).padStart(2, "0");

  return {
    isOpen,
    h,
    m,
    s,
    lbl,
    countdown: `${ch}:${cm}:${cs}`,
    istStr: `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} IST`,
  };
}
