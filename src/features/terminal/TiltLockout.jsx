import React, { useCallback, useEffect, useRef, useState } from "react";

const TILT_SENTENCES = [
  "I am trading with discipline, not emotion.",
  "A bad trade does not define my skill.",
  "I will not chase losses today.",
  "Patience is my edge.",
  "I trade the plan, not the P&L.",
];

const STORAGE_KEY = "tilt_lockout_until";

function getTiltUntil() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? parseInt(v, 10) : null;
  } catch { return null; }
}

export function isTiltLocked() {
  const until = getTiltUntil();
  return until !== null && Date.now() < until;
}

/**
 * Clears the tilt lockout timestamp (call after cooldown expires).
 */
export function clearTiltLock() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
}

const SAMPLE = TILT_SENTENCES[Math.floor(Math.random() * TILT_SENTENCES.length)];

export default function TiltLockout({ onUnlocked }) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef(null);

  // Auto-focus the input when modal opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = useCallback((e) => {
    // Block paste entirely
    if (e.nativeEvent?.inputType === "insertFromPaste") return;
    setTyped(e.target.value);
  }, []);

  // Block Ctrl+V
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "v") {
      e.preventDefault();
    }
  }, []);

  const isComplete = typed.trim().toLowerCase() === SAMPLE.toLowerCase();

  if (isComplete) {
    clearTiltLock();
    onUnlocked?.();
    return null;
  }

  return (
    /* Fixed overlay — sits outside the pointer-events:none app wrapper */
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10, 14, 23, 0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "90%",
          background: "rgba(20, 28, 45, 0.95)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 20,
          padding: "36px 40px",
          boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏸</div>

        {/* Title */}
        <div
          style={{
            color: "rgba(255,255,255,0.90)",
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 2,
            marginBottom: 8,
            textTransform: "uppercase",
          }}
        >
          TILT LOCKOUT ACTIVE
        </div>

        <div
          style={{
            color: "rgba(255,255,255,0.45)",
            fontSize: 12,
            lineHeight: 1.6,
            marginBottom: 28,
          }}
        >
          You've had {">"} 3 consecutive losses. Trading is paused.<br />
          Type the sentence below to unlock.
        </div>

        {/* Sentence to type */}
        <div
          style={{
            fontFamily: "monospace",
            color: "rgba(255,255,255,0.20)",
            fontSize: 13,
            letterSpacing: 1,
            marginBottom: 16,
            padding: "14px 18px",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {SAMPLE}
        </div>

        {/* Typing input — paste is blocked */}
        <input
          ref={inputRef}
          value={typed}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={(e) => e.preventDefault()}
          autoComplete="off"
          spellCheck={false}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${typed.length > 0 && !isComplete ? "rgba(255,100,100,0.5)" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 8,
            padding: "12px 16px",
            color: "rgba(255,255,255,0.90)",
            fontSize: 13,
            fontFamily: "monospace",
            letterSpacing: 1,
            outline: "none",
            textAlign: "center",
            transition: "border-color 0.2s ease",
            boxSizing: "border-box",
          }}
        />

        {/* Progress */}
        <div
          style={{
            marginTop: 10,
            fontSize: 10,
            color: "rgba(255,255,255,0.30)",
            letterSpacing: 1,
          }}
        >
          {typed.length}/{SAMPLE.length} characters
        </div>

        {/* Unlock button (only when complete) */}
        {isComplete && (
          <button
            onClick={() => {
              clearTiltLock();
              onUnlocked?.();
            }}
            style={{
              marginTop: 20,
              padding: "10px 28px",
              background: "rgba(34,197,94,0.15)",
              border: "1px solid rgba(34,197,94,0.4)",
              borderRadius: 8,
              color: "#22c55e",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              cursor: "pointer",
            }}
          >
            UNLOCK TERMINAL
          </button>
        )}
      </div>
    </div>
  );
}
