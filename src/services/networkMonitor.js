/**
 * Network Latency Tracker - AI Watch Tower Module
 * 
 * Monitors all network requests (fetch API) for latency analysis.
 * Flags requests > 2000ms as critical bottlenecks.
 */

const MAX_LATENCIES = 99;
const SLOW_THRESHOLD = 2000;

let originalFetch = window.fetch;

export function setupNetworkMonitor(setDebugLatencies) {
  window.fetch = async (...args) => {
    const startTime = performance.now();
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || 'unknown';
    const endpoint = extractEndpoint(url);

    try {
      const response = await originalFetch(...args);
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      const latencyEntry = {
        endpoint,
        url,
        ms: latency,
        timestamp: Date.now(),
        status: response.status,
        isSlow: latency > SLOW_THRESHOLD
      };

      setDebugLatencies(prev => {
        const updated = [latencyEntry, ...prev];
        return updated.slice(0, MAX_LATENCIES);
      });

      return response;
    } catch (error) {
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      const latencyEntry = {
        endpoint,
        url,
        ms: latency,
        timestamp: Date.now(),
        status: 'error',
        isSlow: latency > SLOW_THRESHOLD,
        error: error.message
      };

      setDebugLatencies(prev => {
        const updated = [latencyEntry, ...prev];
        return updated.slice(0, MAX_LATENCIES);
      });

      throw error;
    }
  };

  return () => {
    window.fetch = originalFetch;
  };
}

function extractEndpoint(url) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;
    return path.length > 50 ? path.substring(0, 47) + '...' : path;
  } catch {
    return url.length > 50 ? url.substring(0, 47) + '...' : url;
  }
}

export function formatLatencyTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function getLatencyColor(ms) {
  if (ms > SLOW_THRESHOLD) return '#EF4444';
  if (ms > 1000) return '#F59E0B';
  return '#22C55E';
}

export function getLatencyStatus(ms) {
  if (ms > SLOW_THRESHOLD) return 'CRITICAL';
  if (ms > 1000) return 'Slow';
  return 'OK';
}
