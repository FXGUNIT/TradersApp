import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeJournalMetrics,
  EMPTY_JOURNAL_METRICS,
} from "./journalMetrics";
import {
  makeImgHandler,
} from "./terminalUploadUtils";
import { parseTerminalCsvText } from "./terminalCsvParser.js";
import {
  calculateManipulationWickValidation,
  detectAmdPhase,
} from "../../utils/math-engine.js";
import {
  computeTerminalDerivedState,
  EMPTY_TERMINAL_DERIVED_STATE,
} from "./terminalDerivedState.js";
import {
  T,
  AMD_PHASES,
  TIME_OPTIONS,
  SCREENSHOT_EXTRACT_PROMPT,
  TNC_PARSE_PROMPT,
  PART1_PROMPT,
  PART2_PROMPT,
  LED,
  Tag,
  SHead,
  Field,
  Loader,
  RenderOut,
  AMDPhaseTag,
  TrafficLight,
  CountdownBanner,
  PasteZone,
  HourlyHeatmap,
  cardS,
  glowBtn,
  inp,
  lbl,
} from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";
import {
  clearDraft,
  formatDraftSavedAt,
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

// Default states
const defaultAccountState = {
  startingBalance: "",
  currentBalance: "",
  highWaterMark: "",
  dailyStartBalance: "",
};

const defaultExtractedVals = {
  adx: null,
  ci: null,
  vwap: null,
  vwapSlope: null,
  atr: null,
  currentPrice: null,
  fiveDayATR: null,
  twentyDayATR: null,
};

const buildTradePlannerState = () => ({
  timeIST: "",
  instrument: "MNQ",
  direction: "Long",
  tradeType: "Trend",
  accountBalance: "",
  riskPct: "0.3",
  entryPrice: "",
  currentPrice: "",
  rrr: "1:2",
  lastTradeResult: "",
  notes: "",
});

const buildP2JournalState = () => ({
  exit: "",
  result: "win",
  pnl: "",
  balAfter: "",
  lessons: "",
  amdPhase: "UNCLEAR",
});

const buildJournalFormState = () => ({
  date: getISTDateString(),
  instrument: "MNQ",
  direction: "Long",
  tradeType: "Trend",
  amdPhase: "UNCLEAR",
  rrr: "1:2",
  result: "win",
  entry: "",
  exit: "",
  predictedTP1: "",
  actualExit: "",
  contracts: "1",
  pnl: "",
  session: "Trading Hours",
  balAfter: "",
  setup: "",
  lessons: "",
});

const defaultFirmRules = {
  parsed: false,
  firmName: "",
  maxDailyLoss: "",
  maxDailyLossType: "dollar",
  maxDrawdown: "",
  drawdownType: "trailing",
  profitTarget: "",
  consistencyMaxDayPct: "",
  restrictedNewsWindowMins: "15",
  newsTrading: true,
  scalpingAllowed: true,
  overnightHoldingAllowed: true,
  weekendTrading: true,
  copyTradingAllowed: false,
  maxContracts: "",
  minimumTradingDays: "",
  keyRules: [],
  notes: "",
  parseStatus: "",
};

const MAX_HISTORY_ENTRIES = 10;
const ROTATING_QUOTES = [
  "The trend is your friend until the end when it bends. - Ed Seykota",
  "Markets can remain irrational longer than you can remain solvent. - John Maynard Keynes",
  "Risk comes from not knowing what you're doing. - Warren Buffett",
  "The goal is to make money, not to be right. - Mark Douglas",
];
const LINKEDIN_URL = "https://www.linkedin.com/in/singhgunit/";

function parseRrrMultiple(rrr) {
  const parts = String(rrr || "").split(":");
  const parsed = Number.parseFloat(parts[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseWorkspaceSnapshot(snapshot) {
  try {
    return snapshot ? JSON.parse(snapshot) : null;
  } catch {
    return null;
  }
}

function buildEquityCurvePath(series, width = 360, height = 100, padding = 14) {
  const points = Array.isArray(series) ? series : [];
  if (!points.length) return { path: "", dots: [], min: 0, max: 0 };

  const values = points.map((point) => Number(point?.cumulativePnl) || 0);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const coords = points.map((point, index) => {
    const x = padding + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
    const yValue = Number(point?.cumulativePnl) || 0;
    const y = padding + (1 - (yValue - min) / span) * innerHeight;
    return { x, y, ...point };
  });

  const path = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  return { path, dots: coords, min, max };
}

function getISTDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function _deriveLiveAmdContext(parsed, extractedVals) {
  const days = Array.isArray(parsed?.days) ? parsed.days : [];
  const latestDay = days.length ? days[days.length - 1] : null;
  const latestSession = latestDay?.trading || latestDay?.full || null;
  const atr = Number.parseFloat(
    extractedVals?.atr || latestDay?.tradingHoursAtr14 || latestDay?.atr14 || parsed?.tradingHoursAtr14 || 0,
  );
  const open = Number.parseFloat(latestSession?.o ?? latestDay?.full?.o ?? 0);
  const high = Number.parseFloat(latestSession?.h ?? latestDay?.full?.h ?? 0);
  const low = Number.parseFloat(latestSession?.l ?? latestDay?.full?.l ?? 0);
  const close = Number.parseFloat(latestSession?.c ?? latestDay?.full?.c ?? 0);
  const range = Math.max(0, high - low);
  const upperWick = Math.max(0, high - Math.max(open, close));
  const lowerWick = Math.max(0, Math.min(open, close) - low);
  const relevantWick = Math.max(upperWick, lowerWick);
  const wickValidation = calculateManipulationWickValidation({
    relevantWick,
    totalRange: range,
    atr,
  });
  const recentSessions = days
    .slice(-3)
    .map((day) => day?.trading || day?.full || null)
    .filter(Boolean);
  const recentHighs = recentSessions.map((session) => Number.parseFloat(session.h || 0));
  const recentLows = recentSessions.map((session) => Number.parseFloat(session.l || 0));
  const higherHighs =
    recentHighs.length === 3 &&
    recentHighs[0] < recentHighs[1] &&
    recentHighs[1] < recentHighs[2];
  const lowerLows =
    recentLows.length === 3 &&
    recentLows[0] > recentLows[1] &&
    recentLows[1] > recentLows[2];
  const volumeNearLows =
    range > 0 ? (close - low) / range <= 0.3 : false;
  const conflictingSignals =
    Boolean(wickValidation.manipulated) && !(higherHighs || lowerLows);
  const adxDeclining =
    extractedVals?.adx !== null && extractedVals?.adx !== undefined
      ? Number.parseFloat(extractedVals.adx) < 20
      : false;

  return {
    phase: detectAmdPhase({
      range,
      twentyDayAdr: parsed?.tradingHoursAtr14 || latestDay?.atr14 || 0,
      volumeNearLows,
      wickRatio: wickValidation.wickRatio,
      wickToAtr: atr > 0 ? relevantWick / atr : 0,
      higherHighs,
      lowerLows,
      conflictingSignals,
      adxDeclining,
    }).phase,
    range,
    atr,
    open,
    high,
    low,
    close,
    relevantWick,
    wickValidation,
    volumeNearLows,
    higherHighs,
    lowerLows,
    conflictingSignals,
    adxDeclining,
  };
}

function normalizeJournal(journal) {
  if (Array.isArray(journal)) return journal;
  if (journal && typeof journal === "object") return Object.values(journal);
  return [];
}

function buildAccountState(accountState) {
  return {
    ...defaultAccountState,
    ...(accountState || {}),
  };
}

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
    const interval = setInterval(() => setMarketRefresh(r => r + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((current) => (current + 1) % ROTATING_QUOTES.length);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

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
  const csvParserWorkerRef = useRef(null);
  const csvParseRequestIdRef = useRef(0);
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

  const applyCsvParseResult = useCallback((requestId, result) => {
    if (requestId !== csvParseRequestIdRef.current) {
      return;
    }

    setIsCsvParsing(false);
    setParsed(result?.parsed || null);
    setParseMsg(result?.parseMsg || "⚠ CSV parse failed");
  }, []);

  useEffect(() => {
    if (typeof Worker === "undefined") {
      return undefined;
    }

    const worker = new Worker(new URL("./terminalCsv.worker.js", import.meta.url), {
      type: "module",
    });

    const handleMessage = (event) => {
      const { requestId, ...result } = event.data || {};
      applyCsvParseResult(requestId, result);
    };

    const handleError = () => {
      const requestId = csvParseRequestIdRef.current;
      if (!requestId) {
        return;
      }
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
  }, [applyCsvParseResult]);

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
      let nextState = currentState;

      if (scope === "all") {
        nextState = baseline;
      } else if (scope === "premarket") {
        nextState = {
          ...currentState,
          activeTab: "premarket",
          parsed: null,
          parseMsg: "",
          p1Out: "",
          p1NewsChart: null,
          p1PremarketChart: null,
          p1KeyLevelsChart: null,
          currentAMD: baseline.currentAMD,
        };
      } else if (scope === "trade") {
        nextState = {
          ...currentState,
          activeTab: "trade",
          screenshots: [],
          extractStatus: "",
          extractedVals: defaultExtractedVals,
          activeZone: null,
          mpChart: null,
          vwapChart: null,
          p2Out: "",
          f: buildTradePlannerState(),
          showP2TradeForm: false,
          p2Jf: buildP2JournalState(),
        };
      } else if (scope === "journalForm") {
        nextState = {
          ...currentState,
          activeTab: "journal",
          jf: buildJournalFormState(),
          showForm: true,
        };
      } else if (scope === "journalHistory") {
        nextState = {
          ...currentState,
          activeTab: "journal",
          journal: [],
          jf: buildJournalFormState(),
          showForm: true,
        };
      } else if (scope === "account") {
        nextState = {
          ...currentState,
          activeTab: "account",
          accountState: buildAccountState(baseline.accountState),
          firmRules: {
            ...defaultFirmRules,
            ...(baseline.firmRules || {}),
          },
          tcFileName: "",
        };
      }

      restoreWorkspaceState(nextState, scope === "all");

      if (terminalDraftKey && scope === "all") {
        await clearDraft(terminalDraftKey);
      }

      const resetMessages = {
        all: "Entire workspace cleared.",
        premarket: "Premarket workspace cleared.",
        trade: "Trade workspace cleared.",
        journalForm: "Journal form reset.",
        journalHistory: "Journal history deleted.",
        account: "Account page reset.",
      };

      showToast?.(resetMessages[scope] || "Workspace reset complete.", "success");
    },
    [
      buildBaseWorkspaceState,
      buildCurrentWorkspaceState,
      restoreWorkspaceState,
      showToast,
      terminalDraftKey,
    ],
  );

  const openResetDialog = useCallback(
    (scope) => {
      const copy = {
        premarket: {
          title: "Reset premarket workspace?",
          description:
            "This clears CSV parsing, premarket charts, and the saved Part 1 analysis for this account.",
          confirmLabel: "Reset premarket",
        },
        trade: {
          title: "Reset trade workspace?",
          description:
            "This clears screenshots, extracted values, trade planner fields, and the saved Part 2 output.",
          confirmLabel: "Reset trade page",
        },
        journalForm: {
          title: "Reset journal form?",
          description:
            "This clears the draft journal form only. Existing journal history stays untouched.",
          confirmLabel: "Reset journal form",
        },
        journalHistory: {
          title: "Delete all journal history?",
          description:
            "This permanently clears every saved journal entry for this account after the next sync.",
          confirmLabel: "Delete journal history",
        },
        account: {
          title: "Reset account page?",
          description:
            "This resets account balances and firm-rule inputs back to the last server baseline for this user.",
          confirmLabel: "Reset account page",
        },
        all: {
          title: "Clear the full workspace?",
          description:
            "This wipes all tabs back to their default state and removes the saved local draft for this account.",
          confirmLabel: "Clear everything",
        },
      };

      setResetDialog({
        scope,
        ...(copy[scope] || copy.all),
      });
    },
    [],
  );

  // Trading calculations
  const {
    maxRiskUSD,
    activeRiskPct,
    isThrottled,
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
    : !ist.isOpen || isDeadZone || complianceBlocked || slBreachesDailyLimit || slBreachesDrawdown;
  
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
  const csvStatusColor = hasParsedCsv ? T.green : isCsvParsing ? T.blue : "#6B7280";
  const csvBorderColor = hasParsedCsv ? T.green : isCsvParsing ? T.blue : "#E5E7EB";
  const resetScopeByTab = {
    premarket: "premarket",
    trade: "trade",
    journal: "journalForm",
    account: "account",
  };
  const tabResetScope = resetScopeByTab[activeTab] || "all";

  // Paste handler
  useEffect(() => {
    const handler = (e) => {
      if (!activeZone) return;
      
      const items = Array.from(e.clipboardData?.items || []);
      const img = items.find(i => i.type.startsWith('image/'));
      
      if (!img) return; 
      e.preventDefault();
      
      const file = img.getAsFile(); 
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = ev => {
        const b64 = ev.target.result.split(',')[1];
        const imgObj = { name: 'pasted.png', b64, type: 'image/png' };
        
        switch (activeZone) {
          case 'ss': 
            setScreenshots(prev => prev.length >= 4 ? prev : [...prev, imgObj]); 
            break;
          case 'vwap': 
            setVwapChart(imgObj); 
            break;
          case 'mp': 
            setMpChart(imgObj); 
            break;
          case 'p1news': 
            setP1NewsChart(imgObj); 
            break;
          case 'p1prem': 
            setP1PremarketChart(imgObj); 
            break;
          case 'p1lvl': 
            setP1KeyLevelsChart(imgObj); 
            break;
        }
      };
      reader.readAsDataURL(file);
    };
    
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [activeZone]);

  // CSV handler
  const handleCsvDrop = useCallback(async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (!file) return;

    const requestId = csvParseRequestIdRef.current + 1;
    csvParseRequestIdRef.current = requestId;
    setErr("");
    setParsed(null);
    setParseMsg("");
    setIsCsvParsing(true);
    let handledAsync = false;

    try {
      const text = await file.text();
      const worker = csvParserWorkerRef.current;

      if (worker) {
        worker.postMessage({ requestId, text });
        handledAsync = true;
      }
      if (!worker) {
        const result = parseTerminalCsvText(text);
        applyCsvParseResult(requestId, result);
        handledAsync = true;
      }
    } catch (error) {
      applyCsvParseResult(requestId, {
        ok: false,
        parsed: null,
        parseMsg: `⚠ ${error?.message || "Unable to read CSV export"}`,
      });
      handledAsync = true;
    } finally {
      if (!csvParserWorkerRef.current) {
        setIsCsvParsing(false);
      }
    }

    if (handledAsync) return;
    
    const r = new FileReader();
    r.onload = ev => {
      const text = ev.target.result;
      const lines = text.trim().split('\n');
      const days = [];
      let totalBars = 0;
      
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 6) continue;
        
        const date = cols[0]?.trim();
        const time = cols[1]?.trim();
        const open = parseFloat(cols[2]);
        const high = parseFloat(cols[3]);
        const low = parseFloat(cols[4]);
        const close = parseFloat(cols[5]);
        
        if (isNaN(open) || isNaN(close)) continue;
        
        const isPreMarket = time && time.length >= 4 && parseInt(time.slice(0, 2)) < 9;
        const isPostMarket = time && time.length >= 4 && parseInt(time.slice(0, 2)) >= 16;
        
        const tr = isNaN(high - low) ? 0 : high - low;
        
        if (!days.length || days[days.length - 1].date !== date) {
          days.push({
            date,
            bars: 1,
            preMarket: isPreMarket ? 1 : 0,
            tradingHours: !isPreMarket && !isPostMarket ? 1 : 0,
            postMarket: isPostMarket ? 1 : 0,
            atr14: tr,
            tradingHoursAtr14: !isPreMarket && !isPostMarket ? tr : 0,
            dayHigh: high,
            dayLow: low,
          });
        } else {
          const d = days[days.length - 1];
          d.bars++;
          if (isPreMarket) d.preMarket++;
          else if (!isPostMarket) d.tradingHours++;
          else d.postMarket++;
          d.atr14 = Math.max(d.atr14, tr);
          if (!isPreMarket && !isPostMarket) d.tradingHoursAtr14 = Math.max(d.tradingHoursAtr14, tr);
          d.dayHigh = Number.isFinite(d.dayHigh) ? Math.max(d.dayHigh, high) : high;
          d.dayLow = Number.isFinite(d.dayLow) ? Math.min(d.dayLow, low) : low;
        }
        totalBars++;
      }
      
      if (days.length >= 5) {
        days.sort((a, b) => new Date(a.date) - new Date(b.date));
        for (let i = 0; i < days.length; i++) {
          const fiveDaySlice = days.slice(Math.max(0, i - 4), i + 1);
          const fiveDaySum = fiveDaySlice.reduce((s, d) => s + (d.atr14 || 0), 0);
          days[i].fiveDayATR = fiveDaySum / fiveDaySlice.length;

          const twentyDaySlice = days.slice(Math.max(0, i - 19), i + 1);
          const twentyDaySum = twentyDaySlice.reduce((s, d) => s + (d.atr14 || 0), 0);
          days[i].twentyDayATR = twentyDaySum / twentyDaySlice.length;
        }
      }
      
      const tradingHoursAtr = days.reduce((s, d) => s + (d.tradingHoursAtr14 || 0), 0) / (days.length || 1);
      const priorDays = days.slice(0, -1);
      const priorWeek = priorDays.slice(-5);
      const prevDay = priorDays[priorDays.length - 1] || null;
      const priorWeekHighs = priorWeek.map((d) => d.dayHigh).filter(Number.isFinite);
      const priorWeekLows = priorWeek.map((d) => d.dayLow).filter(Number.isFinite);
      const keyLevels = {
        pdh: prevDay?.dayHigh ?? null,
        pdl: prevDay?.dayLow ?? null,
        pwh: priorWeekHighs.length ? Math.max(...priorWeekHighs) : null,
        pwl: priorWeekLows.length ? Math.min(...priorWeekLows) : null,
      };
      
      if (days.length < 5) {
        setParseMsg(`⚠ Only ${days.length} days — need 5+`);
        setParsed(null);
        return;
      }
      
      setParsed({ days, totalBars, totalDays: days.length, tradingHoursAtr14: tradingHoursAtr, keyLevels });
      setParseMsg(`✓ ${totalBars.toLocaleString()} bars → ${days.length} days`);
    };
    r.readAsText(file);
  }, [applyCsvParseResult]);

  const handleScreenshotDrop = useCallback(async (event) => {
    event.preventDefault();

    const files = Array.from(
      event?.dataTransfer?.files || event?.target?.files || [],
    ).filter((file) => Boolean(file?.type?.startsWith("image/")));

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
  }, []);

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
    
    setJournal(prev => [...prev, entry]);
    
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
  const getGreetingName = () => {
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
      
      {/* Header */}
      <div style={{ 
        background: CSS_VARS.card, 
        borderBottom: `1px solid #E5E7EB`, 
        padding: "16px 32px", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between", 
        flexWrap: "wrap", 
        gap: 16,
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
            {[10, 16, 12, 22, 14, 20, 11].map((h, i) => (
              <div key={i} style={{ width: 4, height: h, background: `hsl(${150 + i * 15},80%,60%)`, borderRadius: 2 }} />
            ))}
          </div>
          <div>
            <div style={{ color: T.text, fontSize: 16, letterSpacing: 4, fontWeight: 800 }}>
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {getGreetingName()}
            </div>
            <div style={{ color: T.blue, fontSize: 11, letterSpacing: 3, marginTop: 4, fontWeight: 700 }}>
              Execution Workspace
            </div>
            <div style={{ color: T.muted, fontSize: 10, letterSpacing: 2, marginTop: 4, fontWeight: 600 }}>
              INSTITUTIONAL TERMINAL · v9
            </div>
          </div>
          
          {fr.parsed && <Tag label={fr.firmName} color={T.purple} />}
          <AMDPhaseTag phase={displayedAmdPhase} />
          {throttleActive && <Tag label="⚠ DRAWDOWN THROTTLE" color={T.gold} />}
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <span style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>
            {profile?.fullName || profile?.email}
          </span>
          
          <button onClick={onLogout} style={{ 
            background: "transparent", 
            border: "none", 
            padding: "4px 8px", 
            cursor: "pointer", 
            color: T.muted, 
            fontSize: 11, 
            fontFamily: T.font, 
            letterSpacing: 1, 
            fontWeight: 600 
          }}>
            LOGOUT
          </button>
        </div>
      </div>

      <CountdownBanner ist={ist} />

      <div
        style={{
          padding: "14px 32px",
          background: "linear-gradient(90deg, rgba(37,99,235,0.08), rgba(15,23,42,0.02))",
          borderBottom: "1px solid rgba(148,163,184,0.18)",
        }}
      >
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            color: T.blue,
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.7,
            letterSpacing: 0.2,
          }}
        >
          {activeQuote}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ 
        background: CSS_VARS.card, 
        borderBottom: `1px solid #E5E7EB`, 
        padding: "0 32px", 
        display: "flex", 
        gap: 0,
        overflowX: "auto",
        boxShadow: "none"
      }}>
        {[
          { id: 'premarket', label: 'PREMARKET', sub: 'AMD · Macro · Fuel', color: T.blue }, 
          { id: 'trade', label: 'TRADE ENTRY', sub: 'AMD-Exec · Compliance', color: T.orange }, 
          { id: 'journal', label: 'JOURNAL', sub: 'AMD Stats · P&L', color: T.purple }, 
          { id: 'account', label: 'ACCOUNT', sub: 'T&C · Drawdown · Rules', color: T.green }
        ].map(p => (
          <button 
            key={p.id} 
            type="button"
            onClick={() => {
              setActiveTab(p.id);
              setErr('');
              if (p.id === 'journal') setShowForm(true);
            }} 
            aria-label={p.label}
            aria-labelledby={`tab-${p.id}-label`}
            style={{ 
              background: "transparent", 
              border: "none", 
              fontFamily: T.font, 
              borderBottom: activeTab === p.id ? `3px solid ${p.color}` : "3px solid transparent", 
              padding: "16px 24px", 
              cursor: "pointer", 
              marginBottom: -1, 
              textAlign: "left", 
              whiteSpace: "nowrap" 
            }} 
            className="btn-glass"
            >
            <div
              id={`tab-${p.id}-label`}
              style={{ color: activeTab === p.id ? p.color : CSS_VARS.textSecondary, fontSize: 12, letterSpacing: 1.5, fontWeight: 800 }}
            >
              {p.label}
            </div>
            <div aria-hidden="true" style={{ color: activeTab === p.id ? p.color : CSS_VARS.textSecondary, fontSize: 10, marginTop: 4, fontWeight: 500 }}>
              {p.sub}
            </div>
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 32px", width: "100%", boxSizing: "border-box" }}>
        
        {/* Drawdown Throttle Banner */}
        {throttleActive && (
          <div style={{
            padding: "14px 20px",
            background: "rgba(255,214,10,0.12)",
            border: `2px solid ${T.gold}`,
            borderRadius: 8,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>⚠</span>
            <div>
              <div style={{ color: T.gold, fontSize: 13, fontWeight: 800, letterSpacing: 1 }}>DRAWDOWN THROTTLE ACTIVE: RISK HALVED TO PROTECT CAPITAL</div>
              <div style={{ color: "#A0781A", fontSize: 11, marginTop: 3 }}>Distance to liquidation within 25% of max drawdown. Size reduced to {activeRiskPct}%.</div>
            </div>
          </div>
        )}

        <div
          style={{
            marginBottom: 16,
            padding: "14px 18px",
            borderRadius: 12,
            background: CSS_VARS.card,
            border: "1px solid rgba(148,163,184,0.16)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
          className="glass-panel"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                color: T.blue,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              Autosave Vault
            </span>
            <span style={{ color: T.muted, fontSize: 12, lineHeight: 1.5 }}>
              {draftStatus.error
                ? `Autosave issue: ${draftStatus.error}`
                : `Saved at ${formatDraftSavedAt(draftStatus.lastSavedAt)}. Refresh-safe draft sync is active for this account.`}
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {typeof onNavigateToConsciousness === "function" && (
              <button
                type="button"
                onClick={onNavigateToConsciousness}
                style={glowBtn(T.purple, false)}
                className="btn-glass"
              >
                OPEN COLLECTIVE CONSCIOUSNESS
              </button>
            )}
            <button
              type="button"
              onClick={handleUndoLastChange}
              disabled={!canUndo}
              style={glowBtn(T.blue, !canUndo)}
              className="btn-glass"
            >
              ↺ UNDO LAST CHANGE
            </button>
            <button
              type="button"
              onClick={() => openResetDialog(tabResetScope)}
              style={glowBtn(T.red, false)}
              className="btn-glass"
            >
              RESET THIS PAGE
            </button>
            {activeTab === "journal" && (
              <button
                type="button"
                onClick={() => openResetDialog("journalHistory")}
                style={glowBtn(T.red, false)}
                className="btn-glass"
              >
                DELETE JOURNAL HISTORY
              </button>
            )}
            <button
              type="button"
              onClick={() => openResetDialog("all")}
              style={glowBtn(T.gold, false)}
              className="btn-glass"
            >
              CLEAR FULL WORKSPACE
            </button>
          </div>
        </div>

        {/* TAB 1: PREMARKET */}
        {activeTab === 'premarket' && (
          <div>
            {/* CSV Upload */}
            <div style={cardS()}>
              <SHead icon="⊞" title="LOAD NINJATRADER 1-MIN DATA" color={T.blue}/>
              <div 
                onDrop={handleCsvDrop} 
                onDragOver={e=>e.preventDefault()} 
                onClick={()=>!isCsvParsing && document.getElementById('csvIn').click()} 
                style={{
                  border:`2px dashed ${csvBorderColor}`,
                  borderRadius:8,
                  padding:"24px",
                  textAlign:"center",
                  cursor:isCsvParsing?"progress":"pointer",
                  opacity:isCsvParsing?0.82:1,
                  background:"#F9FAFB"
                }}
              >
                <input id="csvIn" type="file" accept=".txt,.csv" style={{display:"none"}} onChange={handleCsvDrop} disabled={isCsvParsing}/>
                <div style={{fontSize:24,marginBottom:6,opacity:0.25}}>⊞</div>
                <div style={{color:csvStatusColor,fontSize:12,fontWeight:600}}>{csvStatusText}</div>
                {parsed && <div style={{color:"#9CA3AF",fontSize:11,marginTop:4}}>Latest: {parsed.days[parsed.days.length - 1]?.date} · ATR(14) = <span style={{color:T.green,fontWeight:700}}>{parsed.tradingHoursAtr14} pts</span></div>}
              </div>
            </div>

            {/* Screenshot Paste Zones */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14,marginBottom:14}}>
              {[
                {zid:'p1news',icon:'📅',title:'ECONOMIC CALENDAR',color:T.red,hint:'★★★ events only',state:p1NewsChart,setter:setP1NewsChart,inputId:'p1newsIn'},
                {zid:'p1prem',icon:'🌅',title:'PREMARKET CHART',color:T.orange,hint:'open type + prev week H/L',state:p1PremarketChart,setter:setP1PremarketChart,inputId:'p1premIn'},
                {zid:'p1lvl',icon:'◈',title:'KEY LEVELS CHART',color:T.gold,hint:'PDH/PDL/POC/VAH/VAL/VWAP',state:p1KeyLevelsChart,setter:setP1KeyLevelsChart,inputId:'p1lvlIn'}
              ].map(zone=>(
                <PasteZone key={zone.zid} zoneId={zone.zid} activeZone={activeZone} setActiveZone={setActiveZone}>
                  <div style={cardS({margin:0,borderLeft:`4px solid ${zone.color}`})} className="glass-panel">
                    <SHead icon={zone.icon} title={zone.title} color={zone.color}/>
                    <div 
                      onDrop={makeImgHandler(zone.setter)} 
                      onDragOver={e=>e.preventDefault()} 
                      onClick={e=>{e.stopPropagation();document.getElementById(zone.inputId).click();}} 
                      style={{
                        border:`2px dashed ${zone.state?zone.color:"#E5E7EB"}`,
                        borderRadius:6,
                        padding:"12px",
                        textAlign:"center",
                        cursor:"pointer",
                        background:"#F9FAFB",
                        minHeight:64
                      }}
                    >
                      <input id={zone.inputId} type="file" accept="image/*" style={{display:"none"}} onChange={makeImgHandler(zone.setter)}/>
                      {zone.state
                        ?<div><img src={`data:${zone.state.type};base64,${zone.state.b64}`} style={{maxWidth:"100%",maxHeight:56,borderRadius:3,objectFit:"contain",marginBottom:4}}/><button onClick={e=>{e.stopPropagation();zone.setter(null);}} style={{background:"rgba(255,69,58,0.1)",border:`1px solid rgba(255,69,58,0.4)`,borderRadius:4,padding:"2px 8px",cursor:"pointer",color:T.red,fontSize:9,fontFamily:T.font}}>✕ Remove</button></div>
                        :<div><div style={{color:"#9CA3AF",fontSize:11,marginBottom:2}}>Click → Ctrl+V or drag</div><div style={{color:"#D1D5DB",fontSize:9}}>{zone.hint}</div></div>}
                    </div>
                  </div>
                </PasteZone>
              ))}
            </div>

            {err && <div style={{color:T.red,fontSize:12,marginBottom:12,fontWeight:600}}>⚠ {err}</div>}
            <button onClick={runPart1} disabled={loading||isCsvParsing||!parsed||parsed.totalDays<5} style={glowBtn(T.green,loading||isCsvParsing||!parsed||parsed.totalDays<5)} className="btn-glass">
              ▶ RUN AMD PREMARKET ANALYSIS
            </button>

            <div ref={p1Ref} style={{marginTop:20}}>
              {loading && <Loader color={T.green} label="COLLECTIVE BRAIN PROCESSING AMD PHASES..."/>}
              {!loading && p1Out && (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}><Tag label="ANALYSIS COMPLETE" color={T.green}/><AMDPhaseTag phase={displayedAmdPhase}/></div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>{setActiveTab('trade');setErr('');}} style={glowBtn(T.orange,false)} className="btn-glass">→ TRADE ENTRY</button>
                      <button onClick={()=>navigator.clipboard?.writeText(p1Out)} style={{background:"transparent",border:`1px solid #E5E7EB`,borderRadius:6,padding:"8px 12px",cursor:"pointer",color:"#6B7280",fontSize:10,fontFamily:T.font}}>⎘ COPY</button>
                    </div>
                  </div>
                  <div style={cardS({borderLeft:`4px solid ${T.blue}`})} className="glass-panel"><RenderOut text={p1Out}/></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TRADE ENTRY */}
        {activeTab === 'trade' && (
          <div>
            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <AMDPhaseTag phase={displayedAmdPhase} />
              </div>
              <div style={{ flex: 2, minWidth: 280 }}>
                <TrafficLight state={trafficState} />
              </div>
            </div>

            {fr.parsed && (
              <div style={{ display: "flex", gap: 16, padding: "14px 20px", background: CSS_VARS.card, border: `1px solid ${complianceColor}40`, borderRadius: 10, marginBottom: 16, flexWrap: "wrap", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }} className="glass-panel">
                <LED color={complianceColor} size={10} />
                <span style={{ color: complianceColor, fontSize: 11, letterSpacing: 1, fontWeight: 700 }}>WATCHDOG:</span>
                {maxDL > 0 && <span style={{ color: isDailyBreached ? T.red : isDailyWarning ? T.gold : T.green, fontSize: 11, fontWeight: 600 }}>Daily ${dailyLossUsed.toFixed(0)}/${maxDL}</span>}
                {maxDD > 0 && curBal > 0 && <span style={{ color: isDDBreached ? T.red : isDDWarning ? T.gold : T.green, fontSize: 11, fontWeight: 600 }}>LiqDist ${(curBal - liqLevel).toFixed(0)}</span>}
                <span style={{ color: ist.isOpen ? T.green : T.red, fontSize: 11, fontWeight: 600 }}>{ist.isOpen ? "● MARKET OPEN" : "● MARKET CLOSED"}</span>
                {throttleActive && <span style={{ color: T.gold, fontSize: 11, fontWeight: 700 }}>⚠ DRAWDOWN THROTTLE</span>}
              </div>
            )}

            {/* Live extracted values */}
            {(extractedVals.adx !== null || extractedVals.ci !== null || sd1Target) && (
              <div style={{ display: "flex", gap: 16, padding: "12px 20px", background: "rgba(0,0,0,0.5)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, marginBottom: 16, flexWrap: "wrap" }} className="glass-panel">
                <span style={{ color: T.dim, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>LIVE:</span>
                {extractedVals.adx !== null && <span style={{ color: extractedVals.adx < 20 ? T.red : T.green, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>ADX {extractedVals.adx}</span>}
                {extractedVals.ci !== null && <span style={{ color: extractedVals.ci > 61.8 ? T.red : T.green, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>CI {extractedVals.ci}</span>}
                {extractedVals.vwap !== null && <span style={{ color: T.blue, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>VWAP {extractedVals.vwap}</span>}
                {sd1Target && <span style={{ color: T.cyan, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>SD1 {sd1Target.toFixed(2)}</span>}
                {sd2Target && <span style={{ color: T.purple, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>SD2 {sd2Target.toFixed(2)}</span>}
              </div>
            )}

            {/* Volatility Regime */}
            <div style={{ padding: "12px 20px", background: "rgba(0,0,0,0.5)", border: `1px solid ${T.blue}40`, borderRadius: 8, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }} className="glass-panel">
              <span style={{ color: T.dim, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>VOLATILITY REGIME:</span>
              <span style={{ color: volatilityRegime === 'Compression' ? T.red : volatilityRegime === 'Expansion' ? T.green : T.blue, fontSize: 14, fontWeight: 800 }}>{volatilityRegime}</span>
              <span style={{ color: T.muted, fontSize: 12, fontFamily: T.mono, fontWeight: 600 }}>(VR = {VR.toFixed(2)})</span>
            </div>

            {(liveAmdContext.range > 0 || liveAmdContext.relevantWick > 0) && (
              <div style={{ padding: "12px 20px", background: "rgba(191,90,242,0.08)", border: `1px solid rgba(191,90,242,0.22)`, borderRadius: 8, marginBottom: 20 }} className="glass-panel">
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ color: T.purple, fontSize: 10, letterSpacing: 1.2, fontWeight: 800 }}>LIVE AMD SIGNAL</span>
                  <Tag label={liveAmdPhase} color={T.purple} />
                  <Tag label={`Range ${liveAmdContext.range.toFixed(2)}`} color={T.blue} />
                  <Tag label={`Wick ${liveAmdContext.relevantWick.toFixed(2)}`} color={liveAmdContext.wickValidation.manipulated ? T.gold : T.muted} />
                  <Tag label={liveAmdContext.wickValidation.manipulated ? "Manipulation wick" : "No wick manipulation"} color={liveAmdContext.wickValidation.manipulated ? T.gold : T.green} />
                </div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                  {liveAmdContext.volumeNearLows ? "Close is holding near the session lows." : "Price is not sitting near the session lows."}{" "}
                  {liveAmdContext.higherHighs ? "Higher highs are still forming." : liveAmdContext.lowerLows ? "Lower lows are still forming." : "Trend structure is mixed."}
                </div>
              </div>
            )}

            {sweepEstimate && (
              <div style={{ padding: "12px 20px", background: "rgba(14,165,233,0.08)", border: `1px solid rgba(14,165,233,0.25)`, borderRadius: 8, marginBottom: 20 }} className="glass-panel">
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ color: T.blue, fontSize: 10, letterSpacing: 1.2, fontWeight: 800 }}>LIQUIDITY SWEEP WATCH</span>
                  <Tag label={`${sweepEstimate.levelName} ${sweepEstimate.levelValue.toFixed(2)}`} color={T.cyan} />
                  <span style={{ color: sweepEstimate.probability > 0.7 ? T.red : sweepEstimate.probability > 0.45 ? T.gold : T.green, fontSize: 13, fontWeight: 800 }}>
                    {(sweepEstimate.probability * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                  {sweepEstimate.alert}. {sweepEstimate.recommendedAction}.
                </div>
              </div>
            )}

            {/* Trade Setup */}
            <div style={cardS({ borderLeft: `4px solid ${T.orange}` })} className="glass-panel card-tilt">
              <SHead icon="⚡" title="TRADE SETUP" color={T.orange} />
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <Field label="TIME (IST)" value={f.timeIST} onChange={sf('timeIST')} options={TIME_OPTIONS} />
                <Field label="INSTRUMENT" value={f.instrument} onChange={sf('instrument')} options={[{ v: 'MNQ', l: 'MNQ · $2/pt' }, { v: 'MES', l: 'MES · $5/pt' }]} />
                <Field label="DIRECTION" value={f.direction} onChange={sf('direction')} options={[{ v: 'Long', l: '↑ Long' }, { v: 'Short', l: '↓ Short' }]} />
                <Field label="TRADE TYPE" value={f.tradeType} onChange={sf('tradeType')} options={[{ v: 'Trend', l: 'Trend' }, { v: 'MR', l: 'Mean Reversion' }]} />
                <Field label="ACCOUNT BALANCE ($)" value={f.accountBalance} onChange={sf('accountBalance')} type="number" mono />
                <Field label="RISK %" value={f.riskPct} onChange={sf('riskPct')} options={[{ v: '0.2', l: '0.2%' }, { v: '0.3', l: '0.3%' }, { v: '0.4', l: '0.4%' }]} />
              </div>
              
              {isThrottled && (
                <div style={{ marginTop: 12, padding: "10px 16px", background: "rgba(255,214,10,0.1)", border: `1px solid rgba(255,214,10,0.3)`, borderRadius: 6, color: T.gold, fontSize: 12, fontWeight: 600 }}>
                  ⚠ Drawdown throttle active: risk halved to {activeRiskPct}%
                </div>
              )}
            </div>

            {/* Entry Price */}
            <div style={cardS()}>
              <label style={lbl}>ENTRY PRICE</label>
              <input 
                type="number" 
                value={f.entryPrice} 
                onChange={e => sf('entryPrice')(e.target.value)} 
                placeholder="exact entry level" 
                style={inp} 
                className="input-glass" 
              />
            </div>

            {/* Image Upload Zones */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 12 }}>
              {[
                { zid: 'ss', icon: '📊', title: 'INDICATORS', color: T.purple, isMulti: true }, 
                { zid: 'vwap', icon: '〰', title: 'VWAP CHART', color: T.blue, state: vwapChart, setter: setVwapChart, inputId: 'vwapIn' }, 
                { zid: 'mp', icon: '◈', title: '30-MIN MP CHART', color: T.gold, state: mpChart, setter: setMpChart, inputId: 'mpIn' }
              ].map(zone => (
                <PasteZone key={zone.zid} zoneId={zone.zid} activeZone={activeZone} setActiveZone={setActiveZone}>
                  <div data-pastezone="true" style={cardS({ margin: 0, borderLeft: `4px solid ${zone.color}` })} className="glass-panel">
                    <SHead icon={zone.icon} title={zone.title} color={zone.color} />
                    
                    {zone.isMulti ? (
                      <div 
                        data-testid="terminal-screenshot-dropzone"
                        onDrop={handleScreenshotDrop} 
                        onDragOver={e => e.preventDefault()} 
                        style={{ 
                          border: `2px dashed ${screenshots.length ? T.purple : "rgba(255,255,255,0.15)"}`, 
                          borderRadius: 8, 
                          padding: "16px", 
                          textAlign: "center", 
                          cursor: "copy", 
                          background: "rgba(0,0,0,0.3)" 
                        }} 
                        className="glass-panel"
                      >
                        <div data-testid="terminal-screenshot-count" style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, marginBottom: 8 }}>
                          SCREENSHOTS {Math.min(screenshots.length, 4)}/4
                        </div>
                        {screenshots.length > 0 ? (
                          <div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 8 }}>
                              {screenshots.map((s, i) => (
                                <div key={i} style={{ position: "relative", width: 60, height: 40, borderRadius: 4, overflow: "hidden", border: `1px solid ${T.purple}60` }}>
                                  <img src={`data:${s.type};base64,${s.b64}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  <button 
                                    onClick={e => { e.stopPropagation(); setScreenshots(p => p.filter((_, idx) => idx !== i)); }} 
                                    style={{ position: "absolute", top: 0, right: 0, background: "rgba(0,0,0,0.8)", border: "none", width: 16, height: 16, cursor: "pointer", color: "#fff", fontSize: 10, padding: 0 }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ color: T.muted, fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Paste or drag screenshots here</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div 
                        data-testid={zone.zid === "vwap" ? "terminal-vwap-dropzone" : "terminal-mp-dropzone"}
                        onDrop={makeImgHandler(zone.setter)} 
                        onDragOver={e => e.preventDefault()} 
                        onClick={e => { e.stopPropagation(); document.getElementById(zone.inputId).click(); }} 
                        style={{ 
                          border: `2px dashed ${zone.state ? zone.color : "rgba(255,255,255,0.15)"}`, 
                          borderRadius: 8, 
                          padding: "16px", 
                          textAlign: "center", 
                          cursor: "pointer", 
                          background: "rgba(0,0,0,0.3)" 
                        }} 
                        className="glass-panel"
                      >
                        <input id={zone.inputId} type="file" accept="image/*" style={{ display: "none" }} onChange={makeImgHandler(zone.setter)} />
                        {zone.state ? (
                          <div>
                            <img src={`data:${zone.state.type};base64,${zone.state.b64}`} style={{ maxWidth: "100%", maxHeight: 60, borderRadius: 4, objectFit: "contain", marginBottom: 8, cursor: "crosshair" }} />
                            <button 
                              onClick={e => { e.stopPropagation(); zone.setter(null); }} 
                              style={{ display: "block", margin: "0 auto", background: "rgba(255,69,58,0.1)", border: `1px solid rgba(255,69,58,0.4)`, borderRadius: 4, padding: "4px 12px", cursor: "pointer", color: T.red, fontSize: 10, fontFamily: T.font, fontWeight: 700 }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ color: T.muted, fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Click → Ctrl+V or drag</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </PasteZone>
              ))}
            </div>

            {/* AI Extract Button */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "16px 0", padding: "12px 20px", background: CSS_VARS.card, border: `1px solid var(--border-subtle, rgba(0,0,0,0.05))`, borderRadius: 8, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }} className="glass-panel">
              <button onClick={extractFromScreenshots} disabled={extracting || screenshots.length === 0} style={glowBtn(T.purple, extracting || !screenshots.length)} className="btn-glass">
                {extracting ? "⟳ READING..." : "◉ EXTRACT INDICATORS"}
              </button>
              <span style={{color:T.muted,fontSize:10,flex:1,fontWeight:500}}>{extractStatus || "Extracts ADX · CI · ATR for Dead Zone check"}</span>
            </div>

            {/* Notes */}
            <div style={cardS()}>
              <label style={lbl}>NOTES</label>
              <textarea 
                value={f.notes} 
                onChange={e => sf('notes')(e.target.value)} 
                style={{ ...inp, minHeight: 60, resize: "vertical" }} 
                className="input-glass" 
              />
            </div>

            {err && (
              <div style={{ color: T.red, fontSize: 13, marginBottom: 16, fontWeight: 600, padding: "12px 16px", background: "rgba(255,69,58,0.1)", borderRadius: 8 }}>
                ⚠ {err}
              </div>
            )}

            <button onClick={runPart2} disabled={loading || isTerminalDerivedPending || execBlocked} style={glowBtn(T.orange, loading || isTerminalDerivedPending || execBlocked)} className="btn-glass">
              {isTerminalDerivedPending ? "SYNCING ENGINE..." : execBlocked ? `🚫 LOCKED` : "⚡ CAPTURE ENGINE"}
            </button>

            <div ref={p2Ref} style={{ marginTop: 24 }}>
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 240, gap: 16 }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 28 }}>
                    {[8, 15, 10, 20, 12, 17, 9].map((h, i) => (
                      <div key={i} style={{ width: 4, height: h, background: T.orange, borderRadius: 2, animation: `bar ${0.85 + i * 0.05}s ${i * 0.1}s ease-in-out infinite alternate` }} />
                    ))}
                  </div>
                  <span style={{ color: T.muted, fontSize: 12, letterSpacing: 2, fontWeight: 600 }}>RECURSIVE CONSENSUS ENGINE</span>
                </div>
              )}
              {!loading && p2Out && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <Tag label="EXECUTION PLAN READY" color={T.orange} />
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => setShowP2TradeForm(v => !v)} style={glowBtn(T.purple, false)} className="btn-glass">
                        {showP2TradeForm ? "✕ CANCEL" : "+ LOG TRADE"}
                      </button>
                    </div>
                  </div>
                  
              {showP2TradeForm && (
                    <div style={{ background: CSS_VARS.card, border: `1px solid var(--border-subtle, rgba(0,0,0,0.05))`, borderRadius: 12, padding: "20px 24px", marginBottom: 20, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)" }} className="glass-panel">
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 16 }}>
                        <Field label="EXIT PRICE" value={p2Jf.exit} onChange={sp2('exit')} type="number" mono />
                        <Field label="RESULT" value={p2Jf.result} onChange={sp2('result')} options={[{ v: 'win', l: '✓ Win' }, { v: 'loss', l: '✗ Loss' }, { v: 'breakeven', l: '◎ BE' }]} />
                        <Field label="AMD PHASE AT TRADE" value={p2Jf.amdPhase} onChange={sp2('amdPhase')} options={Object.keys(AMD_PHASES).map(k => ({ v: k, l: AMD_PHASES[k].label }))} />
                        <Field label="P&L ($)" value={p2Jf.pnl} onChange={sp2('pnl')} type="number" mono />
                        <Field label="BALANCE AFTER ($)" value={p2Jf.balAfter} onChange={sp2('balAfter')} type="number" mono />
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                        <Tag label={`Pred TP1: ${Number.isFinite(predictedP2TP1) ? predictedP2TP1.toFixed(2) : "—"}`} color={T.green} />
                        <Tag label={`Pred SL: ${Number.isFinite(predictedP2SL) ? predictedP2SL.toFixed(2) : "—"}`} color={T.red} />
                      </div>
                      <button onClick={addP2Trade} style={glowBtn(T.purple, false)} className="btn-glass">+ ADD TO JOURNAL</button>
                    </div>
                  )}
                  
                  <TrafficLight state={trafficState} />
                  
                  <div style={cardS({ borderLeft: `4px solid ${T.orange}` })} className="glass-panel card-tilt">
                    <RenderOut text={p2Out} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: JOURNAL */}
        {activeTab === 'journal' && (
          <div>
            {isJournalMetricsPending && (
              <div style={{ color: T.blue, fontSize: 11, marginBottom: 10 }}>
                Updating journal metrics...
              </div>
            )}
            {/* Performance Dashboard */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
              {[
                { l: "TOTAL P&L", v: `${metrics.pnlTotal >= 0 ? "+" : ""}$${metrics.pnlTotal.toFixed(2)}`, c: metrics.pnlTotal >= 0 ? T.green : T.red }, 
                { l: "WIN RATE", v: `${metrics.wr.toFixed(1)}%`, c: metrics.wr >= 50 ? T.green : T.red }, 
                { l: "PROFIT FACTOR", v: metrics.pf ? metrics.pf.toFixed(2) : "—", c: metrics.pf && metrics.pf >= 1.5 ? T.green : metrics.pf && metrics.pf >= 1 ? T.gold : T.red },
                { l: "PREDICTION ACCURACY (L5)", v: `${metrics.predictionAccuracyL5 ? metrics.predictionAccuracyL5.toFixed(1) : "0.0"}%`, c: metrics.predictionAccuracyL5 >= 85 ? T.green : metrics.predictionAccuracyL5 >= 70 ? T.gold : T.red, sub: metrics.recentAccuracies.length ? metrics.recentAccuracies.map(v => `${v.toFixed(0)}%`).join(" | ") : "No accuracy samples yet" }
              ].map((s, i) => (
                <div key={i} style={cardS({ margin: 0, textAlign: "center", padding: "20px" })} className="glass-panel card-tilt">
                  <div style={{ color: T.dim, fontSize: 11, letterSpacing: 1.5, marginBottom: 8, fontWeight: 700 }}>{s.l}</div>
                  <div style={{ color: s.c, fontSize: 24, fontWeight: 800, fontFamily: T.mono }}>{s.v}</div>
                  {s.sub && <div style={{ color: T.muted, fontSize: 10, marginTop: 8, lineHeight: 1.4 }}>{s.sub}</div>}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
              <div style={cardS({ margin: 0, padding: "18px 20px" })} className="glass-panel card-tilt">
                <SHead icon="▣" title="AMD PERFORMANCE BREAKDOWN" color={T.purple} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                  {metrics.amdBreakdown.map((bucket) => {
                    const color = AMD_PHASES[bucket.phase]?.color || T.muted;
                    return (
                      <div key={bucket.phase} style={{ padding: "10px 12px", borderRadius: 10, background: `${color}12`, border: `1px solid ${color}26` }}>
                        <div style={{ color: color, fontSize: 10, letterSpacing: 1.2, fontWeight: 800, textTransform: "uppercase" }}>{bucket.label}</div>
                        <div style={{ color: T.text, fontSize: 22, fontFamily: T.mono, fontWeight: 800, marginTop: 4 }}>{bucket.trades}</div>
                        <div style={{ color: T.muted, fontSize: 10, marginTop: 4, lineHeight: 1.4 }}>
                          {bucket.wins}W / {bucket.losses}L
                        </div>
                        <div style={{ color: color, fontSize: 11, fontWeight: 700, marginTop: 6 }}>{bucket.wr.toFixed(0)}% WR</div>
                        <div style={{ color: bucket.pnl >= 0 ? T.green : T.red, fontSize: 11, fontWeight: 700 }}>
                          {bucket.pnl >= 0 ? "+" : ""}${bucket.pnl.toFixed(0)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {metrics.bestAmdPhase && (
                  <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.08)", color: T.muted, fontSize: 11, lineHeight: 1.5 }}>
                    <span style={{ color: T.gold, fontWeight: 800 }}>Best phase:</span> {metrics.bestAmdPhase.label} with {metrics.bestAmdPhase.wr.toFixed(1)}% win rate across {metrics.bestAmdPhase.trades} trades.
                  </div>
                )}
              </div>

              <div style={cardS({ margin: 0, padding: "18px 20px" })} className="glass-panel card-tilt">
                <SHead icon="≈" title="EQUITY CURVE" color={T.blue} />
                {equityCurveView.dots.length === 0 ? (
                  <div style={{ color: T.muted, fontSize: 12, padding: "20px 0" }}>No equity data yet</div>
                ) : (
                  <div>
                    <svg viewBox="0 0 360 100" width="100%" height="100" role="img" aria-label="Equity curve">
                      <defs>
                        <linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor={T.blue} stopOpacity="0.28" />
                          <stop offset="100%" stopColor={T.blue} stopOpacity="0.02" />
                        </linearGradient>
                      </defs>
                      <rect x="0" y="0" width="360" height="100" rx="12" fill="rgba(0,0,0,0.03)" />
                      <path d={`${equityCurveView.path} L 346 86 L 14 86 Z`} fill="url(#equityFill)" opacity="0.9" />
                      <path
                        d={equityCurveView.path}
                        fill="none"
                        stroke={metrics.pnlTotal >= 0 ? T.green : T.red}
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      {equityCurveView.dots.map((point) => (
                        <circle
                          key={`${point.index}-${point.tradeLabel}`}
                          cx={point.x}
                          cy={point.y}
                          r="3.8"
                          fill={point.result === "win" ? T.green : point.result === "loss" ? T.red : T.gold}
                        >
                          <title>{`${point.tradeLabel}: ${point.cumulativePnl >= 0 ? "+" : ""}$${point.cumulativePnl.toFixed(2)}`}</title>
                        </circle>
                      ))}
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 8, color: T.muted, fontSize: 10 }}>
                      <span>Start $0</span>
                      <span>{equityCurveView.max >= 0 ? `High +$${equityCurveView.max.toFixed(0)}` : `Low -$${Math.abs(equityCurveView.min).toFixed(0)}`}</span>
                      <span>End {metrics.pnlTotal >= 0 ? "+" : ""}${metrics.pnlTotal.toFixed(0)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ color: T.muted, fontSize: 11, letterSpacing: 1.5, fontWeight: 700 }}>TRADE HISTORY — {journal.length} ENTRIES</span>
              <button onClick={()=>setShowForm(f=>!f)} style={glowBtn(journalFormOpen?T.muted:T.green,false)} className="btn-glass">{journalFormOpen?"✕ CANCEL":"+ LOG TRADE"}</button>
            </div>
            
            {journalFormOpen && (
              <div style={{background:"#F9FAFB",border:`1px solid #E5E7EB`,borderRadius:10,padding:"18px 20px",marginBottom:14}}>
                <div style={{ color: T.purple, fontSize: 11, letterSpacing: 1.5, fontWeight: 800, marginBottom: 10, textTransform: "uppercase" }}>
                  Add Journal Entry
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:10}}>
                  <div><label style={lbl}>DATE</label><input type="date" value={jf.date} onChange={e=>sjf('date')(e.target.value)} style={inp}/></div>
                  <div>
                    <label style={lbl}>Instrument</label>
                    <input
                      type="text"
                      placeholder="Instrument"
                      value={jf.instrument}
                      onChange={e=>sjf('instrument')(e.target.value)}
                      style={inp}
                      className="input-glass"
                    />
                  </div>
                  <Field label="DIRECTION" value={jf.direction} onChange={sjf('direction')} options={[{v:'Long',l:'↑ Long'},{v:'Short',l:'↓ Short'}]}/>
                  <Field label="TYPE" value={jf.tradeType} onChange={sjf('tradeType')} options={[{v:'Trend',l:'Trend'},{v:'MR',l:'Mean Reversion'}]}/>
                  <Field label="AMD PHASE" value={jf.amdPhase} onChange={sjf('amdPhase')} options={Object.keys(AMD_PHASES).map(k=>({v:k,l:AMD_PHASES[k].label}))}/>
                  <Field label="RRR" value={jf.rrr} onChange={sjf('rrr')} options={[{v:'1:1',l:'1:1'},{v:'1:1.2',l:'1:1.2'},{v:'1:2',l:'1:2'},{v:'1:2.2',l:'1:2.2'}]}/>
                  <Field label="RESULT" value={jf.result} onChange={sjf('result')} options={[{v:'win',l:'✓ Win'},{v:'loss',l:'✗ Loss'},{v:'breakeven',l:'◎ BE'}]}/>
                  <Field label="ENTRY" placeholder="Entry price" value={jf.entry} onChange={sjf('entry')} type="number" mono/>
                  <Field label="PRED TP1" placeholder="Predicted TP1" value={jf.predictedTP1} onChange={sjf('predictedTP1')} type="number" mono/>
                  <Field label="ACTUAL EXIT" placeholder="Exit price" value={jf.exit} onChange={sjf('exit')} type="number" mono/>
                  <Field label="P&L ($)" placeholder="P&L" value={jf.pnl} onChange={sjf('pnl')} type="number" mono/>
                  <Field label="BAL AFTER ($)" value={jf.balAfter} onChange={sjf('balAfter')} type="number" mono/>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>NOTES</label>
                  <textarea
                    value={jf.lessons}
                    onChange={e => sjf('lessons')(e.target.value)}
                    placeholder="Audit journal entry."
                    style={{ ...inp, minHeight: 88, resize: "vertical" }}
                    className="input-glass"
                  />
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={()=>{addJournalEntry();setShowForm(false);}} style={glowBtn(T.green,false)} className="btn-glass">SAVE ENTRY</button>
                  <button
                    onClick={() => setJournal(prev => prev.slice(0, -1))}
                    style={glowBtn(T.red, journal.length === 0)}
                    className="btn-glass"
                    disabled={journal.length === 0}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {journal.length === 0 ? (
              <div style={{ background: CSS_VARS.card, border: `1px solid var(--border-subtle, rgba(0,0,0,0.05))`, borderRadius: 12, padding: "60px", textAlign: "center", color: CSS_VARS.textSecondary, fontSize: 14, fontWeight: 600, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }} className="glass-panel">
                No trades logged yet
              </div>
            ) : (
            <div style={{ background: CSS_VARS.card, border: `1px solid var(--border-subtle, rgba(0,0,0,0.05))`, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }} className="glass-panel">
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid #E5E7EB` }}>
                        {["DATE", "INST", "DIR", "TYPE", "AMD", "ENTRY", "EXIT", "P&L", "RESULT", ""].map((h, i) => (
                          <th key={i} style={{ padding: "14px 16px", textAlign: "left", color: "#6B7280", fontSize: 10, letterSpacing: 1.5, fontFamily: T.font, fontWeight: 700, whiteSpace: "nowrap", background: "#F9FAFB" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...journal].reverse().map((t, i) => { 
                        const pv = parseFloat(t.pnl || 0);
                        const isW = t.result === 'win';
                        const isL = t.result === 'loss';
                        return (
                          <tr key={i} style={{ borderBottom: `1px solid #E5E7EB`, background: i % 2 === 0 ? "#F9FAFB" : "#FFFFFF" }}>
                            <td style={{ padding: "12px 16px", color: "#6B7280", fontSize: 11, whiteSpace: "nowrap", fontFamily: T.mono }}>{t.date}</td>
                            <td style={{ padding: "12px 16px", color: "#111827", fontSize: 12, fontWeight: 700 }}>{t.instrument}</td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ color: t.direction === 'Long' ? "#10B981" : "#EF4444", fontSize: 11, fontWeight: 600 }}>
                                {t.direction === 'Long' ? 'BUY' : 'SELL'}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", color: "#0EA5E9", fontSize: 11, fontWeight: 500 }}>{t.tradeType}</td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ color: "#D97706", fontSize: 10, fontWeight: 600 }}>{t.amdPhase?.slice(0, 10)}</span>
                            </td>
                            <td style={{ padding: "12px 16px", color: "#A1A1A6", fontSize: 11, fontFamily: T.mono }}>{t.entry || "—"}</td>
                            <td style={{ padding: "12px 16px", color: "#A1A1A6", fontSize: 11, fontFamily: T.mono }}>{t.exit || "—"}</td>
                            <td style={{ padding: "12px 16px", color: pv >= 0 ? "#10B981" : "#EF4444", fontSize: 13, fontWeight: 800, fontFamily: T.mono }}>
                              {pv >= 0 ? "+" : ""}${pv.toFixed(0)}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ color: isW ? "#10B981" : isL ? "#EF4444" : "#6B7280", fontSize: 11, fontWeight: 800 }}>
                                {isW ? "WIN" : isL ? "LOSS" : "BE"}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <button 
                                onClick={() => setJournal(prev => prev.filter((_, idx) => idx !== journal.length - 1 - i))} 
                                style={{ background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.3)", borderRadius: 4, cursor: "pointer", color: T.red, fontSize: 10, padding: "4px 8px", fontWeight: 700 }}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ); 
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ACCOUNT */}
        {activeTab === 'account' && (
          <div>
            <div style={cardS({ borderLeft: `4px solid ${T.green}` })} className="glass-panel card-tilt">
              <SHead icon="📋" title="PROP FIRM TERMS & CONDITIONS" color={T.green} />
              <div
                onDrop={handleFirmRulesDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => document.getElementById("tcIn")?.click()}
                style={{
                  border: `2px dashed ${firmRules.parsed ? T.green : "rgba(255,255,255,0.15)"}`,
                  borderRadius: 10,
                  padding: "32px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: "rgba(0,0,0,0.3)",
                  marginBottom: 16,
                  position: "relative",
                  overflow: "hidden",
                }}
                className="glass-panel"
              >
                <input id="tcIn" type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: "none" }} onChange={handleFirmRulesDrop} />
                <div style={{ fontSize: 32, marginBottom: 12, opacity: firmRules.parsed ? 1 : 0.2 }}>
                  {firmRules.parsed ? "✓" : "📋"}
                </div>
                <div style={{ color: firmRules.parsed ? T.green : T.muted, fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
                  {firmRules.parsed ? `T&C Loaded: ${firmRules.firmName || "Firm Rules"}` : "Drop T&C document or click to browse"}
                </div>
                <div style={{ color: T.muted, fontSize: 11 }}>
                  Best results with text-extractable files. {tcFileName ? `Last file: ${tcFileName}` : ""}
                </div>
              </div>
              {tcParsing && (
                <div style={{ color: T.blue, fontSize: 12, textAlign: "center", fontWeight: 600, marginBottom: 8 }}>
                  ⟳ AI ANALYZING COMPLIANCE RULES...
                </div>
              )}
              {firmRules.parseStatus && (
                <div style={{ color: String(firmRules.parseStatus).startsWith("✓") ? T.green : T.red, fontSize: 12, textAlign: "center", marginBottom: 12 }}>
                  {firmRules.parseStatus}
                </div>
              )}
              {firmRules.parsed && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 12 }}>
                  <Tag label={`News: ${firmRules.newsTrading ? "Allowed" : "Blocked"}`} color={firmRules.newsTrading ? T.green : T.red} />
                  <Tag label={`Overnight: ${firmRules.overnightHoldingAllowed ? "Allowed" : "Blocked"}`} color={firmRules.overnightHoldingAllowed ? T.green : T.red} />
                  <Tag label={`Weekend: ${firmRules.weekendTrading ? "Allowed" : "Blocked"}`} color={firmRules.weekendTrading ? T.green : T.red} />
                  <Tag label={`Copy: ${firmRules.copyTradingAllowed ? "Allowed" : "Blocked"}`} color={firmRules.copyTradingAllowed ? T.green : T.red} />
                  <Tag label={`Hedging: ${firmRules.hedgingAllowed ? "Allowed" : "Blocked"}`} color={firmRules.hedgingAllowed ? T.green : T.red} />
                  <Tag label={`Min Days: ${firmRules.minimumTradingDays || "0"}`} color={T.blue} />
                  <Tag label={`EOD Flat: ${firmRules.eodFlatRequired ? "Required" : "Optional"}`} color={firmRules.eodFlatRequired ? T.gold : T.muted} />
                </div>
              )}
              {firmRules.parsed && Array.isArray(firmRules.keyRules) && firmRules.keyRules.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
                  {firmRules.keyRules.slice(0, 10).map((rule, idx) => (
                    <div key={idx} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: T.muted, fontSize: 12 }}>
                      • {rule}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={cardS({ borderLeft: `4px solid ${T.blue}` })} className="glass-panel card-tilt">
              <SHead icon="💰" title="LIVE ACCOUNT STATE" color={T.blue} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: T.green, fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, display: "inline-block" }} />
                Sync Status
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
                <Field label="STARTING BALANCE ($)" value={accountState.startingBalance} onChange={v => setAccountState(p => ({...p, startingBalance: v}))} type="number" mono />
                <Field label="CURRENT BALANCE ($)" value={accountState.currentBalance} onChange={v => setAccountState(p => ({...p, currentBalance: v}))} type="number" mono />
                <Field label="HIGH-WATER MARK ($)" value={accountState.highWaterMark} onChange={v => setAccountState(p => ({...p, highWaterMark: v}))} type="number" mono />
                <Field label="TODAY START BALANCE ($)" value={accountState.dailyStartBalance} onChange={v => setAccountState(p => ({...p, dailyStartBalance: v}))} type="number" mono />
              </div>
              <button 
                onClick={() => { 
                  if (onSaveAccount) onSaveAccount(accountState); 
                  showToast?.('Capture engine complete.', 'success'); 
                }} 
                style={glowBtn(T.orange, false)} 
                className="btn-glass"
              >
                CAPTURE ENGINE
              </button>
              <button 
                onClick={() => { if (onSaveAccount) onSaveAccount(accountState); showToast('Account state persisted to distributed ledger.', 'success'); }} 
                style={glowBtn(T.blue, false)} 
                className="btn-glass"
              >
                💾 SAVE TO CLOUD
              </button>

              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  marginTop: 14,
                  padding: "16px 18px",
                  borderRadius: 12,
                  textDecoration: "none",
                  background:
                    "linear-gradient(135deg, rgba(37,99,235,0.14), rgba(14,165,233,0.1))",
                  border: "1px solid rgba(37,99,235,0.24)",
                }}
              >
                <div
                  style={{
                    color: T.blue,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  LinkedIn
                </div>
                <div
                  style={{
                    color: T.text,
                    fontSize: 14,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  Builder profile and release trail
                </div>
                <div style={{ color: T.muted, fontSize: 12, lineHeight: 1.5 }}>
                  Open the Traders Regiment LinkedIn card for the current build owner.
                </div>
              </a>
            </div>
          </div>
        )}
      </div>

      {resetDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.5)",
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
              border: "1px solid rgba(148,163,184,0.18)",
              borderRadius: 20,
              padding: "24px 22px",
              boxShadow: "0 30px 80px rgba(15,23,42,0.18)",
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
