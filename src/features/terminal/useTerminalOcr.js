/**
 * useTerminalOcr.js — BFF hook owning Tesseract.js OCR state and execution.
 *
 * Responsibilities:
 * - Lazily initialises the Tesseract worker on first scan
 * - Reports progress (0-100) for the scan-line animation
 * - Extracts indicator values from all screenshots, merging results
 * - Returns a stable `runOcr` callback to TradeTab
 */

import { useCallback, useRef, useState } from "react";
import { runScreenOcr } from "./terminalOcrService.js";

export const OCR_STATES = {
  IDLE:    "idle",
  LOADING: "loading",  // Tesseract WASM loading
  SCANNING: "scanning", // Actively OCR-ing image
  SUCCESS: "success",
  ERROR:   "error",
};

/**
 * @param {object}   params
 * @param {object[]} params.screenshots  - Array of { type, b64 } image objects
 * @param {function} params.onResult     - Called with extractedVals on success
 * @param {function} params.showToast    - Stable showToast callback
 *
 * @returns {{
 *   ocrState:   string,
 *   ocrProgress: number,       // 0-100
 *   ocrResult:  object|null,
 *   runOcr:     () => void,
 *   ocrStatus:  string,        // Human-readable status for the button label
 * }}
 */
export function useTerminalOcr({ screenshots, onResult, showToast }) {
  const [ocrState,   setOcrState]   = useState(OCR_STATES.IDLE);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResult,  setOcrResult]  = useState(null);

  // Keep refs to avoid stale closures in async callbacks
  const screenshotsRef = useRef(screenshots);
  const onResultRef    = useRef(onResult);
  screenshotsRef.current = screenshots;
  onResultRef.current   = onResult;

  const runOcr = useCallback(async () => {
    setOcrResult(null); // clear stale values from prior run
    if (!screenshotsRef.current.length) {
      showToast?.("No screenshots to scan.", "warning");
      return;
    }

    setOcrState(OCR_STATES.LOADING);
    setOcrProgress(5);

    const allValues = {};

    try {
      // Try each screenshot until we get labelled results
      for (let i = 0; i < screenshotsRef.current.length; i++) {
        setOcrState(OCR_STATES.SCANNING);
        setOcrProgress(Math.round((i / screenshotsRef.current.length) * 80) + 10);

        const result = await runScreenOcr(screenshotsRef.current[i], ({ progress }) => {
          // Progress within a single image: 10-90% of total budget
          const imgProgress = 10 + Math.round(progress * 70 * (1 / screenshotsRef.current.length));
          setOcrProgress(Math.min(imgProgress + (i / screenshotsRef.current.length) * 70, 95));
        });

        // Merge labelled results from each screenshot
        if (result && result.values && Object.keys(result.values).length > 0) {
          Object.assign(allValues, result.values);
        }
      }

      setOcrProgress(95);

      if (Object.keys(allValues).length === 0) {
        setOcrState(OCR_STATES.ERROR);
        showToast?.("No readable numbers found in screenshots.", "warning");
        return;
      }

      // Success
      setOcrResult(allValues);
      setOcrState(OCR_STATES.SUCCESS);
      setOcrProgress(100);
      onResultRef.current?.(allValues);

      // Build a readable summary for the toast
      const parts = [
        allValues.adx         != null && `ADX ${allValues.adx}`,
        allValues.ci          != null && `CI ${allValues.ci}`,
        allValues.atr         != null && `ATR ${allValues.atr}`,
        allValues.vwap        != null && `VWAP ${allValues.vwap}`,
        allValues.currentPrice != null && `Price ${allValues.currentPrice}`,
      ].filter(Boolean);

      const label = parts.length > 0
        ? `Scanned: ${parts.slice(0, 3).join(" · ")}${parts.length > 3 ? " · …" : ""}`
        : "Screen scanned — values populated";

      showToast?.(label, "success", 4000);

    } catch (err) {
      setOcrState(OCR_STATES.ERROR);
      const msg = err?.message || "OCR scan failed";
      showToast?.(`Scan failed: ${msg}`, "error");
    }
  }, [showToast]); // showToast is stable (useCallback)

  // Human-readable status for the scan button
  const ocrStatus = (() => {
    switch (ocrState) {
      case OCR_STATES.LOADING:  return "Loading OCR engine…";
      case OCR_STATES.SCANNING: return `Scanning… ${ocrProgress}%`;
      case OCR_STATES.SUCCESS:  return "✓ Scan complete";
      case OCR_STATES.ERROR:    return "✗ Scan failed — retry";
      default:                  return "◉ Scan Screen";
    }
  })();

  return {
    ocrState,
    ocrProgress,
    ocrResult,
    runOcr,
    ocrStatus,
  };
}
