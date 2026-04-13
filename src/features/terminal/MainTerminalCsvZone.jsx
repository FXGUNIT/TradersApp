import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { T, GlassSkeletonLoader, cardS, SHead } from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";
import { FileSpreadsheet } from "lucide-react";
import { parseTerminalCsvText } from "./terminalCsvParser.js";

/**
 * MainTerminalCsvZone — Premarket CSV drop zone UI + CSV worker + parsing state.
 *
 * Owns: parsed, isCsvParsing, csvProgress, csvStatusText, csvBorderColor, csvStatusColor
 *
 * Exposes handleCsvDrop via ref so MainTerminal can call it without re-renders:
 *   ref.current?.triggerCsvDrop() — simulates a drop event on the hidden file input
 */
const MainTerminalCsvZone = forwardRef(function MainTerminalCsvZone(
  {
    onParsedChange,    // (parsed: object|null) => void  [optional]
    onParsingChange,   // (v: boolean) => void           [optional]
    onStatusChange,    // (msg: string) => void          [optional]
  },
  ref,
) {
  const [parsed, setParsed] = useState(null);
  const [parseMsg, setParseMsg] = useState("");
  const [isCsvParsing, setIsCsvParsing] = useState(false);
  const [csvProgress, setCsvProgress] = useState(0);

  const csvParserWorkerRef = useRef(null);
  const csvParseRequestIdRef = useRef(0);
  const fileInputRef = useRef(null);

  // ── Notify parent of state changes (optional — component works standalone) ──
  useEffect(() => {
    onParsedChange?.(parsed);
  }, [parsed, onParsedChange]);

  useEffect(() => {
    onParsingChange?.(isCsvParsing);
  }, [isCsvParsing, onParsingChange]);

  useEffect(() => {
    onStatusChange?.(parseMsg);
  }, [parseMsg, onStatusChange]);

  // ── Derived display values ────────────────────────────────────────────────
  const hasParsedCsv = parseMsg.startsWith("✓");
  const csvStatusText = isCsvParsing
    ? "Parsing CSV..."
    : parseMsg || "Drop NinjaTrader .txt / .csv — or click to browse";
  const csvStatusColor = hasParsedCsv ? T.green : isCsvParsing ? T.blue : CSS_VARS.textSecondary;
  const csvBorderColor = hasParsedCsv ? T.green : isCsvParsing ? T.blue : CSS_VARS.borderSubtle;

  // ── Apply parse result from worker or sync fallback ───────────────────────
  const applyCsvParseResult = useCallback((requestId, result) => {
    if (requestId !== csvParseRequestIdRef.current) return;
    setIsCsvParsing(false);
    setCsvProgress(0);
    setParsed(result?.parsed || null);
    setParseMsg(result?.parseMsg || "⚠ CSV parse failed");
  }, []);

  // ── CSV Worker lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
    if (typeof Worker === "undefined") return undefined;

    const worker = new Worker(new URL("./terminalCsv.worker.js", import.meta.url), {
      type: "module",
    });

    const handleMessage = (event) => {
      const { requestId, progress, ...rest } = event.data || {};
      if (progress !== undefined) {
        const currentId = csvParseRequestIdRef.current;
        if (requestId === currentId) setCsvProgress(progress);
        return;
      }
      applyCsvParseResult(requestId, rest);
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
  }, [applyCsvParseResult]);

  // ── CSV drop handler ────────────────────────────────────────────────────
  const handleCsvDrop = useCallback(async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (!file) return;

    const requestId = csvParseRequestIdRef.current + 1;
    csvParseRequestIdRef.current = requestId;
    setErr?.("");
    setParsed(null);
    setParseMsg("");
    setIsCsvParsing(true);
    setCsvProgress(0);

    try {
      const text = await file.text();
      const worker = csvParserWorkerRef.current;

      if (worker) {
        worker.postMessage({ requestId, text });
        return;
      }
      // Worker unavailable — synchronous fallback
      const result = parseTerminalCsvText(text);
      applyCsvParseResult(requestId, result);
    } catch (error) {
      applyCsvParseResult(requestId, {
        ok: false,
        parsed: null,
        parseMsg: `⚠ ${error?.message || "Unable to read CSV export"}`,
      });
    } finally {
      if (!csvParserWorkerRef.current) setIsCsvParsing(false);
    }
  }, [applyCsvParseResult, setErr]);

  // ── Expose triggerCsvDrop via ref ────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    triggerCsvDrop: () => {
      fileInputRef.current?.click();
    },
  }), []);

  const surfaceMuted = CSS_VARS.baseLayer;

  return (
    <div style={cardS()}>
      <SHead icon={FileSpreadsheet} title="LOAD NINJATRADER 1-MIN DATA" color={T.blue} />

      {/* ── Glass Skeleton during parsing ── */}
      {isCsvParsing ? (
        <div
          style={{
            border: `2px dashed ${T.blue}50`,
            borderRadius: 8,
            padding: "8px",
            background: surfaceMuted,
          }}
          className="glass-panel"
        >
          <GlassSkeletonLoader
            progress={csvProgress}
            color={T.blue}
            label="Parsing NinjaTrader data"
            title="NINJATRADER 1-MIN DATA"
          />
        </div>
      ) : (
        /* ── Normal drop zone ── */
        <div
          onDrop={handleCsvDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${csvBorderColor}`,
            borderRadius: 8,
            padding: "24px",
            textAlign: "center",
            cursor: "pointer",
            background: surfaceMuted,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv"
            style={{ display: "none" }}
            onChange={handleCsvDrop}
          />
          <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.25 }}>⊞</div>
          <div style={{ color: csvStatusColor, fontSize: 12, fontWeight: 600 }}>
            {csvStatusText}
          </div>
          {parsed && (
            <div
              style={{
                color: CSS_VARS.textTertiary,
                fontSize: 11,
                marginTop: 4,
              }}
            >
              Latest: {parsed.days[parsed.days.length - 1]?.date} · ATR(14) =
              <span style={{ color: T.green, fontWeight: 700 }}>
                {" "}{parsed.tradingHoursAtr14} pts
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default MainTerminalCsvZone;
