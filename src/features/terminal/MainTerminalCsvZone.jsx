import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { FileSpreadsheet } from "lucide-react";
import { CSS_VARS } from "../../styles/cssVars.js";
import { T, GlassSkeletonLoader, cardS, SHead } from "./terminalHelperComponents";
import { parseTerminalCsvText } from "./terminalCsvParser.js";

/**
 * MainTerminalCsvZone - Premarket CSV drop zone UI + CSV worker + parsing state.
 *
 * Owns: parsed, isCsvParsing, csvProgress, csvStatusText, csvBorderColor, csvStatusColor
 *
 * Exposes via ref:
 *   ref.current?.triggerCsvDrop()
 *   ref.current?.syncCsvState({ parsed, parseMsg, isCsvParsing })
 */
const MainTerminalCsvZone = forwardRef(function MainTerminalCsvZone(
  {
    onParsedChange,
    onParsingChange,
    onStatusChange,
    onErrorChange,
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

  useEffect(() => {
    onParsedChange?.(parsed);
  }, [onParsedChange, parsed]);

  useEffect(() => {
    onParsingChange?.(isCsvParsing);
  }, [isCsvParsing, onParsingChange]);

  useEffect(() => {
    onStatusChange?.(parseMsg);
  }, [onStatusChange, parseMsg]);

  const hasParsedCsv = parseMsg.startsWith("✓");
  const csvStatusText = isCsvParsing
    ? "Parsing CSV..."
    : parseMsg || "Drop NinjaTrader .txt / .csv — or click to browse";
  const csvStatusColor = hasParsedCsv ? T.green : isCsvParsing ? T.blue : CSS_VARS.textSecondary;
  const csvBorderColor = hasParsedCsv ? T.green : isCsvParsing ? T.blue : CSS_VARS.borderSubtle;

  const syncCsvState = useCallback((nextState = {}) => {
    if (Object.prototype.hasOwnProperty.call(nextState, "parsed")) {
      setParsed(nextState.parsed || null);
    }
    if (Object.prototype.hasOwnProperty.call(nextState, "parseMsg")) {
      setParseMsg(nextState.parseMsg || "");
    }
    if (Object.prototype.hasOwnProperty.call(nextState, "isCsvParsing")) {
      const nextIsParsing = Boolean(nextState.isCsvParsing);
      setIsCsvParsing(nextIsParsing);
      if (!nextIsParsing) {
        setCsvProgress(0);
      }
    }
  }, []);

  const applyCsvParseResult = useCallback((requestId, result) => {
    if (requestId !== csvParseRequestIdRef.current) return;

    const nextParsed = result?.parsed || null;
    const nextParseMsg = result?.parseMsg || "⚠ CSV parse failed";

    setIsCsvParsing(false);
    setCsvProgress(0);
    setParsed(nextParsed);
    setParseMsg(nextParseMsg);

    if (result?.ok) {
      onErrorChange?.("");
    }
  }, [onErrorChange]);

  useEffect(() => {
    if (typeof Worker === "undefined") return undefined;

    const worker = new Worker(new URL("./terminalCsv.worker.js", import.meta.url), {
      type: "module",
    });

    const handleMessage = (event) => {
      const { requestId, progress, ...rest } = event.data || {};
      if (progress !== undefined) {
        if (requestId === csvParseRequestIdRef.current) {
          setCsvProgress(progress);
        }
        return;
      }

      applyCsvParseResult(requestId, rest);
    };

    const handleError = () => {
      const requestId = csvParseRequestIdRef.current;
      if (!requestId) return;

      onErrorChange?.("CSV upload error: CSV parse failed");
      applyCsvParseResult(requestId, {
        ok: false,
        parsed: null,
        parseMsg: "⚠ CSV parse failed",
      });
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    csvParserWorkerRef.current = worker;

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
      if (csvParserWorkerRef.current === worker) {
        csvParserWorkerRef.current = null;
      }
    };
  }, [applyCsvParseResult, onErrorChange]);

  const handleCsvDrop = useCallback(async (event) => {
    event.preventDefault();

    const file = event.dataTransfer?.files?.[0] || event.target?.files?.[0];
    if (!file) return;

    const requestId = csvParseRequestIdRef.current + 1;
    csvParseRequestIdRef.current = requestId;

    onErrorChange?.("");
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

      const result = parseTerminalCsvText(text);
      if (!result?.ok) {
        onErrorChange?.(result?.parseMsg || "CSV upload error: CSV parse failed");
      }
      applyCsvParseResult(requestId, result);
    } catch (error) {
      const readMessage = error?.message || "Unable to read CSV export";
      onErrorChange?.(`CSV upload error: ${readMessage}`);
      applyCsvParseResult(requestId, {
        ok: false,
        parsed: null,
        parseMsg: `⚠ ${readMessage}`,
      });
    } finally {
      if (!csvParserWorkerRef.current) {
        setIsCsvParsing(false);
      }
    }
  }, [applyCsvParseResult, onErrorChange]);

  useImperativeHandle(ref, () => ({
    triggerCsvDrop() {
      fileInputRef.current?.click();
    },
    syncCsvState,
  }), [syncCsvState]);

  const surfaceMuted = CSS_VARS.baseLayer;

  return (
    <div style={cardS()}>
      <SHead icon={FileSpreadsheet} title="LOAD NINJATRADER 1-MIN DATA" color={T.blue} />

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
        <div
          onDrop={handleCsvDrop}
          onDragOver={(event) => event.preventDefault()}
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
          <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.25 }}>⊾</div>
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
