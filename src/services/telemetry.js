/**
 * Console Interceptor - AI Watch Tower Module
 * 
 * Captures browser console logs, warnings, and errors for debugging
 * without needing DevTools open.
 * 
 * Limits array to 99 entries to prevent memory leaks.
 * Restores original console functions on cleanup.
 */

const MAX_LOGS = 99;

let originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error
};

export function setupConsoleInterceptor(setDebugLogs) {
  const interceptor = (type) => (...args) => {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    setDebugLogs(prev => {
      const newLog = {
        type,
        message,
        timestamp: Date.now()
      };
      const updated = [newLog, ...prev];
      return updated.slice(0, MAX_LOGS);
    });

    originalConsole[type](...args);
  };

  console.log = interceptor('log');
  console.warn = interceptor('warn');
  console.error = interceptor('error');

  return () => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  };
}

export function formatLogTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
}

export function getLogTypeColor(type) {
  switch (type) {
    case 'error':
      return '#EF4444';
    case 'warn':
      return '#F59E0B';
    case 'log':
    default:
      return '#9CA3AF';
  }
}
