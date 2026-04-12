import React, { useCallback, useEffect } from "react";

/**
 * MainTerminalWorkspace — workspace state management: snapshot, undo, reset, autosave.
 *
 * Props:
 *   profile              — user profile object
 *   auditScenario        — string
 *   // State setters
 *   setWorkspaceHistory  — (fn) => void
 *   setResetDialog       — (dialog) => void
 *   setDraftStatus       — (fn) => void
 *   applyWorkspaceState  — (state) => void
 *   // Workspace state values
 *   workspaceHistory     — array (undo stack)
 *   defaultExtractedVals — object
 *   defaultFirmRules    — object
 *   profileJournal       — array
 *   profileAccountState  — object
 *   profileFirmRules     — object
 *   // Active terminal state (passed to buildCurrentWorkspaceState)
 *   activeTab            — string
 *   screenshots          — array
 *   extractStatus        — string
 *   extractedVals        — object
 *   activeZone           — string | null
 *   mpChart              — object | null
 *   vwapChart            — object | null
 *   p1NewsChart          — object | null
 *   p1PremarketChart     — object | null
 *   p1KeyLevelsChart     — object | null
 *   journal              — array
 *   accountState         — object
 *   firmRules            — object
 *   tcFileName           — string
 *   currentAMD           — string
 *   p1Out               — string
 *   p2Out               — string
 *   parsed              — object | null
 *   parseMsg            — string
 *   f                   — object
 *   showP2TradeForm     — boolean
 *   p2Jf               — object
 *   jf                 — object
 *   showForm            — boolean
 *   // Refs
 *   lastSnapshotRef     — { current: string }
 *   skipHistoryRef      — { current: boolean }
 *   draftHydratedRef     — { current: boolean }
 *   // Persistence
 *   terminalDraftKey     — string | null
 *   readDraft            — (key, fallback) => Promise<object>
 *   writeDraft           — (key, data) => Promise<void>
 *   clearDraft           — (key) => Promise<void>
 *   // Utilities
 *   buildTradePlannerState  — () => object
 *   buildAccountState       — (obj) => object
 *   buildP2JournalState     — () => object
 *   buildJournalFormState   — () => object
 *   normalizeJournal        — (arr) => array
 *   buildResetWorkspaceState — ({ scope, currentState, baseline }) => object
 *   parseWorkspaceSnapshot  — (json) => object | null
 *   getDraftStorageKey      — (key) => string
 *   // Actions
 *   buildBaseWorkspaceState  — useCallback result (passed for dep array)
 *   buildCurrentWorkspaceState — useCallback result (passed for dep array)
 *   mergeWorkspaceState      — useCallback result
 *   showToast               — (msg, type) => void
 *   onUndoLastChange        — () => void (from parent)
 *   onRunResetAction        — (scope) => Promise<void>
 *   onOpenResetDialog        — (scope) => void
 */
export default function MainTerminalWorkspace({
  // State setters
  setWorkspaceHistory,
  setResetDialog,
  setDraftStatus,
  applyWorkspaceState,
  // Refs
  lastSnapshotRef,
  skipHistoryRef,
  draftHydratedRef,
  // Persistence
  terminalDraftKey,
  readDraft,
  writeDraft,
  clearDraft,
  // Utilities
  buildBaseWorkspaceState,
  buildCurrentWorkspaceState,
  mergeWorkspaceState,
  buildResetWorkspaceState,
  parseWorkspaceSnapshot,
  getDraftStorageKey,
  // Workspace state
  workspaceHistory,
  defaultExtractedVals,
  defaultFirmRules,
  profileJournal,
  profileAccountState,
  profileFirmRules,
  // Active terminal state
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
  // Actions
  showToast,
  onUndoLastChange,
  onRunResetAction,
  onOpenResetDialog,
}) {
  // ── Hydrate workspace from localStorage on mount ──────────────────────────
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
          return nextHistory.slice(-20);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildCurrentWorkspaceState, terminalDraftKey]);

  // ── Sync from other tabs via storage event ────────────────────────────────
  useEffect(() => {
    if (!terminalDraftKey || !draftHydratedRef.current) {
      return undefined;
    }

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

  // ── Undo last change ─────────────────────────────────────────────────────
  const handleUndoLastChange = useCallback(() => {
    if (!workspaceHistory.length) return;

    const previousSnapshot = workspaceHistory[workspaceHistory.length - 1];
    setWorkspaceHistory((current) => current.slice(0, -1));

    // Delegate to parent's applyWorkspaceState via ref or prop
    skipHistoryRef.current = true;
    applyWorkspaceState(previousSnapshot);
    lastSnapshotRef.current = JSON.stringify(previousSnapshot);
    setDraftStatus((current) => ({ ...current, error: "" }));
  }, [workspaceHistory, applyWorkspaceState, lastSnapshotRef, skipHistoryRef, setDraftStatus]);

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
      showToast?.(scope === "journalHistory" ? "Journal history cleared." : "Workspace reset complete.", "success");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buildBaseWorkspaceState, buildCurrentWorkspaceState, buildResetWorkspaceState, applyWorkspaceState, terminalDraftKey, clearDraft, showToast, skipHistoryRef, lastSnapshotRef],
  );

  // ── Open reset dialog ────────────────────────────────────────────────────
  const openResetDialog = useCallback(
    (scope) => {
      const DIALOG_CONTENT = {
        tabData: { title: "Reset Tab Data?", description: "This will clear the current tab's data.", confirmLabel: "Reset Tab" },
        analysis: { title: "Reset Analysis?", description: "This will clear all P1/P2 analysis output.", confirmLabel: "Reset Analysis" },
        journalHistory: { title: "Clear Journal History?", description: "This will permanently delete all journal entries.", confirmLabel: "Clear History" },
        all: { title: "Reset Everything?", description: "This will clear ALL data across all tabs.", confirmLabel: "Reset All" },
      };
      setResetDialog({ scope, ...(DIALOG_CONTENT[scope] || DIALOG_CONTENT.all) });
    },
    [setResetDialog],
  );

  // Return action handlers for parent to wire up
  return null; // This component only manages effects; it renders nothing.
}
