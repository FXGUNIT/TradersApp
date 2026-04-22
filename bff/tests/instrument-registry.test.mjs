import test from "node:test";
import assert from "node:assert/strict";

const ORIGINAL_DEFAULT_INSTRUMENT = process.env.DEFAULT_INSTRUMENT;
const ORIGINAL_INSTRUMENT_REGISTRY_JSON = process.env.INSTRUMENT_REGISTRY_JSON;
const ORIGINAL_ML_ENGINE_URL = process.env.ML_ENGINE_URL;
const ORIGINAL_ML_ENGINE_INTERNAL_URL = process.env.ML_ENGINE_INTERNAL_URL;
const ORIGINAL_ML_ENGINE_URL_BANKNIFTY = process.env.ML_ENGINE_URL__BANKNIFTY;
const ORIGINAL_ML_ENGINE_URL_FINNIFTY = process.env.ML_ENGINE_URL__FINNIFTY;

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

async function importRegistry() {
  const moduleUrl = new URL("../services/instrumentRegistry.mjs", import.meta.url);
  return await import(`${moduleUrl.href}?ts=${Date.now()}-${Math.random()}`);
}

test("instrument registry resolves aliases and preserves default fallback behavior", async () => {
  process.env.ML_ENGINE_URL = "http://shared-ml:8001/";
  delete process.env.ML_ENGINE_INTERNAL_URL;
  delete process.env.DEFAULT_INSTRUMENT;
  delete process.env.INSTRUMENT_REGISTRY_JSON;
  delete process.env.ML_ENGINE_URL__BANKNIFTY;
  delete process.env.ML_ENGINE_URL__FINNIFTY;

  const registry = await importRegistry();

  assert.equal(registry.DEFAULT_INSTRUMENT, "NIFTY");
  assert.equal(registry.resolveInstrumentSymbol("bank nifty"), "BANKNIFTY");
  assert.equal(registry.resolveInstrumentSymbol("NIFTY 50"), "NIFTY");
  assert.equal(registry.isRegistered("bank-nifty"), true);
  assert.equal(registry.isRegistered("missing-symbol"), false);
  assert.equal(registry.getInstrumentConfig("missing-symbol").symbol, "NIFTY");
  assert.equal(registry.getInstrumentConfig("bank-nifty").symbol, "BANKNIFTY");
  assert.equal(
    registry.getInstrumentConfig("bank-nifty").mlEngineUrl,
    "http://shared-ml:8001",
  );
});

test("instrument registry supports env-driven default symbol and dynamic additions", async () => {
  process.env.DEFAULT_INSTRUMENT = "bank nifty";
  process.env.ML_ENGINE_INTERNAL_URL = "http://internal-ml:8001/";
  delete process.env.ML_ENGINE_URL;
  process.env.ML_ENGINE_URL__BANKNIFTY = "http://bank-ml:8002/";
  process.env.ML_ENGINE_URL__FINNIFTY = "http://finni-ml:8003/";
  process.env.INSTRUMENT_REGISTRY_JSON = JSON.stringify({
    FINNIFTY: {
      aliases: ["FIN NIFTY"],
      sessionType: "nse",
      timezoneOffset: 330,
      timeframe: "1min",
      models: ["direction", "regime"],
    },
  });

  const registry = await importRegistry();

  assert.equal(registry.DEFAULT_INSTRUMENT, "BANKNIFTY");
  assert.equal(registry.getInstrumentConfig().symbol, "BANKNIFTY");
  assert.equal(registry.getMlEngineUrl("BANKNIFTY"), "http://bank-ml:8002");
  assert.equal(registry.resolveInstrumentSymbol("fin nifty"), "FINNIFTY");
  assert.deepEqual(registry.getInstrumentConfig("FINNIFTY").models, [
    "direction",
    "regime",
  ]);
  assert.equal(
    registry.getInstrumentConfig("FINNIFTY").mlEngineUrl,
    "http://finni-ml:8003",
  );
  assert.equal(registry.listInstruments().includes("FINNIFTY"), true);
  assert.equal(registry.getInstrumentConfig("missing", { strict: true }), null);
});

test.after(() => {
  restoreEnv("DEFAULT_INSTRUMENT", ORIGINAL_DEFAULT_INSTRUMENT);
  restoreEnv("INSTRUMENT_REGISTRY_JSON", ORIGINAL_INSTRUMENT_REGISTRY_JSON);
  restoreEnv("ML_ENGINE_URL", ORIGINAL_ML_ENGINE_URL);
  restoreEnv("ML_ENGINE_INTERNAL_URL", ORIGINAL_ML_ENGINE_INTERNAL_URL);
  restoreEnv("ML_ENGINE_URL__BANKNIFTY", ORIGINAL_ML_ENGINE_URL_BANKNIFTY);
  restoreEnv("ML_ENGINE_URL__FINNIFTY", ORIGINAL_ML_ENGINE_URL_FINNIFTY);
});
