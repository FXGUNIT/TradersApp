/**
 * Instrument registry: canonical symbol lookup plus per-instrument ML routing.
 * This stays intentionally small but provides the basics needed for future
 * multi-symbol routing without forcing callers to understand aliases or env
 * override details.
 *
 * Environment overrides:
 * - ML_ENGINE_URL / ML_ENGINE_INTERNAL_URL: shared fallback base URL
 * - DEFAULT_INSTRUMENT: overrides the default canonical symbol
 * - INSTRUMENT_REGISTRY_JSON: JSON object keyed by symbol for overrides/additions
 * - ML_ENGINE_URL__<SYMBOL>: per-symbol ML base URL override
 *
 * @module instrumentRegistry
 */

/**
 * @typedef {Object} InstrumentConfig
 * @property {string} symbol
 * @property {string[]} aliases
 * @property {string} mlEngineUrl
 * @property {string} sessionType
 * @property {number} timezoneOffset
 * @property {string} timeframe
 * @property {string[]} models
 */

const FALLBACK_ML_ENGINE_URL = "http://ml-engine:8001";

const BUILTIN_INSTRUMENTS = Object.freeze({
  NIFTY: {
    symbol: "NIFTY",
    aliases: ["NIFTY 50", "NIFTY50"],
    sessionType: "nse",
    timezoneOffset: 330,
    timeframe: "5min",
    models: ["direction", "regime", "session", "magnitude"],
  },
  BANKNIFTY: {
    symbol: "BANKNIFTY",
    aliases: ["BANK NIFTY", "NIFTYBANK"],
    sessionType: "nse",
    timezoneOffset: 330,
    timeframe: "5min",
    models: ["direction", "regime", "session"],
  },
  NSEOPTIONS: {
    symbol: "NSEOPTIONS",
    aliases: ["NSE OPTIONS", "NIFTY OPTIONS"],
    sessionType: "nse",
    timezoneOffset: 330,
    timeframe: "5min",
    models: ["direction", "regime", "alpha"],
  },
});

const unknownSymbolWarnings = new Set();

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function normalizeInstrumentSymbol(symbol) {
  return String(symbol ?? "").trim().toUpperCase();
}

function toLookupKey(symbol) {
  return normalizeInstrumentSymbol(symbol).replace(/[\s._-]+/g, "");
}

function toEnvKey(symbol) {
  return normalizeInstrumentSymbol(symbol).replace(/[^A-Z0-9]+/g, "_");
}

function normalizeBaseUrl(url, fallback = FALLBACK_ML_ENGINE_URL) {
  const trimmed = String(url ?? "").trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.replace(/\/+$/, "");
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ensureArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null || value === "") {
    return [];
  }

  return [value];
}

function uniqueStrings(values, formatter = (value) => String(value).trim()) {
  const seen = new Set();
  const result = [];

  for (const value of values || []) {
    const formatted = formatter(value);
    if (!formatted || seen.has(formatted)) {
      continue;
    }
    seen.add(formatted);
    result.push(formatted);
  }

  return result;
}

function resolvePerInstrumentMlUrl(symbol, explicitValue, fallbackUrl) {
  const envValue = process.env[`ML_ENGINE_URL__${toEnvKey(symbol)}`];
  return normalizeBaseUrl(envValue || explicitValue || fallbackUrl, fallbackUrl);
}

function parseInstrumentRegistryOverrides() {
  const raw = process.env.INSTRUMENT_REGISTRY_JSON;
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      console.warn(
        "[instrumentRegistry] INSTRUMENT_REGISTRY_JSON must be a JSON object keyed by symbol; ignoring override.",
      );
      return {};
    }
    return parsed;
  } catch (error) {
    console.warn(
      `[instrumentRegistry] Failed to parse INSTRUMENT_REGISTRY_JSON: ${error.message}`,
    );
    return {};
  }
}

function mergeRawRegistry(baseRegistry, overrides) {
  const merged = { ...baseRegistry };

  for (const [key, rawOverride] of Object.entries(overrides || {})) {
    if (!isPlainObject(rawOverride)) {
      console.warn(
        `[instrumentRegistry] Override for "${key}" must be an object; ignoring.`,
      );
      continue;
    }

    const canonicalSymbol = normalizeInstrumentSymbol(rawOverride.symbol || key);
    if (!canonicalSymbol) {
      console.warn("[instrumentRegistry] Encountered empty instrument key; ignoring.");
      continue;
    }

    merged[canonicalSymbol] = {
      ...(merged[canonicalSymbol] || {}),
      ...rawOverride,
      symbol: canonicalSymbol,
    };
  }

  return merged;
}

function buildInstrumentConfig(rawConfig, fallbackUrl) {
  const canonicalSymbol = normalizeInstrumentSymbol(rawConfig?.symbol);
  if (!canonicalSymbol) {
    return null;
  }

  const aliases = uniqueStrings(
    ensureArray(rawConfig.aliases),
    (value) => normalizeInstrumentSymbol(value),
  ).filter((value) => value && value !== canonicalSymbol);

  const config = {
    symbol: canonicalSymbol,
    aliases,
    mlEngineUrl: resolvePerInstrumentMlUrl(
      canonicalSymbol,
      rawConfig.mlEngineUrl,
      fallbackUrl,
    ),
    sessionType: String(rawConfig.sessionType || "nse").trim().toLowerCase() || "nse",
    timezoneOffset: parseInteger(rawConfig.timezoneOffset, 0),
    timeframe: String(rawConfig.timeframe || "5min").trim() || "5min",
    models: uniqueStrings(ensureArray(rawConfig.models)),
  };

  return deepFreeze(config);
}

function buildRegistryState() {
  const sharedMlEngineUrl = normalizeBaseUrl(
    process.env.ML_ENGINE_URL || process.env.ML_ENGINE_INTERNAL_URL,
    FALLBACK_ML_ENGINE_URL,
  );

  const mergedRawRegistry = mergeRawRegistry(
    BUILTIN_INSTRUMENTS,
    parseInstrumentRegistryOverrides(),
  );

  const bySymbol = {};
  const lookup = new Map();

  for (const rawConfig of Object.values(mergedRawRegistry)) {
    const config = buildInstrumentConfig(rawConfig, sharedMlEngineUrl);
    if (!config) {
      continue;
    }

    bySymbol[config.symbol] = config;
    lookup.set(toLookupKey(config.symbol), config.symbol);
    for (const alias of config.aliases) {
      lookup.set(toLookupKey(alias), config.symbol);
    }
  }

  const availableSymbols = Object.keys(bySymbol);
  if (availableSymbols.length === 0) {
    throw new Error(
      "[instrumentRegistry] No instruments are registered after applying overrides.",
    );
  }

  const requestedDefault = normalizeInstrumentSymbol(
    process.env.DEFAULT_INSTRUMENT || "NIFTY",
  );
  const resolvedDefault = bySymbol[requestedDefault]
    ? requestedDefault
    : lookup.get(toLookupKey(requestedDefault)) || null;
  const defaultSymbol = resolvedDefault || availableSymbols[0];

  return {
    bySymbol: deepFreeze(bySymbol),
    lookup,
    defaultSymbol,
  };
}

const registryState = buildRegistryState();

/** @type {Readonly<Record<string, InstrumentConfig>>} */
const INSTRUMENT_REGISTRY = registryState.bySymbol;

/** Default canonical symbol when callers omit or send an unknown symbol. */
const DEFAULT_INSTRUMENT = registryState.defaultSymbol;

function resolveInstrumentSymbol(symbol, { fallbackToDefault = true } = {}) {
  const normalized = normalizeInstrumentSymbol(symbol);
  if (!normalized) {
    return fallbackToDefault ? DEFAULT_INSTRUMENT : null;
  }

  if (INSTRUMENT_REGISTRY[normalized]) {
    return normalized;
  }

  const byAlias = registryState.lookup.get(toLookupKey(normalized));
  if (byAlias) {
    return byAlias;
  }

  return fallbackToDefault ? DEFAULT_INSTRUMENT : null;
}

function warnUnknownSymbol(symbol) {
  if (!symbol || unknownSymbolWarnings.has(symbol)) {
    return;
  }

  unknownSymbolWarnings.add(symbol);
  console.warn(
    `[instrumentRegistry] Unknown symbol "${symbol}", defaulting to ${DEFAULT_INSTRUMENT}`,
  );
}

/**
 * Get a canonical instrument config.
 * Backward compatible behavior: unknown symbols still fall back to the default.
 *
 * @param {string} [symbol=DEFAULT_INSTRUMENT]
 * @param {{ strict?: boolean }} [options]
 * @returns {InstrumentConfig | null}
 */
function getInstrumentConfig(symbol = DEFAULT_INSTRUMENT, options = {}) {
  const strict = Boolean(options.strict);
  const resolved = resolveInstrumentSymbol(symbol, {
    fallbackToDefault: !strict,
  });

  if (!resolved) {
    return null;
  }

  const normalized = normalizeInstrumentSymbol(symbol);
  if (
    !strict &&
    normalized &&
    !INSTRUMENT_REGISTRY[normalized] &&
    !registryState.lookup.has(toLookupKey(normalized))
  ) {
    warnUnknownSymbol(normalized);
  }

  return INSTRUMENT_REGISTRY[resolved];
}

function getMlEngineUrl(symbol = DEFAULT_INSTRUMENT, options = {}) {
  return getInstrumentConfig(symbol, options)?.mlEngineUrl ?? null;
}

function listInstruments() {
  return Object.keys(INSTRUMENT_REGISTRY);
}

function listInstrumentConfigs() {
  return listInstruments().map((symbol) => INSTRUMENT_REGISTRY[symbol]);
}

function isRegistered(symbol) {
  return Boolean(resolveInstrumentSymbol(symbol, { fallbackToDefault: false }));
}

export {
  DEFAULT_INSTRUMENT,
  INSTRUMENT_REGISTRY,
  getInstrumentConfig,
  getMlEngineUrl,
  isRegistered,
  listInstrumentConfigs,
  listInstruments,
  normalizeInstrumentSymbol,
  resolveInstrumentSymbol,
};
