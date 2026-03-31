import { parseTerminalCsvText } from "./terminalCsvParser.js";

self.onmessage = (event) => {
  const { requestId, text } = event.data || {};

  try {
    const result = parseTerminalCsvText(text, (progress) => {
      // Forward progress to main thread so UI can update the skeleton loader
      self.postMessage({ requestId, progress });
    });
    self.postMessage({
      requestId,
      ...result,
      progress: 100,
    });
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      parsed: null,
      parseMsg: `⚠ ${error?.message || "CSV parse failed"}`,
      progress: 0,
    });
  }
};
