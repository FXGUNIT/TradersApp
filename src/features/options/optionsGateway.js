import {
  bffFetch,
  createBffUnavailableResult,
  hasBff,
} from "../../services/gateways/base.js";
import { fetchExpiryCalendar } from "../../services/calendarGateway.js";

export const OPTION_UNDERLYINGS = Object.freeze({
  NIFTY: {
    symbol: "NIFTY",
    label: "NIFTY 50",
    exchangeSegment: "NSE_FNO",
    securityId: "13",
    lotSize: 75,
  },
  BANKNIFTY: {
    symbol: "BANKNIFTY",
    label: "Bank Nifty",
    exchangeSegment: "NSE_FNO",
    securityId: "25",
    lotSize: 35,
  },
  FINNIFTY: {
    symbol: "FINNIFTY",
    label: "Fin Nifty",
    exchangeSegment: "NSE_FNO",
    securityId: "27",
    lotSize: 40,
  },
});

function normalizeSuccess(result, fallback = {}) {
  if (!result) {
    return null;
  }

  if (result._authError) {
    return {
      success: false,
      ok: false,
      error: result.error || "Unauthorized",
      _authError: true,
      ...fallback,
    };
  }

  return {
    ...fallback,
    ...result,
    success: result.success !== false && result.ok !== false,
    ok: result.ok !== false && result.success !== false,
  };
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function normalizeOptionType(value) {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized === "CE" || normalized === "CALL" || normalized === "C") {
    return "CALL";
  }

  if (normalized === "PE" || normalized === "PUT" || normalized === "P") {
    return "PUT";
  }

  return normalized || "UNKNOWN";
}

function normalizeExpiryItem(expiry) {
  const date =
    expiry?.date ||
    expiry?.expiryDate ||
    expiry?.expiry ||
    expiry?.tradingDate ||
    null;

  return {
    date,
    label: expiry?.label || expiry?.type || (date ? `${date}` : "Unknown"),
    type: expiry?.type || expiry?.series || "weekly",
    daysUntil: numberOrNull(expiry?.daysUntil ?? expiry?.dte ?? expiry?.days_to_expiry),
    tradable: expiry?.tradable !== false,
  };
}

function normalizeLegPayload(leg, strike, optionTypeHint) {
  if (!leg || typeof leg !== "object") {
    return null;
  }

  const optionType = normalizeOptionType(
    optionTypeHint ??
      leg.optionType ??
      leg.option_type ??
      leg.right ??
      leg.instrumentType,
  );

  return {
    optionType,
    strike: numberOrNull(strike ?? leg.strikePrice ?? leg.strike ?? leg.strike_price),
    tradingSymbol: leg.tradingSymbol || leg.symbol || leg.displaySymbol || null,
    securityId: leg.securityId || leg.security_id || null,
    expiry: leg.expiryDate || leg.expiry || leg.expiry_date || null,
    lastPrice: numberOrNull(leg.lastPrice ?? leg.ltp ?? leg.last_price ?? leg.close),
    change: numberOrNull(leg.change ?? leg.netChange ?? leg.net_change),
    bid: numberOrNull(leg.bid ?? leg.bestBid ?? leg.bidPrice ?? leg.bid_price),
    ask: numberOrNull(leg.ask ?? leg.bestAsk ?? leg.askPrice ?? leg.ask_price),
    volume: numberOrNull(leg.volume ?? leg.vol ?? leg.tradedVolume) ?? 0,
    openInterest: numberOrNull(leg.openInterest ?? leg.oi ?? leg.open_interest) ?? 0,
    impliedVolatility: numberOrNull(
      leg.impliedVolatility ?? leg.iv ?? leg.implied_volatility,
    ),
    delta: numberOrNull(leg.delta),
    gamma: numberOrNull(leg.gamma),
    theta: numberOrNull(leg.theta),
    vega: numberOrNull(leg.vega),
    underlyingPrice: numberOrNull(
      leg.underlyingPrice ?? leg.underlying_value ?? leg.spotPrice ?? leg.underlyingLtp,
    ),
  };
}

function flattenChainPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (Array.isArray(payload.records?.data)) {
    return payload.records.data;
  }

  if (Array.isArray(payload.chain)) {
    return payload.chain;
  }

  if (Array.isArray(payload.optionChain)) {
    return payload.optionChain;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
}

function normalizeChainRows(payload) {
  const grouped = new Map();

  for (const item of flattenChainPayload(payload)) {
    const strike = numberOrNull(item?.strikePrice ?? item?.strike ?? item?.strike_price);
    if (strike === null) {
      continue;
    }

    const bucket =
      grouped.get(strike) || {
        strike,
        call: null,
        put: null,
        expiry: item?.expiryDate || item?.expiry || item?.expiry_date || null,
      };

    if (item?.call || item?.CALL || item?.ce) {
      bucket.call =
        normalizeLegPayload(item.call || item.CALL || item.ce, strike, "CALL") ||
        bucket.call;
    }

    if (item?.put || item?.PUT || item?.pe) {
      bucket.put =
        normalizeLegPayload(item.put || item.PUT || item.pe, strike, "PUT") ||
        bucket.put;
    }

    if (!bucket.call && !bucket.put) {
      const leg = normalizeLegPayload(item, strike);
      if (leg?.optionType === "CALL") {
        bucket.call = leg;
      } else if (leg?.optionType === "PUT") {
        bucket.put = leg;
      }
    }

    grouped.set(strike, bucket);
  }

  return [...grouped.values()].sort((left, right) => left.strike - right.strike);
}

function getUnderlyingConfig(symbol = "NIFTY") {
  const normalized = String(symbol || "NIFTY").trim().toUpperCase();
  return OPTION_UNDERLYINGS[normalized] || OPTION_UNDERLYINGS.NIFTY;
}

function createOptionsFallback(operation, extra = {}) {
  return createBffUnavailableResult(operation, {
    ok: false,
    success: false,
    source: "unavailable",
    ...extra,
  });
}

export async function fetchOptionsExpiries({ symbol = "NIFTY", count = 6 } = {}) {
  const underlying = getUnderlyingConfig(symbol);

  if (hasBff()) {
    const result = await bffFetch(
      `/options/expiries?symbol=${encodeURIComponent(underlying.symbol)}&count=${encodeURIComponent(count)}`,
    );
    const normalized = normalizeSuccess(result, {
      symbol: underlying.symbol,
      expiries: [],
      source: "bff",
    });

    if (normalized) {
      normalized.expiries = Array.isArray(normalized.expiries)
        ? normalized.expiries.map(normalizeExpiryItem)
        : [];
      return normalized;
    }
  }

  try {
    const fallback = await fetchExpiryCalendar({ count });
    return {
      success: true,
      ok: true,
      source: "calendar_fallback",
      symbol: underlying.symbol,
      expiries: Array.isArray(fallback?.expiries)
        ? fallback.expiries.map(normalizeExpiryItem)
        : [],
    };
  } catch {
    return createOptionsFallback("fetchOptionsExpiries", {
      symbol: underlying.symbol,
      expiries: [],
    });
  }
}

export async function fetchOptionsChain({
  symbol = "NIFTY",
  expiry,
  strikeCount = 18,
  includeGreeks = true,
} = {}) {
  const underlying = getUnderlyingConfig(symbol);

  if (!hasBff()) {
    return createOptionsFallback("fetchOptionsChain", {
      symbol: underlying.symbol,
      expiry: expiry || null,
      chain: [],
    });
  }

  const params = new URLSearchParams({
    symbol: underlying.symbol,
    exchangeSegment: underlying.exchangeSegment,
    strikeCount: String(strikeCount),
    includeGreeks: includeGreeks ? "true" : "false",
  });

  if (expiry) {
    params.set("expiry", String(expiry));
  }

  const result = await bffFetch(`/options/chain?${params.toString()}`);
  const normalized = normalizeSuccess(result, {
    symbol: underlying.symbol,
    expiry: expiry || null,
    chain: [],
    source: "bff",
  });

  if (!normalized) {
    return createOptionsFallback("fetchOptionsChain", {
      symbol: underlying.symbol,
      expiry: expiry || null,
      chain: [],
    });
  }

  normalized.chain = normalizeChainRows(normalized);
  return normalized;
}

export async function fetchOptionQuote({
  symbol = "NIFTY",
  securityId,
  exchangeSegment = "NSE_FNO",
} = {}) {
  const underlying = getUnderlyingConfig(symbol);

  if (!hasBff()) {
    return createOptionsFallback("fetchOptionQuote", {
      symbol: underlying.symbol,
      quote: null,
    });
  }

  const params = new URLSearchParams({
    symbol: underlying.symbol,
    exchangeSegment,
  });

  if (securityId) {
    params.set("securityId", String(securityId));
  }

  const result = await bffFetch(`/options/quote?${params.toString()}`);
  const normalized = normalizeSuccess(result, {
    symbol: underlying.symbol,
    quote: null,
    source: "bff",
  });

  if (!normalized) {
    return createOptionsFallback("fetchOptionQuote", {
      symbol: underlying.symbol,
      quote: null,
    });
  }

  normalized.quote = normalizeLegPayload(normalized.quote || normalized.data || normalized, null);
  return normalized;
}

export default {
  OPTION_UNDERLYINGS,
  fetchOptionQuote,
  fetchOptionsChain,
  fetchOptionsExpiries,
};
