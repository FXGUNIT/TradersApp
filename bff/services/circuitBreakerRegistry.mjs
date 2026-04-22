/**
 * Per-instrument circuit breaker registry.
 *
 * Backward-compatible surface:
 * - recordSuccess(symbol)
 * - recordFailure(symbol)
 * - isOpen(symbol)
 * - getState(symbol)
 *
 * New helpers:
 * - configureBreaker(symbol, options)
 * - shouldAllowRequest(symbol)
 * - listBreakerStates()
 * - resetBreaker(symbol)
 * - resetAllBreakers()
 *
 * @module circuitBreakerRegistry
 */

const CIRCUIT_STATUS = Object.freeze({
  CLOSED: "closed",
  OPEN: "open",
  HALF_OPEN: "half_open",
});

const DEFAULT_BREAKER_KEY = "__DEFAULT__";

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

const DEFAULT_BREAKER_OPTIONS = Object.freeze({
  failureThreshold: parsePositiveInteger(
    process.env.INSTRUMENT_CIRCUIT_FAILURE_THRESHOLD,
    5,
  ),
  resetTimeoutMs: parsePositiveInteger(
    process.env.INSTRUMENT_CIRCUIT_RESET_TIMEOUT_MS,
    30_000,
  ),
  halfOpenMaxCalls: parsePositiveInteger(
    process.env.INSTRUMENT_CIRCUIT_HALF_OPEN_MAX_CALLS,
    1,
  ),
  halfOpenSuccessThreshold: parsePositiveInteger(
    process.env.INSTRUMENT_CIRCUIT_HALF_OPEN_SUCCESS_THRESHOLD,
    1,
  ),
});

function normalizeSymbolKey(symbol) {
  const normalized = String(symbol ?? "").trim().toUpperCase();
  return normalized || DEFAULT_BREAKER_KEY;
}

function normalizeBreakerOptions(options = {}, baseOptions = DEFAULT_BREAKER_OPTIONS) {
  const failureThreshold = parsePositiveInteger(
    options.failureThreshold,
    baseOptions.failureThreshold,
  );
  const resetTimeoutMs = parsePositiveInteger(
    options.resetTimeoutMs,
    baseOptions.resetTimeoutMs,
  );
  const halfOpenMaxCalls = parsePositiveInteger(
    options.halfOpenMaxCalls,
    baseOptions.halfOpenMaxCalls,
  );
  const halfOpenSuccessThreshold = Math.min(
    halfOpenMaxCalls,
    parsePositiveInteger(
      options.halfOpenSuccessThreshold,
      baseOptions.halfOpenSuccessThreshold,
    ),
  );

  return {
    failureThreshold,
    resetTimeoutMs,
    halfOpenMaxCalls,
    halfOpenSuccessThreshold,
  };
}

function createBreakerState(symbolKey, options = DEFAULT_BREAKER_OPTIONS) {
  const normalizedOptions = normalizeBreakerOptions(options);
  return {
    symbol: symbolKey === DEFAULT_BREAKER_KEY ? "DEFAULT" : symbolKey,
    status: CIRCUIT_STATUS.CLOSED,
    failures: 0,
    lastFailure: 0,
    lastSuccess: 0,
    openedAt: 0,
    halfOpenInFlight: 0,
    halfOpenSuccesses: 0,
    totalFailures: 0,
    totalSuccesses: 0,
    ...normalizedOptions,
  };
}

/** @type {Map<string, ReturnType<typeof createBreakerState>>} */
const breakerStore = new Map();

function ensureBreaker(symbol) {
  const key = normalizeSymbolKey(symbol);
  if (!breakerStore.has(key)) {
    breakerStore.set(key, createBreakerState(key));
  }
  return breakerStore.get(key);
}

function transitionToClosed(state) {
  state.status = CIRCUIT_STATUS.CLOSED;
  state.failures = 0;
  state.halfOpenInFlight = 0;
  state.halfOpenSuccesses = 0;
  state.openedAt = 0;
}

function transitionToOpen(state, now = Date.now()) {
  state.status = CIRCUIT_STATUS.OPEN;
  state.openedAt = now;
  state.halfOpenInFlight = 0;
  state.halfOpenSuccesses = 0;
}

function refreshRecoveryWindow(state, now = Date.now()) {
  if (
    state.status === CIRCUIT_STATUS.OPEN &&
    state.lastFailure > 0 &&
    now - state.lastFailure >= state.resetTimeoutMs
  ) {
    state.status = CIRCUIT_STATUS.HALF_OPEN;
    state.halfOpenInFlight = 0;
    state.halfOpenSuccesses = 0;
  }
}

function createSnapshot(state) {
  refreshRecoveryWindow(state);
  const remainingCooldownMs =
    state.status === CIRCUIT_STATUS.OPEN
      ? Math.max(0, state.resetTimeoutMs - (Date.now() - state.lastFailure))
      : 0;

  return {
    symbol: state.symbol,
    status: state.status,
    failures: state.failures,
    lastFailure: state.lastFailure,
    lastSuccess: state.lastSuccess,
    openedAt: state.openedAt,
    halfOpenInFlight: state.halfOpenInFlight,
    halfOpenSuccesses: state.halfOpenSuccesses,
    totalFailures: state.totalFailures,
    totalSuccesses: state.totalSuccesses,
    failureThreshold: state.failureThreshold,
    resetTimeoutMs: state.resetTimeoutMs,
    halfOpenMaxCalls: state.halfOpenMaxCalls,
    halfOpenSuccessThreshold: state.halfOpenSuccessThreshold,
    remainingCooldownMs,
    isAvailable:
      state.status === CIRCUIT_STATUS.CLOSED ||
      (state.status === CIRCUIT_STATUS.HALF_OPEN &&
        state.halfOpenInFlight < state.halfOpenMaxCalls),
  };
}

function configureBreaker(symbol, options = {}) {
  const state = ensureBreaker(symbol);
  const nextOptions = normalizeBreakerOptions(options, state);
  state.failureThreshold = nextOptions.failureThreshold;
  state.resetTimeoutMs = nextOptions.resetTimeoutMs;
  state.halfOpenMaxCalls = nextOptions.halfOpenMaxCalls;
  state.halfOpenSuccessThreshold = nextOptions.halfOpenSuccessThreshold;
  if (state.halfOpenInFlight > state.halfOpenMaxCalls) {
    state.halfOpenInFlight = state.halfOpenMaxCalls;
  }
  if (state.halfOpenSuccesses > state.halfOpenSuccessThreshold) {
    state.halfOpenSuccesses = state.halfOpenSuccessThreshold;
  }
  return createSnapshot(state);
}

/**
 * Acquire permission to send a request for a symbol.
 * In HALF_OPEN state this consumes one probe slot until recordSuccess/failure.
 *
 * @param {string} symbol
 * @returns {boolean}
 */
function shouldAllowRequest(symbol) {
  const state = ensureBreaker(symbol);
  refreshRecoveryWindow(state);

  if (state.status === CIRCUIT_STATUS.OPEN) {
    return false;
  }

  if (state.status === CIRCUIT_STATUS.HALF_OPEN) {
    if (state.halfOpenInFlight >= state.halfOpenMaxCalls) {
      return false;
    }
    state.halfOpenInFlight += 1;
  }

  return true;
}

/**
 * Record a successful request for an instrument.
 *
 * @param {string} symbol
 * @returns {"closed" | "half_open"}
 */
function recordSuccess(symbol) {
  const state = ensureBreaker(symbol);
  refreshRecoveryWindow(state);

  if (state.status === CIRCUIT_STATUS.OPEN) {
    return state.status;
  }

  state.totalSuccesses += 1;
  state.lastSuccess = Date.now();

  if (state.status === CIRCUIT_STATUS.HALF_OPEN) {
    if (state.halfOpenInFlight > 0) {
      state.halfOpenInFlight -= 1;
    }

    state.halfOpenSuccesses += 1;
    if (state.halfOpenSuccesses >= state.halfOpenSuccessThreshold) {
      transitionToClosed(state);
    }
  } else {
    transitionToClosed(state);
  }

  return state.status;
}

/**
 * Record a failed request for an instrument.
 *
 * Backward-compatible return: callers only need to know whether the breaker
 * has opened.
 *
 * @param {string} symbol
 * @returns {"closed" | "open"}
 */
function recordFailure(symbol) {
  const state = ensureBreaker(symbol);
  refreshRecoveryWindow(state);

  if (state.status === CIRCUIT_STATUS.HALF_OPEN && state.halfOpenInFlight > 0) {
    state.halfOpenInFlight -= 1;
  }

  state.totalFailures += 1;
  state.lastFailure = Date.now();
  state.failures += 1;

  if (state.status === CIRCUIT_STATUS.HALF_OPEN) {
    transitionToOpen(state, state.lastFailure);
    return CIRCUIT_STATUS.OPEN;
  }

  if (state.failures >= state.failureThreshold) {
    transitionToOpen(state, state.lastFailure);
    return CIRCUIT_STATUS.OPEN;
  }

  return CIRCUIT_STATUS.CLOSED;
}

/**
 * Check whether the breaker is currently open (blocking traffic).
 * Once the recovery timeout passes, this returns false because the breaker
 * transitions to HALF_OPEN.
 *
 * @param {string} symbol
 * @returns {boolean}
 */
function isOpen(symbol) {
  const state = ensureBreaker(symbol);
  refreshRecoveryWindow(state);
  return state.status === CIRCUIT_STATUS.OPEN;
}

function getState(symbol) {
  return createSnapshot(ensureBreaker(symbol));
}

function listBreakerStates() {
  return Array.from(breakerStore.values(), (state) => createSnapshot(state)).sort(
    (left, right) => left.symbol.localeCompare(right.symbol),
  );
}

function resetBreaker(symbol) {
  const key = normalizeSymbolKey(symbol);
  breakerStore.delete(key);
}

function resetAllBreakers() {
  breakerStore.clear();
}

export {
  CIRCUIT_STATUS,
  configureBreaker,
  getState,
  isOpen,
  listBreakerStates,
  recordFailure,
  recordSuccess,
  resetAllBreakers,
  resetBreaker,
  shouldAllowRequest,
};
