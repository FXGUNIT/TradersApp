const STRIKE_STEP_MAP = Object.freeze({
  NIFTY: 50,
  BANKNIFTY: 100,
  FINNIFTY: 50,
});

const LOT_SIZE_MAP = Object.freeze({
  NIFTY: 75,
  BANKNIFTY: 35,
  FINNIFTY: 40,
});

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export function getOptionsUnderlying(activeInstrument) {
  const symbol = String(activeInstrument?.symbol || "NIFTY").trim().toUpperCase();

  if (symbol === "NSEOPTIONS" || symbol === "OPTIONS") {
    return "NIFTY";
  }

  if (symbol in STRIKE_STEP_MAP) {
    return symbol;
  }

  return "NIFTY";
}

export function getStrikeStep(symbol = "NIFTY") {
  return STRIKE_STEP_MAP[getOptionsUnderlying({ symbol })] || 50;
}

export function getLotSize(symbol = "NIFTY") {
  return LOT_SIZE_MAP[getOptionsUnderlying({ symbol })] || 75;
}

export function roundSpotToStrike(spotPrice, symbol = "NIFTY") {
  const spot = numberOrNull(spotPrice);
  if (spot === null) {
    return null;
  }

  const step = getStrikeStep(symbol);
  return Math.round(spot / step) * step;
}

export function buildFallbackStrikeRows(spotPrice, symbol = "NIFTY", radius = 2) {
  const atmStrike = roundSpotToStrike(spotPrice, symbol);
  const step = getStrikeStep(symbol);

  if (atmStrike === null) {
    return [];
  }

  const rows = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    rows.push({
      strike: atmStrike + (offset * step),
      call: null,
      put: null,
      expiry: null,
      isFallback: true,
    });
  }

  return rows;
}

export function getSpotPrice({ chain = [], featureVector = {} } = {}) {
  for (const row of chain) {
    const values = [
      row?.call?.underlyingPrice,
      row?.put?.underlyingPrice,
      row?.underlyingPrice,
    ];

    for (const value of values) {
      const numeric = numberOrNull(value);
      if (numeric !== null) {
        return numeric;
      }
    }
  }

  return numberOrNull(
    featureVector?.close ?? featureVector?.vwap ?? featureVector?.open,
  );
}

export function getAtmRow(chain = [], spotPrice) {
  const spot = numberOrNull(spotPrice);
  if (!Array.isArray(chain) || chain.length === 0 || spot === null) {
    return null;
  }

  return chain.reduce((best, row) => {
    if (!row || numberOrNull(row.strike) === null) {
      return best;
    }

    if (!best) {
      return row;
    }

    return Math.abs(row.strike - spot) < Math.abs(best.strike - spot) ? row : best;
  }, null);
}

export function getBiasOptionType(signal = "NEUTRAL") {
  const normalized = String(signal || "NEUTRAL").trim().toUpperCase();

  if (normalized === "LONG") {
    return "CALL";
  }

  if (normalized === "SHORT") {
    return "PUT";
  }

  return null;
}

export function getBiasLeg({ atmRow, signal }) {
  const optionType = getBiasOptionType(signal);
  if (!optionType || !atmRow) {
    return null;
  }

  return optionType === "CALL" ? atmRow.call : atmRow.put;
}

export function getAverageIv(chain = []) {
  const values = [];

  for (const row of chain) {
    for (const leg of [row?.call, row?.put]) {
      const iv = numberOrNull(leg?.impliedVolatility);
      if (iv !== null) {
        values.push(iv);
      }
    }
  }

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getVolRegimeSummary({ featureVector = {}, chain = [] } = {}) {
  const regimeValue = numberOrNull(featureVector?.volatility_regime) ?? 1;
  const averageIv = getAverageIv(chain);
  const realizedVol = numberOrNull(featureVector?.realized_vol);
  const sweepProb = numberOrNull(featureVector?.sweep_prob);

  if (regimeValue >= 2 || (averageIv !== null && averageIv >= 0.22)) {
    return {
      label: "Expansion",
      tone: "#FF9F0A",
      summary: "Option premiums are elevated. Favor disciplined entries and avoid overpaying for late moves.",
      averageIv,
      realizedVol,
      sweepProb,
    };
  }

  if (regimeValue <= 0 || (averageIv !== null && averageIv <= 0.15)) {
    return {
      label: "Compression",
      tone: "#30D158",
      summary: "Premiums are relatively contained. Breakout participation is cheaper, but confirmation matters.",
      averageIv,
      realizedVol,
      sweepProb,
    };
  }

  return {
    label: "Balanced",
    tone: "#0A84FF",
    summary: "Volatility is near baseline. Bias and expiry selection matter more than premium extremes.",
    averageIv,
    realizedVol,
    sweepProb,
  };
}

export function buildExpiryPlan({ expiries = [], timing, signal }) {
  const tradable = expiries.filter((expiry) => expiry?.tradable !== false && expiry?.date);
  const primary = tradable[0] || null;
  const backup = tradable[1] || null;

  if (!primary) {
    return {
      primary: null,
      backup: null,
      horizonLabel: "No expiry data",
      rationale: "Expiry routing is waiting on the calendar feed.",
    };
  }

  const signalType = String(signal || "NEUTRAL").trim().toUpperCase();
  const shouldAvoidFrontExpiry =
    (primary.daysUntil !== null && primary.daysUntil <= 1 && !timing?.enter_now) ||
    signalType === "NEUTRAL";

  if (shouldAvoidFrontExpiry && backup) {
    return {
      primary: backup,
      backup: primary,
      horizonLabel: "Next cycle",
      rationale: "The nearest expiry is too close for a clean tactical entry without an active trigger. Shift one cycle out to reduce decay pressure.",
    };
  }

  return {
    primary,
    backup,
    horizonLabel: primary.daysUntil !== null && primary.daysUntil <= 2 ? "Front week" : "Primary weekly",
    rationale: timing?.enter_now
      ? "The signal is live, so the nearest liquid expiry keeps the structure responsive."
      : "Use the nearest tradable weekly expiry until the timing model asks for a wider hold horizon.",
  };
}

export function formatPrice(value, options = {}) {
  const numeric = numberOrNull(value);
  if (numeric === null) {
    return "-";
  }

  const {
    currency = null,
    maximumFractionDigits = numeric >= 100 ? 0 : 2,
  } = options;

  if (currency) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits,
    }).format(numeric);
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits,
  }).format(numeric);
}

export function formatPercent(value, maximumFractionDigits = 0) {
  const numeric = numberOrNull(value);
  if (numeric === null) {
    return "-";
  }

  return `${(numeric * 100).toFixed(maximumFractionDigits)}%`;
}

export function formatSigned(value, suffix = "") {
  const numeric = numberOrNull(value);
  if (numeric === null) {
    return "-";
  }

  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: Math.abs(numeric) >= 100 ? 0 : 2,
  }).format(numeric);

  return `${numeric > 0 ? "+" : ""}${formatted}${suffix}`;
}

export default {
  buildExpiryPlan,
  buildFallbackStrikeRows,
  formatPercent,
  formatPrice,
  formatSigned,
  getAtmRow,
  getAverageIv,
  getBiasLeg,
  getBiasOptionType,
  getLotSize,
  getOptionsUnderlying,
  getSpotPrice,
  getStrikeStep,
  getVolRegimeSummary,
  roundSpotToStrike,
};
