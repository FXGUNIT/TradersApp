/**
 * Instrument Registry — maps trading symbols to their ML model configuration.
 * Single source of truth for which ML engine handles which instrument.
 * @module instrumentRegistry
 */

/**
 * @typedef {Object} InstrumentConfig
 * @property {string} symbol         - Ticker symbol (e.g. "NIFTY", "BANKNIFTY")
 * @property {string} mlEngineUrl   - Base URL for the ML engine serving this symbol
 * @property {string} sessionType   - "nse" | "forex" | "crypto"
 * @property {number} timezoneOffset - UTC offset in minutes (e.g. 330 for IST)
 */

/** @type {Record<string, InstrumentConfig>} */
const INSTRUMENT_REGISTRY = {
  NIFTY: {
    symbol: "NIFTY",
    mlEngineUrl: process.env.ML_ENGINE_URL || "http://ml-engine:8001",
    sessionType: "nse",
    timezoneOffset: 330, // IST = UTC+5:30
    timeframe: "5min",
    models: ["direction", "regime", "session", "magnitude"],
  },
  BANKNIFTY: {
    symbol: "BANKNIFTY",
    mlEngineUrl: process.env.ML_ENGINE_URL || "http://ml-engine:8001",
    sessionType: "nse",
    timezoneOffset: 330,
    timeframe: "5min",
    models: ["direction", "regime", "session"],
  },
  NSEOPTIONS: {
    symbol: "NSEOPTIONS",
    mlEngineUrl: process.env.ML_ENGINE_URL || "http://ml-engine:8001",
    sessionType: "nse",
    timezoneOffset: 330,
    timeframe: "5min",
    models: ["direction", "regime", "alpha"],
  },
};

/** Default instrument when none specified */
const DEFAULT_INSTRUMENT = "NIFTY";

/**
 * Get the config for an instrument symbol.
 * @param {string} [symbol=DEFAULT_INSTRUMENT]
 * @returns {InstrumentConfig}
 */
function getInstrumentConfig(symbol = DEFAULT_INSTRUMENT) {
  if (!INSTRUMENT_REGISTRY[symbol]) {
    console.warn(`[instrumentRegistry] Unknown symbol "${symbol}", defaulting to ${DEFAULT_INSTRUMENT}`);
    return INSTRUMENT_REGISTRY[DEFAULT_INSTRUMENT];
  }
  return INSTRUMENT_REGISTRY[symbol];
}

/**
 * List all registered instrument symbols.
 * @returns {string[]}
 */
function listInstruments() {
  return Object.keys(INSTRUMENT_REGISTRY);
}

/**
 * Check if an instrument is registered.
 * @param {string} symbol
 * @returns {boolean}
 */
function isRegistered(symbol) {
  return symbol in INSTRUMENT_REGISTRY;
}

export { INSTRUMENT_REGISTRY, DEFAULT_INSTRUMENT, getInstrumentConfig, listInstruments, isRegistered };
