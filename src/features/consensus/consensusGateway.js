/**
 * consensusGateway — BFF ML consensus API calls
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import { hasBff } from "../../services/gateways/base.js";
import { resolveBffBaseUrl } from "../../services/runtimeConfig.js";

const BFF_BASE = resolveBffBaseUrl();

/**
 * Fetch ML consensus signal from BFF.
 * Returns the raw JSON response — caller handles loading/error state.
 */
export async function fetchConsensus({
  session = 1,
  signal: _signal,
  symbol = "NIFTY",
  candles,
  mathEngine,
  keyLevels,
} = {}) {
  if (!hasBff()) {
    throw new Error("ML Engine unavailable");
  }

  const searchParams = new URLSearchParams();
  searchParams.set("session", String(session));
  searchParams.set("symbol", String(symbol || "NIFTY"));

  if (candles) {
    searchParams.set("candles", JSON.stringify(candles));
  }
  if (mathEngine) {
    searchParams.set("mathEngine", JSON.stringify(mathEngine));
  }
  if (keyLevels) {
    searchParams.set("keyLevels", JSON.stringify(keyLevels));
  }

  const res = await fetch(`${BFF_BASE}/ml/consensus?${searchParams.toString()}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`ML consensus fetch failed: ${res.status}`);
  }
  return res.json();
}
