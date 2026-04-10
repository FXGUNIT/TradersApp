/**
 * consensusGateway — BFF ML consensus API calls
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import { hasBff } from '../../services/gateways/base.js';

const BFF_BASE = import.meta.env.VITE_BFF_URL || "http://127.0.0.1:8788";

/**
 * Fetch ML consensus signal from BFF.
 * Returns the raw JSON response — caller handles loading/error state.
 */
export async function fetchConsensus({ session = 1, signal: _signal } = {}) {
  if (!hasBff()) {
    throw new Error('ML Engine unavailable');
  }
  const res = await fetch(`${BFF_BASE}/ml/consensus?session=${session}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`ML consensus fetch failed: ${res.status}`);
  }
  return res.json();
}
