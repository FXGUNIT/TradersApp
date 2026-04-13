/**
 * Terminal Workspace State Management
 * Extracted from MainTerminal.jsx for file size compliance.
 * Handles: building, merging, and restoring full terminal state snapshots.
 */

import {
  buildAccountState,
  normalizeJournal,
  buildTradePlannerState,
  buildP2JournalState,
  buildJournalFormState,
} from "./terminalStateHelpers.js";

// Default extracted values (matches MainTerminal's defaultExtractedVals)
export const DEFAULT_EXTRACTED_VALS = {
  adx: null,
  ci: null,
  vwap: null,
  vwapSlope: null,
  atr: null,
  currentPrice: null,
  fiveDayATR: null,
  twentyDayATR: null,
};

// Default firm rules
export const DEFAULT_FIRM_RULES = {
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

// ─── Workspace State Builder ──────────────────────────────────────────────────

/**
 * Build the baseline workspace state (reset/default state).
 * auditScenario: "app" | "" — drives initial tab and form visibility.
 * profile: user profile with journal, accountState, firmRules.
 */
export function buildBaseWorkspaceState({ auditScenario, profile }) {
  return {
    activeTab: auditScenario === "app" ? "trade" : "premarket",
    screenshots: [],
    extractStatus: "",
    extractedVals: { ...DEFAULT_EXTRACTED_VALS },
    activeZone: null,
    mpChart: null,
    vwapChart: null,
    p1NewsChart: null,
    p1PremarketChart: null,
    p1KeyLevelsChart: null,
    journal: normalizeJournal(profile?.journal),
    accountState: buildAccountState(profile?.accountState),
    firmRules: {
      ...DEFAULT_FIRM_RULES,
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
  };
}

/**
 * Build the current workspace state from all live React state values.
 */
export function buildCurrentWorkspaceState({
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
}) {
  return {
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
  };
}

// ─── Workspace State Merger ─────────────────────────────────────────────────────

/**
 * Merge persisted draft with baseline state.
 * Handles partial updates, nested object merging, and type coercion.
 */
export function mergeWorkspaceState(baseline, persistedDraft) {
  if (!persistedDraft) {
    return baseline;
  }

  return {
    ...baseline,
    ...persistedDraft,
    extractedVals: {
      ...DEFAULT_EXTRACTED_VALS,
      ...(persistedDraft.extractedVals || {}),
    },
    accountState: buildAccountState(
      persistedDraft.accountState || baseline.accountState,
    ),
    firmRules: {
      ...DEFAULT_FIRM_RULES,
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
}

// ─── Workspace State Applier ────────────────────────────────────────────────────

/**
 * Return a state-update object suitable for MainTerminal's setState calls.
 * Usage: dispatch(applyWorkspaceStateToSetters(snapshot))
 */
export function applyWorkspaceStateToSetters(nextState) {
  return {
    activeTab: nextState.activeTab,
    screenshots: Array.isArray(nextState.screenshots) ? nextState.screenshots : [],
    extractStatus: nextState.extractStatus || "",
    extractedVals: { ...DEFAULT_EXTRACTED_VALS, ...(nextState.extractedVals || {}) },
    activeZone: nextState.activeZone || null,
    mpChart: nextState.mpChart || null,
    vwapChart: nextState.vwapChart || null,
    p1NewsChart: nextState.p1NewsChart || null,
    p1PremarketChart: nextState.p1PremarketChart || null,
    p1KeyLevelsChart: nextState.p1KeyLevelsChart || null,
    journal: Array.isArray(nextState.journal) ? nextState.journal : [],
    accountState: buildAccountState(nextState.accountState),
    firmRules: { ...DEFAULT_FIRM_RULES, ...(nextState.firmRules || {}) },
    tcFileName: nextState.tcFileName || "",
    currentAMD: nextState.currentAMD || "UNCLEAR",
    p1Out: nextState.p1Out || "",
    p2Out: nextState.p2Out || "",
    parsed: nextState.parsed || null,
    parseMsg: nextState.parseMsg || "",
    f: { ...buildTradePlannerState(), ...(nextState.f || {}) },
    showP2TradeForm: Boolean(nextState.showP2TradeForm),
    p2Jf: { ...buildP2JournalState(), ...(nextState.p2Jf || {}) },
    jf: { ...buildJournalFormState(), ...(nextState.jf || {}) },
    showForm: Boolean(nextState.showForm),
  };
}

// ─── Reset Action Helpers ──────────────────────────────────────────────────────

/**
 * Build a partial state for a targeted reset action.
 * scope: "all" | "premarket" | "trade" | "journalForm" | "journalHistory" | "account"
 */
export function buildResetWorkspaceState({ scope, currentState, baseline }) {
  switch (scope) {
    case "all":
      return baseline;

    case "premarket":
      return {
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

    case "trade":
      return {
        ...currentState,
        activeTab: "trade",
        screenshots: [],
        extractStatus: "",
        extractedVals: { ...DEFAULT_EXTRACTED_VALS },
        activeZone: null,
        mpChart: null,
        vwapChart: null,
        p2Out: "",
        f: buildTradePlannerState(),
        showP2TradeForm: false,
        p2Jf: buildP2JournalState(),
      };

    case "journalForm":
      return {
        ...currentState,
        activeTab: "journal",
        jf: buildJournalFormState(),
        showForm: true,
      };

    case "journalHistory":
      return {
        ...currentState,
        activeTab: "journal",
        journal: [],
        jf: buildJournalFormState(),
        showForm: true,
      };

    case "account":
      return {
        ...currentState,
        activeTab: "account",
        accountState: buildAccountState(baseline.accountState),
        firmRules: { ...DEFAULT_FIRM_RULES, ...(baseline.firmRules || {}) },
        tcFileName: "",
      };

    default:
      return currentState;
  }
}

export const RESET_MESSAGES = {
  all: "Entire workspace cleared.",
  premarket: "Premarket workspace cleared.",
  trade: "Trade workspace cleared.",
  journalForm: "Journal form reset.",
  journalHistory: "Journal history deleted.",
  account: "Account page reset.",
};

export const RESET_DIALOG_CONTENT = {
  premarket: {
    title: "Reset premarket workspace?",
    description: "This clears CSV parsing, premarket charts, and the saved Part 1 analysis for this account.",
    confirmLabel: "Reset premarket",
  },
  trade: {
    title: "Reset trade workspace?",
    description: "This clears screenshots, extracted values, trade planner fields, and the saved Part 2 output.",
    confirmLabel: "Reset trade page",
  },
  journalForm: {
    title: "Reset journal form?",
    description: "This clears the draft journal form only. Existing journal history stays untouched.",
    confirmLabel: "Reset journal form",
  },
  journalHistory: {
    title: "Delete all journal history?",
    description: "This permanently clears every saved journal entry for this account after the next sync.",
    confirmLabel: "Delete journal history",
  },
  account: {
    title: "Reset account page?",
    description: "This resets account balances and firm-rule inputs back to the last server baseline for this user.",
    confirmLabel: "Reset account page",
  },
  all: {
    title: "Clear the full workspace?",
    description: "This wipes all tabs back to their default state and removes the saved local draft for this account.",
    confirmLabel: "Clear everything",
  },
};

export const MAX_HISTORY_ENTRIES = 10;

export const ROTATING_QUOTES = [
  "The trend is your friend until the end when it bends. - Ed Seykota",
  "Markets can remain irrational longer than you can remain solvent. - John Maynard Keynes",
  "Risk comes from not knowing what you're doing. - Warren Buffett",
  "The goal is to make money, not to be right. - Mark Douglas",
];
