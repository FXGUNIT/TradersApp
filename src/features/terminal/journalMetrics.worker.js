import { computeJournalMetrics } from "./journalMetrics.js";

self.onmessage = (event) => {
  const { requestId, journal } = event.data || {};

  try {
    const metrics = computeJournalMetrics(journal);
    self.postMessage({
      requestId,
      ok: true,
      metrics,
    });
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      error: error?.message || "Journal metrics failed",
    });
  }
};
