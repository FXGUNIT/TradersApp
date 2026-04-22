import test from "node:test";
import assert from "node:assert/strict";

const ORIGINAL_FAILURE_THRESHOLD =
  process.env.INSTRUMENT_CIRCUIT_FAILURE_THRESHOLD;
const ORIGINAL_RESET_TIMEOUT_MS =
  process.env.INSTRUMENT_CIRCUIT_RESET_TIMEOUT_MS;
const ORIGINAL_HALF_OPEN_MAX_CALLS =
  process.env.INSTRUMENT_CIRCUIT_HALF_OPEN_MAX_CALLS;
const ORIGINAL_HALF_OPEN_SUCCESS_THRESHOLD =
  process.env.INSTRUMENT_CIRCUIT_HALF_OPEN_SUCCESS_THRESHOLD;

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

async function importRegistry() {
  const moduleUrl = new URL(
    "../services/circuitBreakerRegistry.mjs",
    import.meta.url,
  );
  return await import(`${moduleUrl.href}?ts=${Date.now()}-${Math.random()}`);
}

test("circuit breaker opens after the configured threshold", async () => {
  process.env.INSTRUMENT_CIRCUIT_FAILURE_THRESHOLD = "2";
  process.env.INSTRUMENT_CIRCUIT_RESET_TIMEOUT_MS = "50";
  process.env.INSTRUMENT_CIRCUIT_HALF_OPEN_MAX_CALLS = "1";
  process.env.INSTRUMENT_CIRCUIT_HALF_OPEN_SUCCESS_THRESHOLD = "1";

  const registry = await importRegistry();

  assert.equal(registry.recordFailure("NIFTY"), "closed");
  assert.equal(registry.isOpen("NIFTY"), false);
  assert.equal(registry.recordFailure("NIFTY"), "open");
  assert.equal(registry.isOpen("NIFTY"), true);

  const state = registry.getState("NIFTY");
  assert.equal(state.status, registry.CIRCUIT_STATUS.OPEN);
  assert.equal(state.failures, 2);
  assert.equal(state.failureThreshold, 2);
});

test("circuit breaker transitions to half-open and closes after successful probes", async () => {
  process.env.INSTRUMENT_CIRCUIT_FAILURE_THRESHOLD = "1";
  process.env.INSTRUMENT_CIRCUIT_RESET_TIMEOUT_MS = "20";
  process.env.INSTRUMENT_CIRCUIT_HALF_OPEN_MAX_CALLS = "2";
  process.env.INSTRUMENT_CIRCUIT_HALF_OPEN_SUCCESS_THRESHOLD = "2";

  const registry = await importRegistry();

  assert.equal(registry.recordFailure("BANKNIFTY"), "open");
  assert.equal(registry.isOpen("BANKNIFTY"), true);

  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(registry.isOpen("BANKNIFTY"), false);
  assert.equal(
    registry.getState("BANKNIFTY").status,
    registry.CIRCUIT_STATUS.HALF_OPEN,
  );

  assert.equal(registry.shouldAllowRequest("BANKNIFTY"), true);
  assert.equal(registry.shouldAllowRequest("BANKNIFTY"), true);
  assert.equal(registry.shouldAllowRequest("BANKNIFTY"), false);

  assert.equal(registry.recordSuccess("BANKNIFTY"), "half_open");
  assert.equal(
    registry.getState("BANKNIFTY").status,
    registry.CIRCUIT_STATUS.HALF_OPEN,
  );
  assert.equal(registry.shouldAllowRequest("BANKNIFTY"), true);
  assert.equal(registry.recordSuccess("BANKNIFTY"), "closed");

  const finalState = registry.getState("BANKNIFTY");
  assert.equal(finalState.status, registry.CIRCUIT_STATUS.CLOSED);
  assert.equal(finalState.failures, 0);
  assert.equal(finalState.totalFailures, 1);
  assert.equal(finalState.totalSuccesses, 2);
});

test("circuit breaker reopens immediately on half-open probe failure", async () => {
  process.env.INSTRUMENT_CIRCUIT_FAILURE_THRESHOLD = "1";
  process.env.INSTRUMENT_CIRCUIT_RESET_TIMEOUT_MS = "20";
  process.env.INSTRUMENT_CIRCUIT_HALF_OPEN_MAX_CALLS = "1";
  process.env.INSTRUMENT_CIRCUIT_HALF_OPEN_SUCCESS_THRESHOLD = "1";

  const registry = await importRegistry();

  assert.equal(registry.recordFailure("NSEOPTIONS"), "open");
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(registry.shouldAllowRequest("NSEOPTIONS"), true);
  assert.equal(registry.recordFailure("NSEOPTIONS"), "open");
  assert.equal(registry.isOpen("NSEOPTIONS"), true);

  const state = registry.getState("NSEOPTIONS");
  assert.equal(state.status, registry.CIRCUIT_STATUS.OPEN);
  assert.equal(state.totalFailures, 2);
});

test.after(() => {
  restoreEnv(
    "INSTRUMENT_CIRCUIT_FAILURE_THRESHOLD",
    ORIGINAL_FAILURE_THRESHOLD,
  );
  restoreEnv("INSTRUMENT_CIRCUIT_RESET_TIMEOUT_MS", ORIGINAL_RESET_TIMEOUT_MS);
  restoreEnv(
    "INSTRUMENT_CIRCUIT_HALF_OPEN_MAX_CALLS",
    ORIGINAL_HALF_OPEN_MAX_CALLS,
  );
  restoreEnv(
    "INSTRUMENT_CIRCUIT_HALF_OPEN_SUCCESS_THRESHOLD",
    ORIGINAL_HALF_OPEN_SUCCESS_THRESHOLD,
  );
});
