/**
 * Time-To-Interactive (TTI) Profiler - AI Watch Tower Module
 * 
 * Measures exactly when the DOM becomes usable.
 * Uses performance.timing.navigationStart and performance.now().
 */

const CHECK_INTERVAL = 100;
const MAX_WAIT = 30000;

export function setupTTITracker(setDebugTTI) {
  let cancelled = false;

  const measureTTI = () => {
    if (cancelled) return;

    const navigationStart = performance.timing?.navigationStart || 0;
    
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      const tti = performance.now() - navigationStart;
      setDebugTTI({
        value: Math.round(tti),
        timestamp: Date.now(),
        state: document.readyState
      });
      return;
    }

    const elapsed = performance.now() - navigationStart;
    if (elapsed > MAX_WAIT) {
      setDebugTTI({
        value: -1,
        timestamp: Date.now(),
        state: document.readyState,
        error: 'TTI measurement timeout'
      });
      return;
    }

    setTimeout(measureTTI, CHECK_INTERVAL);
  };

  measureTTI();

  return () => {
    cancelled = true;
  };
}

export function formatTTI(ms) {
  if (ms < 0) return 'Timeout';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function getTTIStatus(ms) {
  if (ms < 0) return 'timeout';
  if (ms < 1500) return 'excellent';
  if (ms < 3000) return 'good';
  if (ms < 5000) return 'fair';
  return 'slow';
}

export function getTTIColor(ms) {
  const status = getTTIStatus(ms);
  switch (status) {
    case 'excellent':
      return '#22C55E';
    case 'good':
      return '#84CC16';
    case 'fair':
      return '#F59E0B';
    case 'slow':
      return '#EF4444';
    case 'timeout':
    default:
      return '#6B7280';
  }
}
