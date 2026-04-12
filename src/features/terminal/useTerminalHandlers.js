/**
 * useTerminalHandlers — custom hook for all async/event handlers in MainTerminal.
 * Extracted for file size compliance (MainTerminal was 2126 lines).
 *
 * Usage:
 *   const handlers = useTerminalHandlers({ ... all deps ... });
 *   handlers.runPart1();  // all handlers are already wrapped in useCallback
 */
import { useCallback, useRef } from "react";
import {
  parseJsonChoice,
  parseRrrMultiple,
  buildTradePlannerState,
  buildP2JournalState,
} from "./terminalStateHelpers.js";
import {
  MAX_HISTORY_ENTRIES,
  buildResetWorkspaceState,
  RESET_MESSAGES,
} from "./terminalWorkspaceState.js";
import {
  buildPart1TextMsg,
  buildPart2TextMsg,
  buildPremarketContent,
  buildScreenshotsContent,
  parseAmdPhaseFromResponse,
  buildP2JournalEntry,
  buildManualJournalEntry,
  countConsecutiveLosses,
  parseCsvTextInline,
} from "./terminalAiHandlers.js";

const CIRCUIT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CONSECUTIVE_LOSSES = 3;

export function useTerminalHandlers({
  // State setters
  setErr, setLoading, setP1Out, setP2Out,
  setCurrentAMD, setExtracting, setExtractStatus,
  setFirmRules, setTcFileName,
  setScreenshots, setExtractedVals,
  setParsed, setParseMsg, setIsCsvParsing, setCsvProgress,
  setShowP2TradeForm, setP2Jf,
  setShowForm,
  setJournal, setAccountState,
  setResetDialog,
  // State values
  screenshots, parsed, p1NewsChart, p1PremarketChart, p1KeyLevelsChart,
  p1Out, currentAMD, liveAmdPhase, f, fr, curBal, hwmVal, ist,
  extractedVals, slPts, ptVal, maxRiskUSD, sd1Target, sd2Target,
  volatilityRegime, accountState, execBlocked, execBlockReason,
  terminalDraftKey,
  // AI imports
  runPremarketAnalysisWithAi, runTradePlanWithAi, extractIndicatorsWithAi,
  parseFirmRulesWithAi,
  // Prompt imports
  SCREENSHOT_EXTRACT_PROMPT, TNC_PARSE_PROMPT, PART1_PROMPT, PART2_PROMPT,
  AMD_PHASES,
  // Other
  showToast, onSaveAccount, onSaveJournal, onSaveFirmRules,
  buildBaseWorkspaceState, restoreWorkspaceState, clearDraft,
  today, contracts, firmRules, csvParseRequestIdRef, applyCsvParseResult,
}) {
  // ── CSV Drop Handler ─────────────────────────────────────────────────────────
  const handleCsvDrop = useCallback(async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (!file) return;
    const requestId = csvParseRequestIdRef.current + 1;
    csvParseRequestIdRef.current = requestId;
    setErr(""); setParsed(null); setParseMsg(""); setIsCsvParsing(true); setCsvProgress(0);
    try {
      const text = await file.text();
      const result = parseCsvTextInline(text);
      applyCsvParseResult(requestId, {
        ok: days => days.length >= 5,
        parsed: result.days.length >= 5 ? result : null,
        parseMsg: result.days.length >= 5
          ? `✓ ${result.totalBars.toLocaleString()} bars → ${result.totalDays} days`
          : `⚠ Only ${result.days.length} days — need 5+`,
      });
    } catch (error) {
      applyCsvParseResult(requestId, { ok: false, parsed: null, parseMsg: `⚠ ${error?.message || "Unable to read CSV export"}` });
    } finally {
      setIsCsvParsing(false);
    }
  }, [applyCsvParseResult, csvParseRequestIdRef, setErr, setIsCsvParsing, setCsvProgress, setParsed, setParseMsg]);

  // ── Screenshot Drop Handler ──────────────────────────────────────────────────
  const handleScreenshotDrop = useCallback(async (event) => {
    event.preventDefault();
    const files = Array.from(event?.dataTransfer?.files || event?.target?.files || []).filter(Boolean);
    const nextAssets = await Promise.all(files.map(file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const dataUrl = String(readerEvent?.target?.result || "");
        const [, b64 = ""] = dataUrl.split(",", 2);
        resolve({ name: file?.name || "image", type: file?.type || "image/png", b64 });
      };
      reader.onerror = () => reject(reader.error || new Error("Failed to read dropped file."));
      reader.readAsDataURL(file);
    })));
    setScreenshots(current => [...current, ...nextAssets].slice(0, 4));
  }, [setScreenshots]);

  // ── T&C Parsing ──────────────────────────────────────────────────────────────
  const parseTandC = useCallback(async (text, fileName = "") => {
    if (!String(text || "").trim()) {
      setFirmRules(prev => ({ ...prev, parseStatus: "✗ T&C document is empty." }));
      return;
    }
    setFirmRules(prev => ({ ...prev, parseStatus: `Reading T&C document${fileName ? `: ${fileName}` : ""}...` }));
    try {
      const data = await parseFirmRulesWithAi({ prompt: TNC_PARSE_PROMPT, sourceText: text });
      const vals = parseJsonChoice(data, {});
      const updated = { ...firmRules, ...vals, parsed: true, parseStatus: `✓ Parsed: ${vals.firmName || "Unknown Firm"}` };
      setFirmRules(updated);
      showToast?.(`T&C loaded${updated.firmName ? `: ${updated.firmName}` : ""}`, "success");
    } catch (error) {
      setFirmRules(prev => ({ ...prev, parseStatus: `✗ Parse failed — ${error?.message || "Unknown error"}` }));
    }
  }, [firmRules, showToast, setFirmRules]);

  // ── Firm Rules Drop Handler ───────────────────────────────────────────────────
  const handleFirmRulesDrop = useCallback((event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0] || event.target?.files?.[0];
    if (!file) return;
    setTcFileName(file.name || "");
    const reader = new FileReader();
    reader.onload = async (readerEvent) => { await parseTandC(String(readerEvent.target?.result || ""), file.name); };
    reader.onerror = () => { setFirmRules(prev => ({ ...prev, parseStatus: "✗ Failed to read T&C document." })); };
    reader.readAsText(file);
  }, [parseTandC, setFirmRules, setTcFileName]);

  // ── AI Extract from Screenshots ───────────────────────────────────────────────
  const extractFromScreenshots = useCallback(async () => {
    if (!screenshots.length) return;
    setExtracting(true); setExtractStatus("Reading...");
    try {
      const data = await extractIndicatorsWithAi({ prompt: SCREENSHOT_EXTRACT_PROMPT, screenshots });
      const vals = parseJsonChoice(data, {});
      setExtractedVals(prev => ({ ...prev, ...Object.fromEntries(Object.entries(vals).filter(([, v]) => v !== null && typeof v !== 'object')) }));
      if (vals.currentPrice) setF(prev => ({ ...prev, currentPrice: String(vals.currentPrice) }));
      setExtractStatus(`✓ ${[vals.adx && `ADX=${vals.adx}`, vals.ci && `CI=${vals.ci}`, vals.atr && `ATR=${vals.atr}`, vals.currentPrice && `Price=${vals.currentPrice}`].filter(Boolean).join(' · ')}`);
    } catch (err) {
      const msg = err.message || '';
      setExtractStatus(msg.includes('image') || msg.includes('does not support') ? "✗ Model doesn't support images" : `✗ ${msg || 'Extract failed'}`);
    } finally {
      setExtracting(false);
    }
  }, [screenshots, setExtracting, setExtractStatus, setExtractedVals]);

  // ── Run Part 1 (Premarket Analysis) ──────────────────────────────────────────
  const runPart1 = useCallback(async () => {
    if (!parsed || parsed.totalDays < 5) { setErr('Upload a valid NinjaTrader CSV file with at least 5 days.'); return; }
    setErr(''); setLoading(true); setP1Out('');
    try {
      const content = buildPremarketContent({ p1NewsChart, p1PremarketChart, p1KeyLevelsChart });
      content.push({ type: 'text', text: buildPart1TextMsg({ parsed, ist }) });
      const data = await runPremarketAnalysisWithAi({ maxTokens: 4000, messages: [{ role: 'system', content: PART1_PROMPT }, { role: 'user', content: JSON.stringify(content) }] });
      const response = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.text || 'No response.');
      setP1Out(response);
      const detectedPhase = parseAmdPhaseFromResponse(response, AMD_PHASES);
      if (detectedPhase) { setCurrentAMD(detectedPhase); }
      else if (liveAmdPhase !== "UNCLEAR") { setCurrentAMD(liveAmdPhase); }
      setTimeout(() => {}, 100); // placeholder for scroll ref
    } catch(e) { setErr('API error: ' + e.message); }
    finally { setLoading(false); }
  }, [parsed, ist, p1NewsChart, p1PremarketChart, p1KeyLevelsChart, liveAmdPhase, setCurrentAMD, setErr, setLoading, setP1Out, PART1_PROMPT, runPremarketAnalysisWithAi, AMD_PHASES]);

  // ── Run Part 2 (Trade Execution) ──────────────────────────────────────────────
  const runPart2 = useCallback(async () => {
    if (execBlocked) { setErr(`Blocked: ${execBlockReason}`); return; }
    if (!f.entryPrice) { setErr('Entry price required.'); return; }
    setErr(''); setLoading(true); setP2Out(''); setShowP2TradeForm(false);
    try {
      const content = buildScreenshotsContent({ mpChart: f._mpChart, vwapChart: f._vwapChart, screenshots });
      content.push({ type: 'text', text: buildPart2TextMsg({ p1Out, displayedAmdPhase: currentAMD, liveAmdPhase, f, ptVal, maxRiskUSD, extractedVals, sd1Target, sd2Target, volatilityRegime, fr, curBal, hwmVal, slPts }) });
      const data = await runTradePlanWithAi({ maxTokens: 4000, messages: [{ role: 'system', content: PART2_PROMPT }, { role: 'user', content: JSON.stringify(content) }] });
      const response = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || data?.text || 'No response.');
      setP2Out(response);
      setP2Jf({ exit: '', result: 'win', pnl: '', balAfter: '', lessons: '', amdPhase: currentAMD });
      setTimeout(() => {}, 100);
    } catch { setErr('API error.'); }
    finally { setLoading(false); }
  }, [execBlocked, execBlockReason, f, p1Out, currentAMD, liveAmdPhase, screenshots, ptVal, maxRiskUSD, extractedVals, sd1Target, sd2Target, volatilityRegime, fr, curBal, hwmVal, slPts, setErr, setLoading, setP2Out, setShowP2TradeForm, setP2Jf, PART2_PROMPT, runTradePlanWithAi]);

  // ── Add P2 Trade ─────────────────────────────────────────────────────────────
  const addP2Trade = useCallback(() => {
    if (!f.exit) { setErr('Exit price required.'); return; }
    const predictedP2TP1 = Number.isFinite(parseFloat(f.entryPrice))
      ? parseFloat(f.entryPrice) + (f.direction === "Long" ? 1 : -1) * slPts * parseRrrMultiple(f.rrr)
      : null;
    const predictedP2SL = Number.isFinite(parseFloat(f.entryPrice))
      ? parseFloat(f.entryPrice) - (f.direction === "Long" ? 1 : -1) * slPts
      : null;
    const entry = {
      date: today, instrument: f.instrument, direction: f.direction, tradeType: f.tradeType,
      amdPhase: f.amdPhase || currentAMD, rrr: f.rrr, result: f.result, entry: f.entryPrice,
      exit: f.exit, actualExit: f.exit,
      predictedTP1: Number.isFinite(predictedP2TP1) ? predictedP2TP1.toFixed(2) : "",
      predictedSL: Number.isFinite(predictedP2SL) ? predictedP2SL.toFixed(2) : "",
      contracts: String(contracts), pnl: f.pnl, session: 'Trading Hours',
      balAfter: f.balAfter, setup: `${f.timeIST || '?'} IST | ${f.direction} @ ${f.entryPrice} | ${f.rrr}`,
      lessons: f.lessons, id: `trade-${Date.now()}`,
    };
    setJournal(prev => {
      const updated = [...prev, entry];
      if (countConsecutiveLosses(updated) >= MAX_CONSECUTIVE_LOSSES) {
        const until = Date.now() + CIRCUIT_COOLDOWN_MS;
        try { localStorage.setItem("tilt_circuit_until", String(until)); } catch {}
        window.dispatchEvent(new Event("tilt-lock"));
        showToast?.("Circuit breaker: 3+ consecutive losses. Execution locked for 15 minutes.", "circuit");
      }
      return updated;
    });
    if (f.balAfter) { const upd = { ...accountState, currentBalance: f.balAfter }; setAccountState(upd); onSaveAccount?.(upd); }
    setShowP2TradeForm(false); setErr('');
    showToast?.('Trade vector recorded. Journal synchronized.', 'success');
  }, [f, slPts, today, currentAMD, contracts, accountState, onSaveAccount, showToast, setAccountState, setErr, setJournal, setShowP2TradeForm]);

  // ── Add Journal Entry ────────────────────────────────────────────────────────
  const addJournalEntry = useCallback(() => {
    if (!f.entry || !f.exit) return;
    const entry = buildManualJournalEntry({ jf: f, slPts });
    setJournal(prev => [...prev, entry]);
    // reset form fields
    setF(prev => ({ ...prev, entry: '', exit: '', predictedTP1: '', actualExit: '', pnl: '', setup: '', lessons: '', balAfter: '' }));
  }, [f, slPts, setJournal]);

  // ── Reset Action ─────────────────────────────────────────────────────────────
  const runResetAction = useCallback(async (scope) => {
    const baseline = buildBaseWorkspaceState();
    const currentState = {}; // caller passes full state
    const nextState = buildResetWorkspaceState({ scope, currentState, baseline });
    restoreWorkspaceState(nextState, scope === "all");
    if (terminalDraftKey && scope === "all") await clearDraft(terminalDraftKey);
    showToast?.(RESET_MESSAGES[scope] || "Workspace reset complete.", "success");
  }, [buildBaseWorkspaceState, restoreWorkspaceState, terminalDraftKey, showToast]);

  return {
    handleCsvDrop,
    handleScreenshotDrop,
    parseTandC,
    handleFirmRulesDrop,
    extractFromScreenshots,
    runPart1,
    runPart2,
    addP2Trade,
    addJournalEntry,
    runResetAction,
  };
}