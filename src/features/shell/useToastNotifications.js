import { useCallback, useState } from "react";

function playNotificationSound(type = "success") {
  try {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const audioContext = new AudioContextCtor();
    const now = audioContext.currentTime;

    if (type === "success" || type === "info") {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.3);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.1, now + 0.5);

      osc.start(now);
      osc.stop(now + 0.5);
      return;
    }

    if (type === "error" || type === "warning") {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.4);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.4);

      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch {
    // Audio notifications are best-effort only.
  }
}

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
    playNotificationSound(type);

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
  };
}

export default useToastNotifications;
