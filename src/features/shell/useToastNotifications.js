import { useCallback, useState } from "react";

// ─── Audio singleton (created lazily on first sound) ─────────────────────────────────
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) _audioCtx = new Ctor();
  }
  return _audioCtx;
}

// ─── Luxury tone definitions ──────────────────────────────────────────────────────
// All synthesised via Web Audio API — no external files.
//
// | type           | freq     | character                    |
// |----------------|----------|------------------------------|
// | "success"      | 432 Hz   | Soft ascending sine (trade clear)|
// | "error"       | 100 Hz   | Muted low thud (dead zone)    |
// | "warning"      | 220 Hz   | Mid descending (throttle)    |
// | "info"        | 660 Hz   | Gentle high ping              |
// | "circuit"     | 150 Hz   | Double thud (circuit break)  |

function playTone({ frequency, duration = 0.4, type = "sine", volume = 0.28, rampFreq = null }) {
  if (mutedRef.current) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (rampFreq) osc.frequency.exponentialRampToValueAtTime(rampFreq, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // Audio is best-effort only.
  }
}

// ─── Shared mute state (module-level, survives re-renders) ────────────────────────
const mutedRef = { current: false };

export function setAudioMuted(val) {
  mutedRef.current = val;
}
export function isAudioMuted() {
  return mutedRef.current;
}

// ─── Hook ───────────────────────────────────────────────────────────────────────
export function useToastNotifications() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "info", duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const createdAt = Date.now();
    const nextToast = {
      id,
      message,
      type,
      duration,
      time_remaining: duration,
      createdAt,
    };

    setToasts((prev) => [...prev, nextToast]);

    // ── Play luxury tone (respects system volume, no external files) ──────────────
    if (!mutedRef.current) {
      if (type === "success") {
        // Trade Clear — soft 432 Hz ascending sine
        playTone({ frequency: 432, duration: 0.5, volume: 0.22 });
      } else if (type === "error") {
        // Dead Zone — muted 100 Hz thud
        playTone({ frequency: 100, duration: 0.55, type: "sine", volume: 0.18 });
      } else if (type === "warning") {
        // Throttle — mid 220 Hz descending
        playTone({ frequency: 220, rampFreq: 180, duration: 0.35, volume: 0.18 });
      } else if (type === "info") {
        // Gentle high ping — 660 Hz soft sine
        playTone({ frequency: 660, duration: 0.3, volume: 0.14 });
      } else if (type === "circuit") {
        // Circuit breaker — double low thud
        playTone({ frequency: 150, duration: 0.25, volume: 0.2 });
        setTimeout(() => playTone({ frequency: 120, duration: 0.3, volume: 0.18 }), 280);
      }
    }

    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - createdAt;
      const remaining = Math.max(0, duration - elapsed);
      setToasts((prev) =>
        prev.map((toast) =>
          toast.id === id ? { ...toast, time_remaining: remaining } : toast,
        ),
      );
    }, 50);

    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, duration);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };
  }, []);

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
  }, []);

  return {
    toasts,
    showToast,
    dismissToast,
    mutedRef,
    setAudioMuted,
  };
}

export default useToastNotifications;
