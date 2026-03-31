/**
 * useSessionFatigue.js — silent session fatigue tracker.
 *
 * Uses requestAnimationFrame for the countdown timer so it NEVER triggers
 * React re-renders during the 120-minute session. The amber state is
 * applied purely through CSS variable mutations on `document.documentElement`.
 *
 * The 60-second crossfade is handled by CSS transitions on the amber variables,
 * making the shift imperceptible.
 *
 * State machine:
 *   FRESH (0–119 min) → FADING (119–120 min, CSS transitions) → AMBER (120+ min)
 *
 * Reset on logout.
 */

const SESSION_MS      = 120 * 60 * 1000;  // 120 minutes
const FADE_START_MS   = SESSION_MS - 60_000; // begin CSS crossfade at 119 min
const CROSSFADE_MS    = 60_000;              // 60 seconds of imperceptible crossfade
const STORAGE_KEY     = "session_start_ts";

export const FATIGUE_STATES = {
  FRESH:  "fresh",
  FADING: "fading",
  AMBER:  "amber",
};

/** Read or create the session timestamp. Persists across tab refreshes. */
function getSessionStart() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const ts = parseInt(stored, 10);
      if (Number.isFinite(ts) && Date.now() - ts < SESSION_MS) {
        return ts;
      }
    }
  } catch { /* best-effort */ }
  const ts = Date.now();
  try { localStorage.setItem(STORAGE_KEY, String(ts)); } catch { /* best-effort */ }
  return ts;
}

function applyAmberVars(intensity) {
  // intensity: 0 = normal, 1 = full amber
  // Crossfade CSS variables — imperceptible over 60s
  const root = document.documentElement;
  const i = intensity;

  // Warm amber tint applied progressively
  root.style.setProperty("--fatigue-intensity", String(i));

  // Surface: shift from cold dark to warm dark
  root.style.setProperty("--fatigue-surface",          `${i}`);
  root.style.setProperty("--fatigue-text",              `${i}`);
  root.style.setProperty("--fatigue-border",            `${i}`);

  // Accent: blue → warm gold
  root.style.setProperty("--fatigue-accent-r", String(Math.round(59  + (255 - 59)  * i)));
  root.style.setProperty("--fatigue-accent-g", String(Math.round(130 + (180 - 130) * i)));
  root.style.setProperty("--fatigue-accent-b", String(Math.round(246 + ( 10 - 246)  * i)));
}

function clearAmberVars() {
  try {
    const root = document.documentElement;
    root.style.removeProperty("--fatigue-intensity");
    root.style.removeProperty("--fatigue-surface");
    root.style.removeProperty("--fatigue-text");
    root.style.removeProperty("--fatigue-border");
    root.style.removeProperty("--fatigue-accent-r");
    root.style.removeProperty("--fatigue-accent-g");
    root.style.removeProperty("--fatigue-accent-b");
    root.style.removeProperty("--fatigue-intensity");
  } catch { /* best-effort */ }
}

export function useSessionFatigue({ onFatigueChange } = {}) {
  const rafRef = { current: null };
  const startRef = { current: getSessionStart() };

  function tick() {
    const elapsed = Date.now() - startRef.current;
    let state;

    if (elapsed >= SESSION_MS) {
      state = FATIGUE_STATES.AMBER;
      applyAmberVars(1);
    } else if (elapsed >= FADE_START_MS) {
      const fadeElapsed = elapsed - FADE_START_MS;
      const intensity = Math.min(1, fadeElapsed / CROSSFADE_MS);
      state = FATIGUE_STATES.FADING;
      applyAmberVars(intensity);
    } else {
      state = FATIGUE_STATES.FRESH;
      if (elapsed < 1000) clearAmberVars(); // only clear on fresh start
    }

    onFatigueChange?.(state);
    rafRef.current = requestAnimationFrame(tick);
  }

  // rAF is started in useEffect to avoid SSR issues
  const start = () => {
    startRef.current = getSessionStart();
    rafRef.current = requestAnimationFrame(tick);
  };

  const stop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    clearAmberVars();
  };

  const reset = () => {
    stop();
    const ts = Date.now();
    try { localStorage.setItem(STORAGE_KEY, String(ts)); } catch { /* best-effort */ }
    startRef.current = ts;
    rafRef.current = requestAnimationFrame(tick);
  };

  return { start, stop, reset, FATIGUE_STATES };
}
