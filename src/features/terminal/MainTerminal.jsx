import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeJournalMetrics,
  EMPTY_JOURNAL_METRICS,
} from "./journalMetrics";
import {
  makeImgHandler,
} from "./terminalUploadUtils";
import {
  computeTerminalDerivedState,
  EMPTY_TERMINAL_DERIVED_STATE,
} from "./terminalDerivedState.js";
import {
  buildAccountState,
  buildEquityCurvePath,
  getISTDateString,
  normalizeJournal,
  parseRrrMultiple,
  parseWorkspaceSnapshot,
  buildTradePlannerState,
  buildP2JournalState,
  buildJournalFormState,
} from "./terminalStateHelpers.js";
import TerminalTradeReadinessPanel from "./TerminalTradeReadinessPanel.jsx";
import PremarketTab from "./PremarketTab.jsx";
import TradeTab from "./TradeTab.jsx";
import JournalTab from "./JournalTab.jsx";
import AccountTab from "./AccountTab.jsx";
import {
  T,
  AMD_PHASES,
  TIME_OPTIONS,
  Tag,
  AMDPhaseTag,
  CountdownBanner,
  glowBtn,
} from "./terminalHelperComponents";
import {
  SCREENSHOT_EXTRACT_PROMPT,
  TNC_PARSE_PROMPT,
  PART1_PROMPT,
  PART2_PROMPT,
} from "./terminalAiPrompts.js";
import { CSS_VARS } from "../../styles/cssVars.js";
import {
  clearDraft,
  getDraftStorageKey,
  readDraft,
  writeDraft,
} from "../../services/draftVault.js";
import {
  extractChoiceText,
  extractIndicatorsWithAi,
  parseFirmRulesWithAi,
  parseJsonChoice,
  runPremarketAnalysisWithAi,
  runTradePlanWithAi,
} from "../../services/clients/TerminalAnalyticsClient.js";
import { getISTState } from "../../utils/tradingUtils.js";
import { usePasteListener } from "./terminalPasteListener.js";
import {
  DEFAULT_EXTRACTED_VALS,
  DEFAULT_FIRM_RULES,
  MAX_HISTORY_ENTRIES,
  RESET_MESSAGES,
  ROTATING_QUOTES,
  buildResetWorkspaceState,
  RESET_DIALOG_CONTENT,
} from "./terminalWorkspaceState.js";
import { QuoteBanner, NavigationTabs, AutosaveBar, DrawdownThrottleBanner } from "./TerminalNav.jsx";
import TerminalHeader from "./TerminalHeader.jsx";
import MainTerminalTicker from "./MainTerminalTicker.jsx";

const overlayTint = "var(--surface-overlay, rgba(15,23,42,0.5))";
const modalShadow = "var(--shadow-deep, 0 30px 80px rgba(15,23,42,0.18))";

// Aliases for backward compatibility with rest of MainTerminal
const defaultExtractedVals = DEFAULT_EXTRACTED_VALS;
const defaultFirmRules = DEFAULT_FIRM_RULES;

export default function MainTerminal({
  profile,
  onLogout,
  onSaveJournal,
  onSaveAccount,
  onSaveFirmRules,
  showToast,
  onNavigateToConsciousness,
  auth: _auth,
}) {
  const auditScenario =
    typeof window !== "undefined"
      ? window.__TRADERS_AUDIT_DATA?.scenario || ""
      : "";
  const [activeTab, setActiveTab] = useState(() =>
    auditScenario === "app" ? "trade" : "premarket",
  );
  const [screenshots, setScreenshots] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [extractStatus, setExtractStatus] = useState("");
  const [extractedVals, setExtractedVals] = useState(defaultExtractedVals);
  
  const [activeZone, setActiveZone] = useState(null);
  const [mpChart, setMpChart] = useState(null);
  const [vwapChart, setVwapChart] = useState(null);
  
  const [p1NewsChart, setP1NewsChart] = useState(null);
  const [p1PremarketChart, setP1PremarketChart] = useState(null);
  const [p1KeyLevelsChart, setP1KeyLevelsChart] = useState(null);
  
  const [journal, setJournal] = useState(() =>
    normalizeJournal(profile?.journal),
  );
  const [accountState, setAccountState] = useState(() =>
    buildAccountState(profile?.accountState),
  );
  const [firmRules, setFirmRules] = useState(
    () => profile?.firmRules || defaultFirmRules,
  );
  const [tcParsing, setTcParsing] = useState(false);
  const [tcFileName, setTcFileName] = useState("");
  
  const [currentAMD, setCurrentAMD] = useState("UNCLEAR");
  const [p1Out, setP1Out] = useState("");
  const [p2Out, setP2Out] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [, setMarketRefresh] = useState(0);
  
  const ist = getISTState();

  useEffect(() => {
    if (auditScenario === "app") {
      setActiveTab("trade");
      setShowForm(true);
      return;
    }
    setActiveTab("premarket");
    setShowForm(false);
  }, [auditScenario]);
  
  const [parsed, setParsed] = useState(null);
  const [parseMsg, setParseMsg] = useState("");
  const [isCsvParsing, setIsCsvParsing] = useState(false);
  
  const [f, setF] = useState(buildTradePlannerState);
  const sf = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  
  const [showP2TradeForm, setShowP2TradeForm] = useState(false);
  const [p2Jf, setP2Jf] = useState(buildP2JournalState);
  const sp2 = (k) => (v) => setP2Jf((p) => ({ ...p, [k]: v }));
  
  const [jf, setJf] = useState(buildJournalFormState);
  const sjf = (k) => (v) => setJf((p) => ({ ...p, [k]: v }));
  
  const [showForm, setShowForm] = useState(() => auditScenario === "app");
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [workspaceHistory, setWorkspaceHistory] = useState([]);
  const [resetDialog, setResetDialog] = useState(null);
  
  const p1Ref = useRef(null);
  const p2Ref = useRef(null);
  const csvZoneRef = useRef(null);
  const terminalDraftKey = useMemo(
    () => (profile?.uid ? `terminal-workspace:${profile.uid}` : null),
    [profile?.uid],
  );
  const [draftStatus, setDraftStatus] = useState({
    hydrated: false,
    lastSavedAt: null,
    error: "",
  });
  const draftHydratedRef = useRef(false);
  const skipHistoryRef = useRef(false);
  const lastSnapshotRef = useRef("");

  const journalDidMount = useRef(false);
  const accountDidMount = useRef(false);
  const firmRulesDidMount = useRef(false);
  const journalMetricsWorkerRef = useRef(null);
  const journalMetricsRequestIdRef = useRef(0);
  const latestJournalRef = useRef([]);
  const [metrics, setMetrics] = useState(EMPTY_JOURNAL_METRICS);
  const [isJournalMetricsPending, setIsJournalMetricsPending] = useState(false);
  const terminalDerivedWorkerRef = useRef(null);
  const terminalDerivedRequestIdRef = useRef(0);
  const latestTerminalDerivedInputRef = useRef(null);
  const [terminalDerivedState, setTerminalDerivedState] = useState(() =>
    computeTerminalDerivedState({
      parsed: null,
      extractedVals,
      accountState,
      firmRules,
      tradeForm: f,
    }),
  );
  const [isTerminalDerivedPending, setIsTerminalDerivedPending] = useState(false);

  // ── Consecutive Loss Circuit Breaker ─────────────────────────────────────────
  const CIRCUIT_BREAKER_KEY = "tilt_circuit_until";
  const CIRCUIT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
  const MAX_CONSECUTIVE_LOSSES = 3;

  const getCircuitUntil = () => {
    try {
      const v = localStorage.getItem(CIRCUIT_BREAKER_KEY);
      return v ? parseInt(v, 10) : 0;
    } catch { return 0; }
  };
  const setCircuitUntil = (ts) => {
    try { localStorage.setItem(CIRCUIT_BREAKER_KEY, String(ts)); } catch { /* best-effort */ }
  };

  // Derive isCircuitBreakerActive from localStorage timestamp
  const isCircuitBreakerActive =
    Date.now() < getCircuitUntil();

  const applyJournalMetricsResult = useCallback((requestId, nextMetrics) => {
    if (requestId !== journalMetricsRequestIdRef.current) {
      return;
    }

    setMetrics(nextMetrics || EMPTY_JOURNAL_METRICS);
    setIsJournalMetricsPending(false);
  }, []);

  useEffect(() => {
    latestJournalRef.current = journal;
  }, [journal]);

  useEffect(() => {
    if (typeof Worker === "undefined") {
      return undefined;
    }

    const worker = new Worker(new URL("./journalMetrics.worker.js", import.meta.url), {
      type: "module",
    });

    const handleMessage = (event) => {
      const { requestId, ok, metrics: nextMetrics } = event.data || {};
      applyJournalMetricsResult(
        requestId,
        ok ? nextMetrics : computeJournalMetrics(latestJournalRef.current),
      );
    };

    const handleError = () => {
      const requestId = journalMetricsRequestIdRef.current;
      if (!requestId) {
        return;
      }
      applyJournalMetricsResult(
        requestId,
        computeJournalMetrics(latestJournalRef.current),
      );
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    journalMetricsWorkerRef.current = worker;

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
      if (journalMetricsWorkerRef.current === worker) {
        journalMetricsWorkerRef.current = null;
      }
    };
  }, [applyJournalMetricsResult]);

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
  }, [applyJournalMetricsResult, journal]);

  const terminalDerivedInput = useMemo(
    () => ({
      parsed,
      extractedVals,
      accountState,
      firmRules,
      tradeForm: f,
    }),
    [accountState, extractedVals, f, firmRules, parsed],
  );

  const applyTerminalDerivedResult = useCallback((requestId, nextDerivedState) => {
    if (requestId !== terminalDerivedRequestIdRef.current) {
      return;
    }

    setTerminalDerivedState(nextDerivedState || EMPTY_TERMINAL_DERIVED_STATE);
    setIsTerminalDerivedPending(false);
  }, []);

  useEffect(() => {
    latestTerminalDerivedInputRef.current = terminalDerivedInput;
  }, [terminalDerivedInput]);

  useEffect(() => {
    if (typeof Worker === "undefined") {
      return undefined;
    }

    const worker = new Worker(new URL("./terminalDerived.worker.js", import.meta.url), {
      type: "module",
    });

    const handleMessage = (event) => {
      const { requestId, ok, derivedState } = event.data || {};
      applyTerminalDerivedResult(
        requestId,
        ok
          ? derivedState
          : computeTerminalDerivedState(latestTerminalDerivedInputRef.current),
      );
    };

    const handleError = () => {
      const requestId = terminalDerivedRequestIdRef.current;
      if (!requestId) {
        return;
      }
      applyTerminalDerivedResult(
        requestId,
        computeTerminalDerivedState(latestTerminalDerivedInputRef.current),
      );
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    terminalDerivedWorkerRef.current = worker;

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
      if (terminalDerivedWorkerRef.current === worker) {
        terminalDerivedWorkerRef.current = null;
      }
    };
  }, [applyTerminalDerivedResult]);

  useEffect(() => {
    const requestId = terminalDerivedRequestIdRef.current + 1;
    terminalDerivedRequestIdRef.current = requestId;
    setIsTerminalDerivedPending(true);

    const worker = terminalDerivedWorkerRef.current;
    if (worker) {
      worker.postMessage({ requestId, payload: terminalDerivedInput });
      return;
    }

    applyTerminalDerivedResult(
      requestId,
      computeTerminalDerivedState(terminalDerivedInput),
    );
  }, [applyTerminalDerivedResult, terminalDerivedInput]);

  const applyWorkspaceState = useCallback((nextState) => {
    setActiveTab(nextState.activeTab);
    setScreenshots(Array.isArray(nextState.screenshots) ? nextState.screenshots : []);
    setExtractStatus(nextState.extractStatus || "");
    setExtractedVals({
      ...defaultExtractedVals,
      ...(nextState.extractedVals || {}),
    });
    setActiveZone(nextState.activeZone || null);
    setMpChart(nextState.mpChart || null);
    setVwapChart(nextState.vwapChart || null);
    setP1NewsChart(nextState.p1NewsChart || null);
    setP1PremarketChart(nextState.p1PremarketChart || null);
    setP1KeyLevelsChart(nextState.p1KeyLevelsChart || null);
    setJournal(Array.isArray(nextState.journal) ? nextState.journal : []);
    setAccountState(buildAccountState(nextState.accountState));
    setFirmRules({
      ...defaultFirmRules,
      ...(nextState.firmRules || {}),
    });
    setTcFileName(nextState.tcFileName || "");
    setCurrentAMD(nextState.currentAMD || "UNCLEAR");
    setP1Out(nextState.p1Out || "");
    setP2Out(nextState.p2Out || "");
    setParsed(nextState.parsed || null);
    setParseMsg(nextState.parseMsg || "");
    setF({
      ...buildTradePlannerState(),
      ...(nextState.f || {}),
    });
    setShowP2TradeForm(Boolean(nextState.showP2TradeForm));
    setP2Jf({
      ...buildP2JournalState(),
      ...(nextState.p2Jf || {}),
    });
    setJf({
      ...buildJournalFormState(),
      ...(nextState.jf || {}),
    });
    setShowForm(Boolean(nextState.showForm));
  }, []);

  const buildBaseWorkspaceState = useCallback(
    () => ({
      activeTab: auditScenario === "app" ? "trade" : "premarket",
      screenshots: [],
      extractStatus: "",
      extractedVals: defaultExtractedVals,
      activeZone: null,
      mpChart: null,
      vwapChart: null,
      p1NewsChart: null,
      p1PremarketChart: null,
      p1KeyLevelsChart: null,
      journal: normalizeJournal(profile?.journal),
      accountState: buildAccountState(profile?.accountState),
      firmRules: {
        ...defaultFirmRules,
        ...(profile?.firmRules || {}),
      },
      tcFileName: "",
      currentAMD: "UNCLEAR",
      p1Out: "",
      p2Out: "",
      parsed: null,
      parseMsg: "",
      f: buildTradePlannerState(),
      showP2TradeForm: false,
      p2Jf: buildP2JournalState(),
      jf: buildJournalFormState(),
      showForm: auditScenario === "app",
    }),
    [auditScenario, profile?.accountState, profile?.firmRules, profile?.journal],
  );

  const buildCurrentWorkspaceState = useCallback(
    () => ({
      activeTab,
      screenshots,
      extractStatus,
      extractedVals,
      activeZone,
      mpChart,
      vwapChart,
      p1NewsChart,
      p1PremarketChart,
      p1KeyLevelsChart,
      journal,
      accountState,
      firmRules,
      tcFileName,
      currentAMD,
      p1Out,
      p2Out,
      parsed,
      parseMsg,
      f,
      showP2TradeForm,
      p2Jf,
      jf,
      showForm,
    }),
    [
      activeTab,
      screenshots,
      extractStatus,
      extractedVals,
      activeZone,
      mpChart,
      vwapChart,
      p1NewsChart,
      p1PremarketChart,
      p1KeyLevelsChart,
      journal,
      accountState,
      firmRules,
      tcFileName,
      currentAMD,
      p1Out,
      p2Out,
      parsed,
      parseMsg,
      f,
      showP2TradeForm,
      p2Jf,
      jf,
      showForm,
    ],
  );

  const mergeWorkspaceState = useCallback(
    (baseline, persistedDraft) => {
      if (!persistedDraft) {
        return baseline;
      }

      return {
        ...baseline,
        ...persistedDraft,
        extractedVals: {
          ...defaultExtractedVals,
          ...(persistedDraft.extractedVals || {}),
        },
        accountState: buildAccountState(
          persistedDraft.accountState || baseline.accountState,
        ),
        firmRules: {
          ...defaultFirmRules,
          ...(persistedDraft.firmRules || {}),
        },
        f: {
          ...buildTradePlannerState(),
          ...(persistedDraft.f || {}),
        },
        p2Jf: {
          ...buildP2JournalState(),
          ...(persistedDraft.p2Jf || {}),
        },
        jf: {
          ...buildJournalFormState(),
          ...(persistedDraft.jf || {}),
        },
        journal: Array.isArray(persistedDraft.journal)
          ? persistedDraft.journal
          : baseline.journal,
        screenshots: Array.isArray(persistedDraft.screenshots)
          ? persistedDraft.screenshots
          : [],
      };
    },
    [],
  );

  const handleCsvParsedChange = useCallback((nextParsed) => {
    setParsed(nextParsed || null);
  }, []);

  const handleCsvParsingChange = useCallback((nextIsParsing) => {
    setIsCsvParsing(Boolean(nextIsParsing));
  }, []);

  const handleCsvStatusChange = useCallback((nextStatus) => {
    setParseMsg(nextStatus || "");
  }, []);

  const handleCsvErrorChange = useCallback((nextError) => {
    setErr(nextError || "");
  }, []);

  useEffect(() => {
    if (activeTab !== "premarket") {
      return;
    }

    csvZoneRef.current?.syncCsvState({
      parsed,
      parseMsg,
      isCsvParsing,
    });
  }, [activeTab, isCsvParsing, parseMsg, parsed]);

  useEffect(() => {
    let cancelled = false;

    const hydrateWorkspace = async () => {
      const baseline = buildBaseWorkspaceState();

      if (!terminalDraftKey) {
        applyWorkspaceState(baseline);
        draftHydratedRef.current = true;
        setDraftStatus({
          hydrated: true,
          lastSavedAt: null,
          error: "",
        });
        return;
      }

      const persistedDraft = await readDraft(terminalDraftKey, null);
      if (cancelled) {
        return;
      }

      const mergedState = mergeWorkspaceState(baseline, persistedDraft);

      applyWorkspaceState(mergedState);
      lastSnapshotRef.current = JSON.stringify(mergedState);
      setWorkspaceHistory([]);
      draftHydratedRef.current = true;
      setDraftStatus({
        hydrated: true,
        lastSavedAt: persistedDraft?.savedAt || null,
        error: "",
      });
    };

    draftHydratedRef.current = false;
    void hydrateWorkspace();

    return () => {
      cancelled = true;
    };
  }, [applyWorkspaceState, buildBaseWorkspaceState, mergeWorkspaceState, terminalDraftKey]);

  useEffect(() => {
    if (!terminalDraftKey || !draftHydratedRef.current) {
      return undefined;
    }

    const snapshot = buildCurrentWorkspaceState();
    const serialized = JSON.stringify(snapshot);

    if (serialized === lastSnapshotRef.current) {
      if (skipHistoryRef.current) {
        skipHistoryRef.current = false;
      }
      return undefined;
    }

    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
    } else {
      const previousSnapshot = parseWorkspaceSnapshot(lastSnapshotRef.current);
      if (previousSnapshot) {
        setWorkspaceHistory((current) => {
          const nextHistory = [...current, previousSnapshot];
          return nextHistory.slice(-MAX_HISTORY_ENTRIES);
        });
      }
    }

    lastSnapshotRef.current = serialized;

    const payload = {
      ...snapshot,
      savedAt: new Date().toISOString(),
    };

    const timer = setTimeout(() => {
      void writeDraft(terminalDraftKey, payload)
        .then(() => {
          setDraftStatus((current) => ({
            ...current,
            lastSavedAt: payload.savedAt,
            error: "",
          }));
        })
        .catch((error) => {
          setDraftStatus((current) => ({
            ...current,
            error: error?.message || "Autosave failed.",
          }));
        });
    }, 180);

    return () => clearTimeout(timer);
  }, [buildCurrentWorkspaceState, terminalDraftKey]);

  useEffect(() => {
    if (!terminalDraftKey || !draftHydratedRef.current) {
      return undefined;
    }

    const storageKey = getDraftStorageKey(terminalDraftKey);
    const handleStorage = (event) => {
      if (event.key !== storageKey || !event.newValue) {
        return;
      }

      void readDraft(terminalDraftKey, null).then((persistedDraft) => {
        if (!persistedDraft) {
          return;
        }

        const baseline = buildBaseWorkspaceState();
        const mergedState = mergeWorkspaceState(baseline, persistedDraft);
        skipHistoryRef.current = true;
        applyWorkspaceState(mergedState);
        lastSnapshotRef.current = JSON.stringify(mergedState);
        setDraftStatus((current) => ({
          ...current,
          lastSavedAt: persistedDraft.savedAt || current.lastSavedAt,
          error: "",
        }));
      });
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [
    applyWorkspaceState,
    buildBaseWorkspaceState,
    mergeWorkspaceState,
    terminalDraftKey,
  ]);

  useEffect(() => {
    if (activeTab === "journal") {
      setShowForm(true);
    }
  }, [activeTab]);

  useEffect(() => {
    const current = Number.parseFloat(accountState.currentBalance || "0");
    const high = Number.parseFloat(accountState.highWaterMark || "0");

    if (Number.isFinite(current) && current > high) {
      setAccountState((previous) => ({
        ...previous,
        highWaterMark: String(current),
      }));
    }
  }, [accountState.currentBalance, accountState.highWaterMark]);

  useEffect(() => {
    if (!journalDidMount.current) {
      journalDidMount.current = true;
      return;
    }
    if (onSaveJournal) {
      void onSaveJournal(journal);
    }
  }, [journal, onSaveJournal]);

  useEffect(() => {
    if (!accountDidMount.current) {
      accountDidMount.current = true;
      return;
    }
    if (onSaveAccount) {
      void onSaveAccount(accountState);
    }
  }, [accountState, onSaveAccount]);

  useEffect(() => {
    if (!firmRulesDidMount.current) {
      firmRulesDidMount.current = true;
      return;
    }
    if (onSaveFirmRules) {
      void onSaveFirmRules(firmRules);
    }
  }, [firmRules, onSaveFirmRules]);

  const equityCurveView = useMemo(
    () => buildEquityCurvePath(metrics.equityCurve),
    [metrics.equityCurve],
  );
  const activeQuote = ROTATING_QUOTES[quoteIndex] || ROTATING_QUOTES[0];

  const restoreWorkspaceState = useCallback(
    (nextState, shouldClearHistory = false) => {
      skipHistoryRef.current = true;
      applyWorkspaceState(nextState);
      lastSnapshotRef.current = JSON.stringify(nextState);
      if (shouldClearHistory) {
        setWorkspaceHistory([]);
      }
      setDraftStatus((current) => ({
        ...current,
        error: "",
      }));
    },
    [applyWorkspaceState],
  );

  const handleUndoLastChange = useCallback(() => {
    if (!workspaceHistory.length) {
      return;
    }

    const previousSnapshot = workspaceHistory[workspaceHistory.length - 1];
    setWorkspaceHistory((current) => current.slice(0, -1));
    restoreWorkspaceState(previousSnapshot);
  }, [restoreWorkspaceState, workspaceHistory]);

  const runResetAction = useCallback(
    async (scope) => {
      const baseline = buildBaseWorkspaceState();
      const currentState = buildCurrentWorkspaceState();
      const nextState = buildResetWorkspaceState({ scope, currentState, baseline });
      restoreWorkspaceState(nextState, scope === "all");
      if (terminalDraftKey && scope === "all") await clearDraft(terminalDraftKey);
      showToast?.(RESET_MESSAGES[scope] || "Workspace reset complete.", "success");
    },
    [buildBaseWorkspaceState, buildCurrentWorkspaceState, restoreWorkspaceState, terminalDraftKey, showToast],
  );

  const openResetDialog = useCallback(
    (scope) => {
      setResetDialog({ scope, ...(RESET_DIALOG_CONTENT[scope] || RESET_DIALOG_CONTENT.all) });
    },
    [],
  );

  // Trading calculations
  const {
    maxRiskUSD,
    activeRiskPct,
    VR,
    volatilityRegime,
    atrVal,
    slPts,
    ptVal,
    contracts,
    proposedSLDollars,
    sd1Target,
    sd2Target,
    sweepEstimate,
    liveAmdContext,
  } = terminalDerivedState;
  const tradeEntryPrice = Number.parseFloat(f.entryPrice || extractedVals.currentPrice || "");

  const predictedP2TP1 = Number.isFinite(tradeEntryPrice)
    ? tradeEntryPrice +
      (f.direction === "Long" ? 1 : -1) *
        slPts *
        parseRrrMultiple(f.rrr)
    : null;
  const predictedP2SL = Number.isFinite(tradeEntryPrice)
    ? tradeEntryPrice -
      (f.direction === "Long" ? 1 : -1) * slPts
    : null;
  const liveAmdPhase = liveAmdContext.phase || "UNCLEAR";
  const displayedAmdPhase = currentAMD !== "UNCLEAR" ? currentAMD : liveAmdPhase;

  useEffect(() => {
    setP2Jf((previous) => {
      if (previous.amdPhase && previous.amdPhase !== "UNCLEAR" && previous.amdPhase !== currentAMD) {
        return previous;
      }
      if (previous.amdPhase === displayedAmdPhase) {
        return previous;
      }
      return {
        ...previous,
        amdPhase: displayedAmdPhase,
      };
    });
  }, [currentAMD, displayedAmdPhase]);

  // Firm compliance calculations
  const fr = firmRules;
  const maxDL = parseFloat(fr.maxDailyLoss) || 0;
  const maxDD = parseFloat(fr.maxDrawdown) || 0;
  const minTradingDays = parseInt(fr.minimumTradingDays, 10) || 0;
  
  const curBal = parseFloat(accountState.currentBalance) || 0;
  const hwmVal = parseFloat(accountState.highWaterMark) || curBal;
  const startBal = parseFloat(accountState.startingBalance) || curBal;
  
  const liqLevel = fr.drawdownType === 'trailing' ? hwmVal - maxDD : startBal - maxDD;
  const distToLiq = curBal - liqLevel;
  const throttleActive = maxDD > 0 && distToLiq / maxDD < 0.25; 
  const isWeekendRestricted = !fr.weekendTrading && ist.isWeekend;
  const isMinimumDaysRestricted = minTradingDays > 0 && journal.length < minTradingDays;

  const today = getISTDateString();
  const todayPnl = journal.filter(t => t.date === today).reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
  const dailyLossUsed = Math.abs(Math.min(0, todayPnl));
  const dailyRemaining = maxDL > 0 ? maxDL - dailyLossUsed : null;
  
  const slBreachesDailyLimit = maxDL > 0 && dailyRemaining !== null && proposedSLDollars > dailyRemaining;
  const slBreachesDrawdown = maxDD > 0 && curBal > 0 && (curBal - proposedSLDollars) < liqLevel;
  const isDailyBreached = maxDL > 0 && dailyLossUsed >= maxDL;
  const isDDBreached = maxDD > 0 && curBal > 0 && curBal <= liqLevel;
  
  const consPct = parseFloat(fr.consistencyMaxDayPct) || 0;
  const profT = parseFloat(fr.profitTarget) || 0;
  const totalPnlJ = journal.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
  const todayPct = profT > 0 && totalPnlJ > 0 ? (todayPnl / profT) * 100 : null;
  const isConsistencyBreached = consPct > 0 && todayPct !== null && todayPct >= consPct;
  
  const isDailyWarning = maxDL > 0 && dailyLossUsed / maxDL >= 0.8;
  const isDDWarning = maxDD > 0 && curBal > 0 && (curBal - liqLevel) / maxDD < 0.2;
  const complianceBlocked = isDailyBreached || isDDBreached || isConsistencyBreached || isWeekendRestricted || isMinimumDaysRestricted;
  
  const isDeadZone = (extractedVals.adx !== null && extractedVals.adx < 20) || (extractedVals.ci !== null && extractedVals.ci > 61.8);
  const execBlocked = auditScenario === "app"
    ? false
    : !ist.isOpen || isDeadZone || complianceBlocked || slBreachesDailyLimit || slBreachesDrawdown
    || isCircuitBreakerActive;
  
  let execBlockReason = '';
  if (!ist.isOpen) {
    execBlockReason = `Market closed — opens in ${ist.countdown}`;
  } else if (isDailyBreached) {
    execBlockReason = `Daily loss limit of $${maxDL} reached`;
  } else if (isDDBreached) {
    execBlockReason = `Account at liquidation level ($${liqLevel.toFixed(0)})`;
  } else if (isConsistencyBreached) {
    execBlockReason = `Consistency cap reached (${consPct}%)`;
  } else if (isWeekendRestricted) {
    execBlockReason = `Weekend trading disabled by firm rules`;
  } else if (isMinimumDaysRestricted) {
    execBlockReason = `Minimum trading days not yet met (${journal.length}/${minTradingDays})`;
  } else if (slBreachesDailyLimit) {
    execBlockReason = `SL ($${proposedSLDollars.toFixed(0)}) exceeds remaining limit ($${dailyRemaining?.toFixed(0)})`;
  } else if (slBreachesDrawdown) {
    execBlockReason = `SL would breach trailing drawdown`;
  } else if (isDeadZone) {
    execBlockReason = `Dead Zone — ADX < 20 or CI > 61.8`;
  }

  const complianceColor = complianceBlocked ? T.red : (isDailyWarning || isDDWarning) ? T.gold : T.green;
  const hasLevelWarning = p2Out && /SIGNAL:\s*(YELLOW|yellow)|wait.{0,40}level/i.test(p2Out);
  const isBlocked = p2Out && /🚫 TRADE BLOCKED/i.test(p2Out);
  const trafficState = (execBlocked || isBlocked) ? 'red' : (isDailyWarning || isDDWarning || hasLevelWarning || throttleActive) ? 'yellow' : p2Out ? 'green' : 'none';
  const journalFormOpen = activeTab === "journal" || showForm;
  const canUndo = workspaceHistory.length > 0;
  const hasParsedCsv = parseMsg.startsWith("✓");
  const csvStatusText = isCsvParsing
    ? "Parsing CSV..."
    : parseMsg || "Drop NinjaTrader .txt / .csv — or click to browse";
  const csvStatusColor = hasParsedCsv ? T.green : isCsvParsing ? T.blue : CSS_VARS.textSecondary;
  const csvBorderColor = hasParsedCsv ? T.green : isCsvParsing ? T.blue : CSS_VARS.borderSubtle;
  void csvStatusText;
  void csvStatusColor;
  void csvBorderColor;
  const resetScopeByTab = {
    premarket: "premarket",
    trade: "trade",
    journal: "journalForm",
    account: "account",
  };
  const tabResetScope = resetScopeByTab[activeTab] || "all";

  // Paste handler — owned by usePasteListener BFF hook
  const { flashingZoneId, triggerFlash: _triggerFlash } = usePasteListener({
    activeZone,
    handlers: {
      ss: setScreenshots,
      vwap: setVwapChart,
      mp: setMpChart,
      p1news: setP1NewsChart,
      p1prem: setP1PremarketChart,
      p1lvl: setP1KeyLevelsChart,
    },
    showToast,
    screenshotsLength: screenshots.length,
  });

  const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

  const handleScreenshotDrop = useCallback(async (event) => {
    event.preventDefault();

    const rawFiles = Array.from(
      event?.dataTransfer?.files || event?.target?.files || [],
    );

    const oversized = rawFiles.find(
      (f) => Boolean(f?.type?.startsWith("image/")) && f.size > MAX_FILE_BYTES
    );
    if (oversized) {
      showToast?.(`Screenshot too large — max ${MAX_FILE_BYTES / 1024 / 1024}MB`, "error");
    }

    const files = rawFiles.filter(
      (file) => Boolean(file?.type?.startsWith("image/")) && file.size <= MAX_FILE_BYTES,
    );
    if (!files.length) return;

    const nextAssets = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (readerEvent) => {
              const dataUrl = String(readerEvent?.target?.result || "");
              const [, b64 = ""] = dataUrl.split(",", 2);
              resolve({
                name: file?.name || "image",
                type: file?.type || "image/png",
                b64,
              });
            };
            reader.onerror = () =>
              reject(reader.error || new Error("Failed to read dropped file."));
            reader.readAsDataURL(file);
          }),
      ),
    );

    setScreenshots((current) => [...current, ...nextAssets].slice(0, 4));
  }, [showToast]);

  const parseTandC = useCallback(
    async (text, fileName = "") => {
      const sourceText = String(text || "").trim();
      if (!sourceText) {
        setFirmRules((previous) => ({
          ...previous,
          parseStatus: "✗ T&C document is empty.",
        }));
        return;
      }

      setTcParsing(true);
      setFirmRules((previous) => ({
        ...previous,
        parseStatus: `Reading T&C document${fileName ? `: ${fileName}` : ""}...`,
      }));

      try {
        const data = await parseFirmRulesWithAi({
          prompt: TNC_PARSE_PROMPT,
          sourceText,
        });
        const vals = parseJsonChoice(data, {});
        const updated = {
          ...firmRules,
          ...vals,
          parsed: true,
          parseStatus: `✓ Parsed: ${vals.firmName || "Unknown Firm"}`,
        };

        setFirmRules(updated);
        showToast?.(
          `T&C loaded${updated.firmName ? `: ${updated.firmName}` : ""}`,
          "success",
        );
      } catch (error) {
        setFirmRules((previous) => ({
          ...previous,
          parseStatus: `✗ Parse failed — ${error?.message || "Unknown error"}`,
        }));
      } finally {
        setTcParsing(false);
      }
    },
    [firmRules, showToast],
  );

  const handleFirmRulesDrop = useCallback(
    (event) => {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0] || event.target?.files?.[0];
      if (!file) return;

      setTcFileName(file.name || "");
      const reader = new FileReader();
      reader.onload = async (readerEvent) => {
        await parseTandC(String(readerEvent.target?.result || ""), file.name);
      };
      reader.onerror = () => {
        setFirmRules((previous) => ({
          ...previous,
          parseStatus: "✗ Failed to read T&C document.",
        }));
      };
      reader.readAsText(file);
    },
    [parseTandC],
  );

  // AI extraction
  const extractFromScreenshots = async () => {
    if (!screenshots.length) return;
    
    setExtracting(true);
    setExtractStatus("Reading...");
    
    try {
      const data = await extractIndicatorsWithAi({
        prompt: SCREENSHOT_EXTRACT_PROMPT,
        screenshots,
      });
      const vals = parseJsonChoice(data, {});
      
      setExtractedVals(prev => ({ 
        ...prev, 
        ...Object.fromEntries(Object.entries(vals).filter(([, v]) => v !== null && typeof v !== 'object')) 
      }));
      
      if (vals.currentPrice) {
        setF(prev => ({ ...prev, currentPrice: String(vals.currentPrice) }));
      }
      
      setExtractStatus(`✓ ${[vals.adx && `ADX=${vals.adx}`, vals.ci && `CI=${vals.ci}`, vals.atr && `ATR=${vals.atr}`, vals.currentPrice && `Price=${vals.currentPrice}`].filter(Boolean).join(' · ')}`);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('image') || msg.includes('does not support')) {
        setExtractStatus("✗ Model doesn't support images");
      } else {
        setExtractStatus(`✗ ${msg || 'Extract failed'}`);
      }
    } finally {
      setExtracting(false);
    }
  };

  // Run Part 1
  const runPart1 = async () => {
    if (!parsed || parsed.totalDays < 5) { 
      setErr('Upload a valid NinjaTrader CSV file with at least 5 days.'); 
      return; 
    }
    
    setErr(''); 
    setLoading(true); 
    setP1Out('');
    
    try {
      const textMsg = `Run full Premarket Analysis. Today: ${parsed.days[parsed.days.length - 1]?.date} | ${ist.istStr}
Trading Hours ATR(14): ${parsed.tradingHoursAtr14} pts

Screenshots: ${p1NewsChart ? '✓ Calendar' : '✗ No calendar'} | ${p1PremarketChart ? '✓ Premarket chart' : '✗ No chart'} | ${p1KeyLevelsChart ? '✓ Key levels' : '✗ No levels'}
Apply ALL sections including SECTION AMD.`;
      
      const content = [];
      if (p1NewsChart) content.push({ type: 'image', source: { type: 'base64', media_type: p1NewsChart.type, data: p1NewsChart.b64 } });
      if (p1PremarketChart) content.push({ type: 'image', source: { type: 'base64', media_type: p1PremarketChart.type, data: p1PremarketChart.b64 } });
      if (p1KeyLevelsChart) content.push({ type: 'image', source: { type: 'base64', media_type: p1KeyLevelsChart.type, data: p1KeyLevelsChart.b64 } });
      content.push({ type: 'text', text: textMsg });

      const data = await runPremarketAnalysisWithAi({
        maxTokens: 4000,
        messages: [
          { role: 'system', content: PART1_PROMPT },
          { role: 'user', content: JSON.stringify(content) }
        ]
      });
      const response = extractChoiceText(data, 'No response.');
      
      setP1Out(response);
      const amdMatch = response.match(/MACRO AMD PHASE:\s*([A-Z]+)/i);
      if (amdMatch && AMD_PHASES[amdMatch[1]]) {
        setCurrentAMD(amdMatch[1]);
      } else if (liveAmdPhase !== "UNCLEAR") {
        setCurrentAMD(liveAmdPhase);
      }
      
      setTimeout(() => p1Ref.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch(e) { 
      setErr('API error: ' + e.message); 
    }
    finally { 
      setLoading(false); 
    }
  };

  // Run Part 2
  const runPart2 = async () => {
    if (execBlocked) { 
      setErr(`Blocked: ${execBlockReason}`); 
      return; 
    }
    if (!f.entryPrice) { 
      setErr('Entry price required.'); 
      return; 
    }
    
    setErr(''); 
    setLoading(true); 
    setP2Out(''); 
    setShowP2TradeForm(false);
    
    try {
      const textContent = `PRE-ENTRY ANALYSIS + TRADE PLAN
=== PART 1 AMD CONTEXT ===
${p1Out ? p1Out.slice(0, 2500) + (p1Out.length > 2500 ? '\n[truncated]' : '') : 'No morning analysis.'}
Current AMD Phase (Part 1): ${displayedAmdPhase}
Live AMD Phase (Terminal): ${liveAmdPhase}

=== LIVE TRADE ===
Time (IST): ${f.timeIST || '?'} | Instrument: ${f.instrument} ($${ptVal}/pt)
Direction: ${f.direction} | Type: ${f.tradeType} | RRR: ${f.rrr}
Entry: ${f.entryPrice} | ATR: ${atrVal || '?'} | Max Risk: $${maxRiskUSD || 0}
ADX: ${extractedVals.adx || '?'} | CI: ${extractedVals.ci || '?'} | VWAP: ${extractedVals.vwap || '?'}
VWAP SD1: ${sd1Target?.toFixed(2) || '?'} | SD2: ${sd2Target?.toFixed(2) || '?'}
Volatility Regime: ${volatilityRegime}
Notes: ${f.notes || 'none'}

=== FIRM COMPLIANCE ===
Max Daily Loss: $${fr.maxDailyLoss || '?'} | Max Drawdown: $${fr.maxDrawdown || '?'}
Current Balance: $${curBal || '?'} | HWM: $${hwmVal || '?'}`;

      const content = [];
      if (mpChart) content.push({ type: 'image', source: { type: 'base64', media_type: mpChart.type, data: mpChart.b64 } });
      if (vwapChart) content.push({ type: 'image', source: { type: 'base64', media_type: vwapChart.type, data: vwapChart.b64 } });
      
      screenshots.forEach(s => content.push({ type: 'image', source: { type: 'base64', media_type: s.type, data: s.b64 } }));
      content.push({ type: 'text', text: textContent });

      const data = await runTradePlanWithAi({
        maxTokens: 4000,
        messages: [
          { role: 'system', content: PART2_PROMPT },
          { role: 'user', content: JSON.stringify(content) }
        ]
      });
      const response = extractChoiceText(data, 'No response.');
      
      setP2Out(response);
      setP2Jf({ exit: '', result: 'win', pnl: '', balAfter: '', lessons: '', amdPhase: currentAMD });
      
      setTimeout(() => p2Ref.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { 
      setErr('API error.'); 
    } finally { 
      setLoading(false); 
    }
  };

  // Add trade from Part 2
  const addP2Trade = () => {
    if (!p2Jf.exit) {
      setErr('Exit price required.');
      return;
    }

    const pnl = Number(p2Jf.pnl);
    if (p2Jf.result === "win" && (!Number.isFinite(pnl) || pnl <= 0)) {
      setErr("A win must have a positive P&L.");
      return;
    }
    if (p2Jf.result === "loss" && (Number.isFinite(pnl) && pnl >= 0)) {
      setErr("A loss must have a negative P&L.");
      return;
    }
    
    const entry = { 
      date: today, 
      instrument: f.instrument, 
      direction: f.direction, 
      tradeType: f.tradeType, 
      amdPhase: p2Jf.amdPhase || currentAMD, 
      rrr: f.rrr, 
      result: p2Jf.result, 
      entry: f.entryPrice, 
      exit: p2Jf.exit, 
      actualExit: p2Jf.exit,
      predictedTP1: Number.isFinite(predictedP2TP1) ? predictedP2TP1.toFixed(2) : "",
      predictedSL: Number.isFinite(predictedP2SL) ? predictedP2SL.toFixed(2) : "",
      contracts: String(contracts), 
      pnl: p2Jf.pnl, 
      session: 'Trading Hours', 
      balAfter: p2Jf.balAfter, 
      setup: `${f.timeIST || '?'} IST | ${f.direction} @ ${f.entryPrice} | ${f.rrr}`, 
      lessons: p2Jf.lessons,
      id: `trade-${Date.now()}`
    };
    
    setJournal((prev) => {
      const updated = [...prev, entry];
      // Count consecutive losses from the end of the journal
      let streak = 0;
      const journalWithNew = [...prev, entry];
      for (let i = journalWithNew.length - 1; i >= 0; i--) {
        if (journalWithNew[i].result === "loss") streak++;
        else break;
      }
      if (streak >= MAX_CONSECUTIVE_LOSSES) {
        const until = Date.now() + CIRCUIT_COOLDOWN_MS;
        setCircuitUntil(until);
        window.dispatchEvent(new Event("tilt-lock"));
        showToast?.("Circuit breaker: 3+ consecutive losses. Execution locked for 15 minutes.", "circuit");
      }
      return updated;
    });

    if (p2Jf.balAfter) { 
      const upd = { ...accountState, currentBalance: p2Jf.balAfter }; 
      setAccountState(upd); 
      if (onSaveAccount) onSaveAccount(upd); 
    }
    
    setShowP2TradeForm(false); 
    setErr(''); 
    showToast?.('Trade vector recorded. Journal synchronized.', 'success');
  };

  // Add manual journal entry
  const addJournalEntry = () => {
    if (!jf.entry || !jf.exit) return;
    const pnl = Number(jf.pnl);
    if (jf.result === "win" && (!Number.isFinite(pnl) || pnl <= 0)) {
      setJf(p => ({ ...p, _err: "A win must have a positive P&L." }));
      return;
    }
    if (jf.result === "loss" && (Number.isFinite(pnl) && pnl >= 0)) {
      setJf(p => ({ ...p, _err: "A loss must have a negative P&L." }));
      return;
    }
    const entryPrice = Number.parseFloat(jf.entry);
    const fallbackPredictedTP1 = Number.isFinite(entryPrice)
      ? entryPrice +
        (jf.direction === "Long" ? 1 : -1) *
          slPts *
          parseRrrMultiple(jf.rrr)
      : null;
    setJournal(prev => [...prev, { ...jf, actualExit: jf.exit, predictedTP1: jf.predictedTP1 || (Number.isFinite(fallbackPredictedTP1) ? fallbackPredictedTP1.toFixed(2) : ""), id: `trade-${Date.now()}` }]);
    setJf(p => ({ ...p, entry: '', exit: '', predictedTP1: '', actualExit: '', pnl: '', setup: '', lessons: '', balAfter: '' }));
  };

  // Get name for greeting
  const _getGreetingName = () => {
    return profile?.fullName || profile?.email || "Officer";
  };

  return (
    <div
      data-testid="terminal-screenshot-dropzone"
      onDrop={handleScreenshotDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{ 
      minHeight: '100vh', 
      background: CSS_VARS.bg, 
      color: CSS_VARS.text, 
      fontFamily: T.font,
      display: "flex",
      flexDirection: "column",
      width: "100%"
      }}>
      
      <TerminalHeader
        profile={profile}
        fr={fr}
        displayedAmdPhase={displayedAmdPhase}
        throttleActive={throttleActive}
        onLogout={onLogout}
      />

      <MainTerminalTicker
        setMarketRefresh={setMarketRefresh}
        setQuoteIndex={setQuoteIndex}
      />

      <CountdownBanner ist={ist} />

      <QuoteBanner activeQuote={activeQuote} />

      <NavigationTabs activeTab={activeTab} onTabChange={(id) => { setActiveTab(id); setErr(''); if (id === 'journal') setShowForm(true); }} />

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 32px", width: "100%", boxSizing: "border-box" }}>
        
        <DrawdownThrottleBanner throttleActive={throttleActive} activeRiskPct={activeRiskPct} />

        <AutosaveBar
          draftStatus={draftStatus}
          onNavigateToConsciousness={onNavigateToConsciousness}
          onUndoLastChange={handleUndoLastChange}
          onResetPage={(scope) => openResetDialog(scope)}
          onResetAll={() => openResetDialog("all")}
          canUndo={canUndo}
          activeTab={activeTab}
          onDeleteJournalHistory={() => openResetDialog("journalHistory")}
          tabResetScope={tabResetScope}
        />

        {/* TAB 1: PREMARKET */}
        {activeTab === "premarket" && (
          <PremarketTab
            ref={csvZoneRef}
            parsed={parsed}
            isCsvParsing={isCsvParsing}
            p1NewsChart={p1NewsChart}
            p1PremarketChart={p1PremarketChart}
            p1KeyLevelsChart={p1KeyLevelsChart}
            activeZone={activeZone}
            setActiveZone={setActiveZone}
            setCsvParsed={handleCsvParsedChange}
            setCsvParsing={handleCsvParsingChange}
            setCsvStatus={handleCsvStatusChange}
            loading={loading}
            p1Out={p1Out}
            displayedAmdPhase={displayedAmdPhase}
            runPart1={runPart1}
            setActiveTab={setActiveTab}
            setErr={handleCsvErrorChange}
            err={err}
            flashingZoneId={flashingZoneId}
          />
        )}

        {/* TAB 2: TRADE ENTRY */}
        {activeTab === "trade" && (
          <TradeTab
            complianceColor={complianceColor}
            curBal={curBal}
            dailyLossUsed={dailyLossUsed}
            displayedAmdPhase={displayedAmdPhase}
            extractedVals={extractedVals}
            hasFirmRules={Boolean(fr.parsed)}
            isDDBreached={isDDBreached}
            isDDWarning={isDDWarning}
            isDailyBreached={isDailyBreached}
            isDailyWarning={isDailyWarning}
            liqLevel={liqLevel}
            liveAmdContext={liveAmdContext}
            liveAmdPhase={liveAmdPhase}
            marketOpen={ist.isOpen}
            maxDD={maxDD}
            maxDL={maxDL}
            sd1Target={sd1Target}
            sd2Target={sd2Target}
            sweepEstimate={sweepEstimate}
            throttleActive={throttleActive}
            trafficState={trafficState}
            volatilityRegime={volatilityRegime}
            vr={VR}
            f={f}
            sf={sf}
            screenshots={screenshots}
            setScreenshots={setScreenshots}
            mpChart={mpChart}
            setMpChart={setMpChart}
            vwapChart={vwapChart}
            setVwapChart={setVwapChart}
            activeZone={activeZone}
            setActiveZone={setActiveZone}
            extracting={extracting}
            extractStatus={extractStatus}
            p2Jf={p2Jf}
            sp2={sp2}
            showP2TradeForm={showP2TradeForm}
            setShowP2TradeForm={setShowP2TradeForm}
            p2Out={p2Out}
            p2Ref={p2Ref}
            predictedP2TP1={predictedP2TP1}
            predictedP2SL={predictedP2SL}
            slPts={terminalDerivedState.slPts}
            ptVal={terminalDerivedState.ptVal}
            accountState={accountState}
            maxDrawdown={firmRules.maxDrawdown}
            drawdownType={firmRules.drawdownType}
            err={err}
            setErr={setErr}
            loading={loading}
            isTerminalDerivedPending={isTerminalDerivedPending}
            execBlocked={execBlocked}
            runPart2={runPart2}
            addP2Trade={addP2Trade}
            makeImgHandler={makeImgHandler}
            handleScreenshotDrop={handleScreenshotDrop}
            extractFromScreenshots={extractFromScreenshots}
            flashingZoneId={flashingZoneId}
            setExtractedVals={setExtractedVals}
            showToast={showToast}
          />
        )}

        {/* TAB 3: JOURNAL */}
        {activeTab === 'journal' && (
          <JournalTab
            journal={journal}
            setJournal={setJournal}
            jf={jf}
            sjf={sjf}
            showForm={journalFormOpen}
            setShowForm={setShowForm}
            metrics={metrics}
            isJournalMetricsPending={isJournalMetricsPending}
            equityCurveView={equityCurveView}
            addJournalEntry={addJournalEntry}
            firmRules={firmRules}
            accountState={accountState}
          />
        )}

        {/* TAB 4: ACCOUNT */}
        {activeTab === 'account' && (
          <AccountTab
            accountState={accountState}
            setAccountState={setAccountState}
            firmRules={firmRules}
            tcFileName={tcFileName}
            tcParsing={tcParsing}
            handleFirmRulesDrop={handleFirmRulesDrop}
            onSaveAccount={onSaveAccount}
            showToast={showToast}
          />
        )}
      </div>

      {resetDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: overlayTint,
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1200,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              background: CSS_VARS.card,
              border: `1px solid ${CSS_VARS.borderSubtle}`,
              borderRadius: 20,
              padding: "24px 22px",
              boxShadow: modalShadow,
            }}
            className="glass-panel"
          >
            <div
              style={{
                color: T.red,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Confirm Reset
            </div>
            <div
              style={{
                color: T.text,
                fontSize: 22,
                fontWeight: 800,
                lineHeight: 1.2,
                marginBottom: 12,
              }}
            >
              {resetDialog.title}
            </div>
            <div
              style={{
                color: T.muted,
                fontSize: 13,
                lineHeight: 1.7,
                marginBottom: 20,
              }}
            >
              {resetDialog.description}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  const scope = resetDialog.scope;
                  setResetDialog(null);
                  void runResetAction(scope);
                }}
                style={glowBtn(T.red, false)}
                className="btn-glass"
              >
                {resetDialog.confirmLabel}
              </button>
              <button
                type="button"
                onClick={() => setResetDialog(null)}
                style={glowBtn(T.muted, false)}
                className="btn-glass"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
