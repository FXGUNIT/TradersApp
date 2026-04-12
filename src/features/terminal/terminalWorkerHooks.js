/**
 * Terminal Worker Setup Hooks
 * Extracted from MainTerminal.jsx for file size compliance.
 * Manages Web Worker lifecycle for CSV parsing, journal metrics, and terminal derived state.
 */
import { useEffect, useRef } from "react";

/**
 * CSV Parser Worker setup hook.
 * Fires applyCsvParseResult(requestId, result) on worker messages.
 * Falls back to parseTerminalCsvText when workers unavailable.
 */
export function useCsvParserWorker({ csvParserWorkerRef, csvParseRequestIdRef, applyCsvParseResult }) {
  useEffect(() => {
    if (typeof Worker === "undefined") return undefined;

    const worker = new Worker(new URL("./terminalCsv.worker.js", import.meta.url), { type: "module" });

    const handleMessage = (event) => {
      const { requestId, progress, ...result } = event.data || {};
      if (progress !== undefined) {
        // handled via requestId check in parent
        return;
      }
      applyCsvParseResult(requestId, result);
    };

    const handleError = () => {
      const requestId = csvParseRequestIdRef.current;
      if (!requestId) return;
      applyCsvParseResult(requestId, { ok: false, parsed: null, parseMsg: "⚠ CSV parse failed" });
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    csvParserWorkerRef.current = worker;

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
      if (csvParserWorkerRef.current === worker) csvParserWorkerRef.current = null;
    };
  }, [applyCsvParseResult, csvParseRequestIdRef]);
}

/**
 * Journal Metrics Worker setup hook.
 */
export function useJournalMetricsWorker({
  journalMetricsWorkerRef,
  journalMetricsRequestIdRef,
  applyJournalMetricsResult,
  journal,
}) {
  useEffect(() => {
    latestJournalRef.current = journal;
  }, [journal]);

  useEffect(() => {
    if (typeof Worker === "undefined") return undefined;

    const worker = new Worker(new URL("./journalMetrics.worker.js", import.meta.url), { type: "module" });

    const handleMessage = (event) => {
      const { requestId, ok, metrics: nextMetrics } = event.data || {};
      applyJournalMetricsResult(
        requestId,
        ok ? nextMetrics : computeJournalMetrics(latestJournalRef.current),
      );
    };

    const handleError = () => {
      const requestId = journalMetricsRequestIdRef.current;
      if (!requestId) return;
      applyJournalMetricsResult(requestId, computeJournalMetrics(latestJournalRef.current));
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    journalMetricsWorkerRef.current = worker;

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
      if (journalMetricsWorkerRef.current === worker) journalMetricsWorkerRef.current = null;
    };
  }, [applyJournalMetricsResult, journalMetricsRequestIdRef]);

  const latestJournalRef = useRef([]);
  useEffect(() => {
    latestJournalRef.current = journal;
  }, [journal]);

  useEffect(() => {
    const requestId = journalMetricsRequestIdRef.current + 1;
    journalMetricsRequestIdRef.current = requestId;
    if (!Array.isArray(journal) || journal.length === 0) {
      applyJournalMetricsResult(requestId, EMPTY_JOURNAL_METRICS);
      return;
    }
    setIsJournalMetricsPending(true);
    const worker = journalMetricsWorkerRef.current;
    if (worker) {
      worker.postMessage({ requestId, journal });
      return;
    }
    applyJournalMetricsResult(requestId, computeJournalMetrics(journal));
  }, [applyJournalMetricsResult, journal, journalMetricsRequestIdRef]);
}

/**
 * Terminal Derived State Worker setup hook.
 */
export function useTerminalDerivedWorker({
  terminalDerivedWorkerRef,
  terminalDerivedRequestIdRef,
  applyTerminalDerivedResult,
  terminalDerivedInput,
  setIsTerminalDerivedPending,
}) {
  useEffect(() => {
    latestTerminalDerivedInputRef.current = terminalDerivedInput;
  }, [terminalDerivedInput]);

  useEffect(() => {
    if (typeof Worker === "undefined") return undefined;

    const worker = new Worker(new URL("./terminalDerived.worker.js", import.meta.url), { type: "module" });

    const handleMessage = (event) => {
      const { requestId, ok, derivedState } = event.data || {};
      applyTerminalDerivedResult(
        requestId,
        ok ? derivedState : computeTerminalDerivedState(latestTerminalDerivedInputRef.current),
      );
    };

    const handleError = () => {
      const requestId = terminalDerivedRequestIdRef.current;
      if (!requestId) return;
      applyTerminalDerivedResult(requestId, computeTerminalDerivedState(latestTerminalDerivedInputRef.current));
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    terminalDerivedWorkerRef.current = worker;

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
      if (terminalDerivedWorkerRef.current === worker) terminalDerivedWorkerRef.current = null;
    };
  }, [applyTerminalDerivedResult, terminalDerivedRequestIdRef]);

  const latestTerminalDerivedInputRef = useRef(null);

  useEffect(() => {
    const requestId = terminalDerivedRequestIdRef.current + 1;
    terminalDerivedRequestIdRef.current = requestId;
    setIsTerminalDerivedPending(true);
    const worker = terminalDerivedWorkerRef.current;
    if (worker) {
      worker.postMessage({ requestId, payload: terminalDerivedInput });
      return;
    }
    applyTerminalDerivedResult(requestId, computeTerminalDerivedState(terminalDerivedInput));
  }, [applyTerminalDerivedResult, terminalDerivedInput, terminalDerivedRequestIdRef]);
}

// Dummy imports — actual values provided via props
import { EMPTY_JOURNAL_METRICS, computeJournalMetrics } from "./journalMetrics.js";
import { EMPTY_TERMINAL_DERIVED_STATE, computeTerminalDerivedState } from "./terminalDerivedState.js";