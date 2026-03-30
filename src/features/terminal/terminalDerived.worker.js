import { computeTerminalDerivedState } from "./terminalDerivedState.js";

self.onmessage = (event) => {
  const { requestId, payload } = event.data || {};

  try {
    const derivedState = computeTerminalDerivedState(payload);
    self.postMessage({
      requestId,
      ok: true,
      derivedState,
    });
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      error: error?.message || "Terminal derived state failed",
    });
  }
};
