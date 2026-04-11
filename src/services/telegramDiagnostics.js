/**
 * ═══════════════════════════════════════════════════════════════════
 * TELEGRAM CONNECTIVITY AUDIT SYSTEM
 * ═══════════════════════════════════════════════════════════════════
 *
 * J01 (Phase 11): All Telegram sends now route through BFF at
 * /telegram/send-message. Tokens no longer exist in browser bundles.
 * Diagnostic sends use the BFF proxy, with graceful degradation
 * when BFF is unavailable.
 */

/* eslint-disable no-console */

import { bffFetch } from './gateways/base.js';

/**
 * Test Telegram connectivity with detailed diagnostics
 * @returns {Promise<Object>} Diagnostic report
 */
export async function testTelegramConnectivity() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    systemInfo: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      online: navigator.onLine,
      memory: navigator.deviceMemory || 'unknown',
      cores: navigator.hardwareConcurrency || 'unknown',
    },
    network: {
      effectiveType: navigator.connection?.effectiveType || 'unknown',
      downlink: navigator.connection?.downlink || 'unknown',
      rtt: navigator.connection?.rtt || 'unknown',
      saveData: navigator.connection?.saveData || false,
    },
    tests: {},
    summary: {}
  };

  try {
    // TEST 1: DNS Resolution & Connectivity
    diagnostics.tests.connectivity = await testBasicConnectivity();

    // TEST 2: BFF Proxy Reachability (J01 — replaces direct Telegram API check)
    diagnostics.tests.bffProxy = await testBffProxy();

    // TEST 3: Send Test Message via BFF
    diagnostics.tests.testMessage = await testSendMessageViaBff();

    // TEST 4: Network conditions
    diagnostics.tests.networkConditions = await testNetworkConditions();

    // Generate summary
    diagnostics.summary = generateSummary(diagnostics.tests);

  } catch (error) {
    diagnostics.error = error.message;
    diagnostics.summary.status = 'CRITICAL_FAILURE';
  }

  // Log results
  console.group('🔍 TELEGRAM CONNECTIVITY AUDIT');
  console.log('Timestamp:', diagnostics.timestamp);
  console.log('System:', diagnostics.systemInfo);
  console.log('Network:', diagnostics.network);
  console.table(diagnostics.tests);
  console.log('Summary:', diagnostics.summary);
  console.groupEnd();

  // Expose to window for easy access
  window.__TelegramDiagnostics = diagnostics;

  return diagnostics;
}

/**
 * Test basic connectivity to external services
 */
async function testBasicConnectivity() {
  const test = {
    name: 'Basic Connectivity',
    startTime: Date.now(),
    endpoints: {}
  };

  const endpoints = [
    { name: 'api.telegram.org', url: 'https://api.telegram.org/botDummy/getMe' },
    { name: 'Google DNS', url: 'https://dns.google/resolve?name=api.telegram.org' },
    { name: 'Cloudflare DNS', url: 'https://cloudflare-dns.com/dns-query?name=api.telegram.org' }
  ];

  for (const endpoint of endpoints) {
    try {
      const start = performance.now();
      const response = await Promise.race([
        fetch(endpoint.url, { method: 'HEAD', mode: 'no-cors' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      const latency = performance.now() - start;

      test.endpoints[endpoint.name] = {
        accessible: response.ok || response.status === 0,
        latency: latency.toFixed(0) + 'ms',
        status: response.status || 'no-cors'
      };
    } catch (error) {
      test.endpoints[endpoint.name] = {
        accessible: false,
        error: error.message,
        latency: '∞'
      };
    }
  }

  test.totalTime = Date.now() - test.startTime;
  test.status = Object.values(test.endpoints).some(e => e.accessible) ? 'PASS' : 'FAIL';
  return test;
}

/**
 * Test BFF proxy reachability (J01 — replaces direct Telegram API health check)
 */
async function testBffProxy() {
  const test = {
    name: 'BFF Telegram Proxy',
    startTime: Date.now(),
    checks: {}
  };

  try {
    // Check 1: BFF /health endpoint
    try {
      const start = performance.now();
      const response = await fetch('/api/health', {
        headers: { 'Accept': 'application/json' }
      });
      const latency = performance.now() - start;
      let healthData = {};
      try { healthData = await response.json(); } catch { /* ignore parse errors */ }

      test.checks.health = {
        status: response.ok ? 'SUCCESS' : 'FAILED',
        httpStatus: response.status,
        latency: latency.toFixed(0) + 'ms',
        telegramConfigured: healthData?.telegramConfigured ?? false,
      };
    } catch (error) {
      test.checks.health = {
        status: 'ERROR',
        error: error.message,
      };
    }

    // Check 2: BFF /live endpoint
    try {
      const start = performance.now();
      const response = await fetch('/api/live');
      const latency = performance.now() - start;
      test.checks.live = {
        status: response.ok ? 'SUCCESS' : 'FAILED',
        httpStatus: response.status,
        latency: latency.toFixed(0) + 'ms',
      };
    } catch (error) {
      test.checks.live = {
        status: 'ERROR',
        error: error.message,
      };
    }

  } catch (error) {
    test.error = error.message;
  }

  test.totalTime = Date.now() - test.startTime;
  test.status = test.checks.health?.status === 'SUCCESS' ? 'PASS' : 'FAIL';
  return test;
}

/**
 * Test sending a message via BFF proxy (J01)
 */
async function testSendMessageViaBff() {
  const test = {
    name: 'Test Message via BFF',
    startTime: Date.now()
  };

  try {
    const start = performance.now();
    const result = await bffFetch('/telegram/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '🧪 <b>CONNECTIVITY TEST</b>\nDiagnostic message from TradersApp',
        parse_mode: 'HTML',
      }),
    });
    const latency = performance.now() - start;

    if (result === null) {
      test.sent = false;
      test.error = 'BFF unavailable';
      test.latency = latency.toFixed(0) + 'ms';
      test.status = 'ERROR';
    } else if (!result.ok) {
      test.sent = false;
      test.error = result.error || 'Unknown error';
      test.latency = latency.toFixed(0) + 'ms';
      test.status = 'FAIL';
    } else {
      test.sent = true;
      test.messageId = result.message_id;
      test.latency = latency.toFixed(0) + 'ms';
      test.status = 'PASS';
    }

  } catch (error) {
    test.sent = false;
    test.error = error.message;
    test.status = 'ERROR';
  }

  test.totalTime = Date.now() - test.startTime;
  return test;
}

/**
 * Test network conditions
 */
async function testNetworkConditions() {
  const test = {
    name: 'Network Conditions',
    startTime: Date.now(),
    scenarios: {}
  };

  // Scenario 1: CORS preflight for BFF
  try {
    const start = performance.now();
    const response = await fetch('/api/health', {
      method: 'OPTIONS',
      headers: { 'Access-Control-Request-Method': 'POST' }
    });
    const latency = performance.now() - start;
    test.scenarios.bffCors = {
      httpStatus: response.status,
      latency: latency.toFixed(0) + 'ms',
      recommendation: response.ok ? 'CORS preflight OK' : 'Check CORS configuration',
    };
  } catch (error) {
    test.scenarios.bffCors = { error: error.message };
  }

  // Scenario 2: Timeout handling expectation
  test.scenarios.timeout = {
    expectation: '5 second timeout for BFF calls',
    recommendation: 'Implement retry with exponential backoff',
    maxRetries: 3
  };

  test.totalTime = Date.now() - test.startTime;
  test.status = 'PASS';
  return test;
}

/**
 * Generate diagnostic summary
 */
function generateSummary(tests) {
  const summary = {
    totalTests: Object.keys(tests).length,
    passedTests: Object.values(tests).filter(t => t.status === 'PASS').length,
    failedTests: Object.values(tests).filter(t => t.status === 'FAIL').length,
    warnings: Object.values(tests).filter(t => t.status === 'WARNING').length,
    timestamp: new Date().toISOString()
  };

  // Determine overall status
  if (summary.failedTests > 0) {
    summary.status = 'FAILED - Critical issues detected';
  } else if (summary.warnings > 0) {
    summary.status = 'WARNING - Check issues recommended';
  } else if (summary.passedTests === summary.totalTests) {
    summary.status = 'ALL_SYSTEMS_OPERATIONAL';
  } else {
    summary.status = 'UNKNOWN_STATUS';
  }

  return summary;
}

/**
 * Continuous monitoring mode — runs diagnostics periodically via BFF
 */
export async function enableContinuousMonitoring(intervalMinutes = 60) {
  console.log(`🔄 Telegram monitoring enabled — running every ${intervalMinutes} minutes via BFF proxy`);

  const interval = setInterval(() => {
    testTelegramConnectivity();
  }, intervalMinutes * 60 * 1000);

  window.__TelegramMonitoringInterval = interval;

  return {
    stop: () => {
      clearInterval(interval);
      console.log('⏹️ Telegram monitoring stopped');
    }
  };
}

/**
 * Generate HTML report for UI display
 */
export function formatDiagnosticsReport(diagnostics) {
  let html = `
    <div style="background: rgba(0,0,0,0.8); color: #fff; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 12px; line-height: 1.6;">
      <h3 style="color: #00ff00; margin-top: 0;">📊 TELEGRAM AUDIT REPORT</h3>
      <p>Timestamp: ${diagnostics.timestamp}</p>
      <h4 style="color: #ff9900;">System Info</h4>
      <ul>
        <li>Online: ${diagnostics.systemInfo.online ? '✓' : '✗'}</li>
        <li>Timezone: ${diagnostics.systemInfo.timezone}</li>
        <li>Network Type: ${diagnostics.network.effectiveType}</li>
      </ul>
      <h4 style="color: #ff9900;">Test Results</h4>
  `;

  Object.entries(diagnostics.tests).forEach(([_key, test]) => {
    const statusColor = test.status === 'PASS' ? '#00ff00' : test.status === 'FAIL' ? '#ff0000' : '#ffff00';
    html += `<p style="color: ${statusColor};">✦ ${test.name}: ${test.status}</p>`;
  });

  html += `
      <h4 style="color: #ff9900;">Summary</h4>
      <p style="color: ${diagnostics.summary.status === 'ALL_SYSTEMS_OPERATIONAL' ? '#00ff00' : '#ffff00'};">
        Status: ${diagnostics.summary.status}
      </p>
      <p>Passed: ${diagnostics.summary.passedTests}/${diagnostics.summary.totalTests}</p>
    </div>
  `;

  return html;
}
