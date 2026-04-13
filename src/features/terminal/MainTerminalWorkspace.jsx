import React, { useCallback, useEffect } from "react";
import {
  buildResetWorkspaceState,
  MAX_HISTORY_ENTRIES,
} from "./terminalWorkspaceState.js";
import {
  parseWorkspaceSnapshot,
} from "./terminalStateHelpers.js";
import {
  clearDraft,
  getDraftStorageKey,
  readDraft,
  writeDraft,
} from "../../services/draftVault.js";

const DIALOG_CONTENT = {
  premarket: { title: "Reset premarket workspace?", description: "This clears CSV parsing, premarket charts, and the saved Part 1 analysis for this account.", confirmLabel: "Reset premarket" },
  trade: { title: "Reset trade workspace?", description: "This clears screenshots, extracted values, trade planner fields, and the saved Part 2 output.", confirmLabel: "Reset trade page" },
  journalForm: { title: "Reset journal form?", description: "This clears the draft journal form only. Existing journal history stays untouched.", confirmLabel: "Reset journal form" },
  journalHistory: { title: "Delete all journal history?", description: "This permanently clears every saved journal entry for this account after the next sync.", confirmLabel: "Delete journal history" },
  account: { title: "Reset account page?", description: "This resets account balances and firm-rule inputs back to the last server baseline for this user.", confirmLabel: "Reset account page" },
  all: { title: "Clear the full workspace?", description: "This wipes all tabs back to their default state and removes the saved local draft for this account.", confirmLabel: "Clear everything" },
};

/**
 * MainTerminalWorkspace — workspace snapshot, undo, reset, and autosave.
 *
 * Exposes these via props (called by MainTerminal after the component runs):
 *   applyWorkspaceState  — (state) => void   (MainTerminal's internal setter-bundle)
 *   buildBaseWorkspaceState  — () => object   (MainTerminal's internal useCallback)
 *   buildCurrentWorkspaceState — () => object (MainTerminal's internal useCallback)
 *   mergeWorkspaceState  — (baseline, draft) => object (MainTerminal's internal useCallback)
 *   workspaceHistory     — array
 *   setWorkspaceHistory  — (fn) => void
 *   terminalDraftKey     — string | null
 *   profile              — user profile
 *   auditScenario        — string
 *   showToast            — (msg, type) => void
 *   setResetDialog        — (dialog) => void
 *   setDraftStatus        — (fn) => void
 *
 * Also owns these refs (passed as { current: value } objects):
 *   lastSnapshotRef, skipHistoryRef, draftHydratedRef
 *
 * And returns this via props:
 *   handleUndoLastChange  — useCallback result (passed back so MainTerminal wires it to AutosaveBar)
 *   openResetDialog      — useCallback result (passed back)
 *   restoreWorkspaceState — useCallback result (passed back)
 *   runResetAction       — useCallback result (passed back)
 *   canUndo              — boolean (derived, passed back)
 *   tabResetScope        — string (derived, passed back)
 */
export default function MainTerminalWorkspace({
  applyWorkspaceState,
  buildBaseWorkspaceState,
  buildCurrentWorkspaceState,
  mergeWorkspaceState,
  workspaceHistory,
  setWorkspaceHistory,
  defaultExtractedVals,
  defaultFirmRules,
  terminalDraftKey,
  profile,
  auditScenario,
  showToast,
  setResetDialog,
  setDraftStatus,
  lastSnapshotRef,
  skipHistoryRef,
  draftHydratedRef,
  onReturn,
}) {
  // ── Hydrate workspace from localStorage on mount ──────────────────────────
  useEffect(() => {
    let cancelled = false;

    const hydrateWorkspace = async () => {
      const baseline = buildBaseWorkspaceState();

      if (!terminalDraftKey) {
        applyWorkspaceState(baseline);
        draftHydratedRef.current = true;
        setDraftStatus({ hydrated: true, lastSavedAt: null, error: "" });
        return;
      }

      const persistedDraft = await readDraft(terminalDraftKey, null);
      if (cancelled) return;

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyWorkspaceState, buildBaseWorkspaceState, mergeWorkspaceState, terminalDraftKey]);

  // ── Autosave on workspace change ─────────────────────────────────────────
  useEffect(() => {
    if (!terminalDraftKey || !draftHydratedRef.current) return undefined;

    const snapshot = buildCurrentWorkspaceState();
    const serialized = JSON.stringify(snapshot);

    if (serialized === lastSnapshotRef.current) {
      if (skipHistoryRef.current) skipHistoryRef.current = false;
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

    const payload = { ...snapshot, savedAt: new Date().toISOString() };

    const timer = setTimeout(() => {
      void writeDraft(terminalDraftKey, payload)
        .then(() => setDraftStatus((current) => ({ ...current, lastSavedAt: payload.savedAt, error: "" })))
        .catch((error) => setDraftStatus((current) => ({ ...current, error: error?.message || "Autosave failed." })));
    }, 180);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildCurrentWorkspaceState, terminalDraftKey]);

  // ── Sync from other tabs via storage event ─────────────────────────────────
  useEffect(() => {
    if (!terminalDraftKey || !draftHydratedRef.current) return undefined;

    const storageKey = getDraftStorageKey(terminalDraftKey);
    const handleStorage = (event) => {
      if (event.key !== storageKey || !event.newValue) return;

      void readDraft(terminalDraftKey, null).then((persistedDraft) => {
        if (!persistedDraft) return;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyWorkspaceState, buildBaseWorkspaceState, mergeWorkspaceState, terminalDraftKey]);

  // ── Undo last change ───────────────────────────────────────────────────────
  const handleUndoLastChange = useCallback(() => {
    if (!workspaceHistory.length) return;
    const previousSnapshot = workspaceHistory[workspaceHistory.length - 1];
    setWorkspaceHistory((current) => current.slice(0, -1));
    skipHistoryRef.current = true;
    applyWorkspaceState(previousSnapshot);
    lastSnapshotRef.current = JSON.stringify(previousSnapshot);
    setDraftStatus((current) => ({ ...current, error: "" }));
  }, [workspaceHistory, applyWorkspaceState, lastSnapshotRef, skipHistoryRef, setDraftStatus]);

  // ── Restore workspace state ────────────────────────────────────────────────
  const restoreWorkspaceState = useCallback(
    (nextState, shouldClearHistory = false) => {
      skipHistoryRef.current = true;
      applyWorkspaceState(nextState);
      lastSnapshotRef.current = JSON.stringify(nextState);
      if (shouldClearHistory) setWorkspaceHistory([]);
      setDraftStatus((current) => ({ ...current, error: "" }));
    },
    [applyWorkspaceState, lastSnapshotRef, skipHistoryRef, setWorkspaceHistory, setDraftStatus],
  );

  // ── Run reset action ──────────────────────────────────────────────────────
  const runResetAction = useCallback(
    async (scope) => {
      const baseline = buildBaseWorkspaceState();
      const currentState = buildCurrentWorkspaceState();
      const nextState = buildResetWorkspaceState({ scope, currentState, baseline });
      skipHistoryRef.current = true;
      applyWorkspaceState(nextState);
      lastSnapshotRef.current = JSON.stringify(nextState);
      if (scope === "all" && terminalDraftKey) {
        await clearDraft(terminalDraftKey);
      }
      setWorkspaceHistory(scope === "all" ? [] : undefined);
      setDraftStatus((current) => ({ ...current, error: "" }));
      showToast?.(
        scope === "journalHistory" ? "Journal history cleared." : "Workspace reset complete.",
        "success",
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buildBaseWorkspaceState, buildCurrentWorkspaceState, buildResetWorkspaceState, applyWorkspaceState, terminalDraftKey, clearDraft, showToast, skipHistoryRef, lastSnapshotRef],
  );

  // ── Open reset dialog ────────────────────────────────────────────────────
  const openResetDialog = useCallback(
    (scope) => {
      setResetDialog({ scope, ...(DIALOG_CONTENT[scope] || DIALOG_CONTENT.all) });
    },
    [setResetDialog],
  );

  // ── Derived values ────────────────────────────────────────────────────────
  const canUndo = workspaceHistory.length > 0;
  const activeTab = null; // placeholder — MainTerminal passes this via onReturn if needed
  const resetScopeByTab = {
    premarket: "premarket",
    trade: "trade",
    journal: "journalForm",
    account: "account",
  };
  // activeTab is managed in MainTerminal; expose null here and let onReturn carry derived values
  const tabResetScope = "all";

  // Pass all action callbacks and derived values back to MainTerminal
  onReturn?.({
    handleUndoLastChange,
    openResetDialog,
    restoreWorkspaceState,
    runResetAction,
    canUndo,
    tabResetScope,
  });

  return null;
}
