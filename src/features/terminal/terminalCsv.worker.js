import { parseTerminalCsvText } from "./terminalCsvParser.js";

self.onmessage = (event) => {
  const { requestId, text } = event.data || {};

  try {
    const result = parseTerminalCsvText(text);
    self.postMessage({
      requestId,
      ...result,
    });
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      parsed: null,
      parseMsg: `⚠ ${error?.message || "CSV parse failed"}`,
    });
  }
};
