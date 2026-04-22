/**
 * Circuit Breaker Registry — per-instrument failure tracking.
 * Prevents cascading failures by tracking ML engine health per instrument.
 * @module circuitBreakerRegistry
 */

/**
 * @typedef {Object} CircuitBreakerState
 * @property {number} failures    - Consecutive failures since last success
 * @property {number} lastFailure - Unix timestamp of last failure (ms)
 * @property {string} status      - "closed" | "open" | "half_open"
 */

/** @type {Record<string, CircuitBreakerState>} */
const _breakers = {};

/** Open after this many consecutive failures */
const FAILURE_THRESHOLD = 5;
/** Reset after this many ms of no failures */
const RESET_TIMEOUT_MS = 30_000;

function _getOrCreate(symbol) {
  if (!_breakers[symbol]) {
    _breakers[symbol] = { failures: 0, lastFailure: 0, status: "closed" };
  }
  return _breakers[symbol];
}

/**
 * Record a successful call for an instrument.
 * @param {string} symbol
 */
function recordSuccess(symbol) {
  const b = _getOrCreate(symbol);
  b.failures = 0;
  b.status = "closed";
}

/**
 * Record a failed call for an instrument.
 * @param {string} symbol
 * @returns {"closed" | "open"} new status
 */
function recordFailure(symbol) {
  const b = _getOrCreate(symbol);
  b.failures += 1;
  b.lastFailure = Date.now();
  if (b.failures >= FAILURE_THRESHOLD) {
    b.status = "open";
    return "open";
  }
  return "closed";
}

/**
 * Check if an instrument's circuit is open (calls should be rejected).
 * @param {string} symbol
 * @returns {boolean} true if calls should be blocked
 */
function isOpen(symbol) {
  const b = _getOrCreate(symbol);
  if (b.status === "closed") return false;
  // Auto-reset after timeout
  if (Date.now() - b.lastFailure > RESET_TIMEOUT_MS) {
    b.status = "closed";
    b.failures = 0;
    return false;
  }
  return b.status === "open";
}

/**
 * Get the full state for an instrument.
 * @param {string} symbol
 * @returns {CircuitBreakerState}
 */
function getState(symbol) {
  return { ..._getOrCreate(symbol) };
}

export { recordSuccess, recordFailure, isOpen, getState };
