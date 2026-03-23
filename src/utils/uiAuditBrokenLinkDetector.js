/**
 * ═══════════════════════════════════════════════════════════════════
 * STEP 2: UI INTEGRITY AUDIT - BROKEN LINK DETECTOR
 * ═══════════════════════════════════════════════════════════════════
 * Detects 404 errors, component loading failures, and broken links
 * Triggers Red Toast alerts and sends detailed logs to Telegram
 * 
 * Usage:
 *   import { initBrokenLinkDetector, getBrokenLinkReport } from './uiAuditBrokenLinkDetector.js';
 *   
 *   // In App.jsx:
 *   useEffect(() => {
 *     initBrokenLinkDetector({ 
 *       telegramToken: TELEGRAM_TOKEN,
 *       telegramChatId: TELEGRAM_CHAT_ID,
 *       onError: showToast
 *     });
 *   }, []);
 */

import { performance } from 'perf_hooks';

const DETECTOR_CONFIG = {
  telegramToken: null,
  telegramChatId: null,
  onError: null,                    // Toast callback
  checkInterval: 5000,              // Check for broken links every 5s
  timeout: 10000,                   // Network request timeout
  retryAttempts: 3,
  excludeHeartbeats: true,          // Skip healthcheck endpoints
  monitorConsoleErrors: true,       // Catch JS errors
  captureNetworkErrors: true,       // Monitor fetch/XMLHttpRequest
  logToConsole: true,
};

let detectorState = {
  isInitialized: false,
  brokenLinks: new Map(),
  networkErrors: [],
  componentErrors: [],
  consoleErrors: [],
  failedRequests: new Map(),
  interceptors: [],
  lastTelegramAlert: 0,
  telegramAlertCooldown: 10000,    // Don't spam - min 10s between alerts
};

/**
 * Send alert to Telegram
 */
async function sendTelegramAlert(title, message, severity = 'ERROR') {
  if (!DETECTOR_CONFIG.telegramToken || !DETECTOR_CONFIG.telegramChatId) {
    console.warn('Telegram not configured for UI Audit alerts');
    return;
  }
  
  // Respect cooldown to avoid spam
  const now = Date.now();
  if (now - detectorState.lastTelegramAlert < detectorState.telegramAlertCooldown) {
    console.log('⏳ Telegram alert cooldown active, queueing...');
    return;
  }
  
  detectorState.lastTelegramAlert = now;
  
  const severityEmoji = {
    'ERROR': '🔴',
    'WARNING': '🟡',
    'INFO': '🔵',
    'CRITICAL': '⚠️',
  }[severity] || '❓';
  
  const telegramMessage = `${severityEmoji} **UI INTEGRITY ALERT**
  
**Title:** ${title}
**Severity:** ${severity}
**Timestamp:** ${new Date().toLocaleString()}

**Details:**
\`\`\`
${message}
\`\`\`

**Device:** ${navigator.userAgent.slice(0, 80)}
**Page:** ${window.location.href}
  `;
  
  try {
    const url = `https://api.telegram.org/bot${DETECTOR_CONFIG.telegramToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: DETECTOR_CONFIG.telegramChatId,
        text: telegramMessage,
        parse_mode: 'Markdown',
      }),
      timeout: 5000,
    });
    
    if (!response.ok) {
      console.error('Failed to send Telegram alert:', response.status);
    } else {
      console.log('✅ Telegram alert sent successfully');
    }
  } catch (error) {
    console.error('Telegram alert failed:', error.message);
  }
}

/**
 * Intercept fetch requests to detect broken links
 */
function interceptFetch() {
  const originalFetch = window.fetch;
  
  window.fetch = async (...args) => {
    const url = args[0];
    const startTime = performance.now();
    
    try {
      const response = await originalFetch(...args);
      const endTime = performance.now();
      
      // Track 404s and 5xx errors
      if (response.status === 404) {
        const error = {
          url: url.toString(),
          status: 404,
          statusText: response.statusText,
          timestamp: new Date().toISOString(),
          loadTime: (endTime - startTime).toFixed(0) + 'ms',
          severity: 'CRITICAL',
        };
        
        detectorState.brokenLinks.set(url, error);
        
        console.error(`🔴 404 Not Found: ${url}`);
        
        if (DETECTOR_CONFIG.onError) {
          DETECTOR_CONFIG.onError(`404 Broken Link: ${url}`, 'error');
        }
        
        await sendTelegramAlert(
          '404 Broken Link Detected',
          `URL: ${url}\nStatus: ${response.status} ${response.statusText}\nLoad Time: ${endTime - startTime}ms`,
          'ERROR'
        );
      }
      
      if (response.status >= 500) {
        const error = {
          url: url.toString(),
          status: response.status,
          statusText: response.statusText,
          timestamp: new Date().toISOString(),
          loadTime: (endTime - startTime).toFixed(0) + 'ms',
          severity: 'CRITICAL',
        };
        
        detectorState.failedRequests.set(url, error);
        
        console.error(`🔴 Server Error: ${response.status} ${url}`);
        
        if (DETECTOR_CONFIG.onError) {
          DETECTOR_CONFIG.onError(`Server Error ${response.status}: ${url}`, 'error');
        }
        
        await sendTelegramAlert(
          `Server Error ${response.status}`,
          `URL: ${url}\nStatus: ${response.status} ${response.statusText}\nLoad Time: ${endTime - startTime}ms`,
          'CRITICAL'
        );
      }
      
      return response;
    } catch (error) {
      const endTime = performance.now();
      
      const networkError = {
        url: url.toString(),
        error: error.message,
        type: 'NETWORK_ERROR',
        timestamp: new Date().toISOString(),
        loadTime: (endTime - startTime).toFixed(0) + 'ms',
        severity: 'HIGH',
      };
      
      detectorState.networkErrors.push(networkError);
      
      console.error(`🔴 Network Error: ${error.message} (${url})`);
      
      if (DETECTOR_CONFIG.onError) {
        DETECTOR_CONFIG.onError(`Network Error: ${error.message}`, 'error');
      }
      
      await sendTelegramAlert(
        'Network Request Failed',
        `URL: ${url}\nError: ${error.message}\nLoad Time: ${endTime - startTime}ms`,
        'HIGH'
      );
      
      throw error;
    }
  };
  
  detectorState.interceptors.push({ type: 'fetch', original: originalFetch });
}

/**
 * Intercept XMLHttpRequest to detect broken links
 */
function interceptXHR() {
  const OriginalXHR = window.XMLHttpRequest;
  const originalOpen = OriginalXHR.prototype.open;
  const originalSend = OriginalXHR.prototype.send;
  
  OriginalXHR.prototype.open = function(method, url, ...rest) {
    this._auditUrl = url;
    this._auditStartTime = performance.now();
    return originalOpen.apply(this, [method, url, ...rest]);
  };
  
  OriginalXHR.prototype.send = function(...args) {
    const originalOnReadyStateChange = this.onreadystatechange;
    
    this.onreadystatechange = function() {
      if (this.readyState === 4) {
        const endTime = performance.now();
        const loadTime = (endTime - this._auditStartTime).toFixed(0);
        
        if (this.status === 404) {
          const error = {
            url: this._auditUrl,
            status: 404,
            statusText: this.statusText,
            timestamp: new Date().toISOString(),
            loadTime: loadTime + 'ms',
            method: 'XHR',
            severity: 'CRITICAL',
          };
          
          detectorState.brokenLinks.set(this._auditUrl, error);
          
          console.error(`🔴 XHR 404: ${this._auditUrl}`);
          
          if (DETECTOR_CONFIG.onError) {
            DETECTOR_CONFIG.onError(`404 XHR: ${this._auditUrl}`, 'error');
          }
          
          sendTelegramAlert(
            'XHR 404 Broken Link',
            `URL: ${this._auditUrl}\nStatus: 404\nLoad Time: ${loadTime}ms`,
            'ERROR'
          );
        }
        
        if (this.status >= 500) {
          detectorState.failedRequests.set(this._auditUrl, {
            url: this._auditUrl,
            status: this.status,
            timestamp: new Date().toISOString(),
            loadTime: loadTime + 'ms',
            method: 'XHR',
          });
        }
      }
      
      if (originalOnReadyStateChange) {
        originalOnReadyStateChange.call(this);
      }
    };
    
    return originalSend.apply(this, args);
  };
  
  detectorState.interceptors.push({ 
    type: 'xhr', 
    original: OriginalXHR,
    originalOpen,
    originalSend
  });
}

/**
 * Intercept console errors
 */
function interceptConsoleErrors() {
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.error = function(...args) {
    const errorMessage = args.map(a => 
      typeof a === 'string' ? a : JSON.stringify(a)
    ).join(' ');
    
    // Detect 404 and component errors in error messages
    if (errorMessage.includes('404') || 
        errorMessage.includes('Component Failed') || 
        errorMessage.includes('Cannot find') ||
        errorMessage.includes('undefined')) {
      
      const componentError = {
        message: errorMessage,
        type: 'COMPONENT_ERROR',
        timestamp: new Date().toISOString(),
        severity: errorMessage.includes('404') ? 'CRITICAL' : 'HIGH',
      };
      
      detectorState.componentErrors.push(componentError);
      
      console.log('🔴 Component Error Detected:', errorMessage);
      
      if (DETECTOR_CONFIG.onError) {
        DETECTOR_CONFIG.onError(`Component Error: ${errorMessage.slice(0, 80)}`, 'error');
      }
      
      sendTelegramAlert(
        'Component Loading Failed',
        `Error: ${errorMessage}\nURL: ${window.location.href}`,
        'HIGH'
      );
    }
    
    detectorState.consoleErrors.push({
      message: errorMessage,
      timestamp: new Date().toISOString(),
    });
    
    return originalError.apply(console, args);
  };
  
  console.warn = function(...args) {
    const warnMessage = args.map(a => 
      typeof a === 'string' ? a : JSON.stringify(a)
    ).join(' ');
    
    if (warnMessage.includes('404') || warnMessage.includes('not found')) {
      detectorState.consoleErrors.push({
        message: warnMessage,
        type: 'WARNING',
        timestamp: new Date().toISOString(),
      });
    }
    
    return originalWarn.apply(console, args);
  };
  
  detectorState.interceptors.push({ 
    type: 'console',
    originalError,
    originalWarn
  });
}

/**
 * Detect broken links in DOM
 */
function detectBrokenLinksInDOM() {
  const allLinks = document.querySelectorAll('a[href], img[src], script[src], link[href]');
  const brokenFound = [];
  
  allLinks.forEach(el => {
    let url = el.href || el.src;
    if (!url || url.startsWith('javascript:') || url === '#') return;
    
    // Check if URL is already marked as broken
    if (detectorState.brokenLinks.has(url)) {
      brokenFound.push(url);
    }
  });
  
  return brokenFound;
}

/**
 * Initialize broken link detector
 */
export function initBrokenLinkDetector(config = {}) {
  Object.assign(DETECTOR_CONFIG, config);
  
  if (detectorState.isInitialized) {
    console.warn('Broken Link Detector already initialized');
    return;
  }
  
  console.log('🔍 Initializing Broken Link Detector...');
  console.log('═'.repeat(60));
  
  // Set up interceptors
  if (DETECTOR_CONFIG.captureNetworkErrors) {
    interceptFetch();
    interceptXHR();
    console.log('✅ Network interceptors active (fetch + XHR)');
  }
  
  if (DETECTOR_CONFIG.monitorConsoleErrors) {
    interceptConsoleErrors();
    console.log('✅ Console error monitoring active');
  }
  
  // Periodic DOM check
  setInterval(() => {
    const broken = detectBrokenLinksInDOM();
    if (broken.length > 0 && DETECTOR_CONFIG.logToConsole) {
      console.warn(`⚠️ Found ${broken.length} broken links in DOM`);
    }
  }, DETECTOR_CONFIG.checkInterval);
  
  detectorState.isInitialized = true;
  console.log('✅ Broken Link Detector initialized');
}

/**
 * Get broken link report
 */
export function getBrokenLinkReport() {
  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalBrokenLinks: detectorState.brokenLinks.size,
      totalNetworkErrors: detectorState.networkErrors.length,
      totalComponentErrors: detectorState.componentErrors.length,
      totalConsoleErrors: detectorState.consoleErrors.length,
      criticalIssues: [
        ...Array.from(detectorState.brokenLinks.values()).filter(b => b.status === 404).length,
        ...detectorState.failedRequests.size,
      ].length,
    },
    brokenLinks: Array.from(detectorState.brokenLinks.values()),
    networkErrors: detectorState.networkErrors,
    componentErrors: detectorState.componentErrors,
    failedRequests: Array.from(detectorState.failedRequests.values()),
    mostRecentConsoleErrors: detectorState.consoleErrors.slice(-10),
  };
}

/**
 * Clear detected errors
 */
export function clearBrokenLinkReport() {
  detectorState.brokenLinks.clear();
  detectorState.networkErrors = [];
  detectorState.componentErrors = [];
  detectorState.consoleErrors = [];
  detectorState.failedRequests.clear();
}

/**
 * Export broken link report
 */
export function exportBrokenLinkReport(filename = 'ui-audit-broken-links.json') {
  const report = getBrokenLinkReport();
  const dataStr = JSON.stringify(report, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Listen to broken link detector
 */
export function onBrokenLinkDetected(callback) {
  return callback(getBrokenLinkReport());
}
