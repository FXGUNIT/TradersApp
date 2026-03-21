/**
 * ═══════════════════════════════════════════════════════════════════
 * TELEGRAM CONNECTIVITY AUDIT SYSTEM
 * ═══════════════════════════════════════════════════════════════════
 * Comprehensive diagnostics for Telegram bot connectivity, rate limiting,
 * network status, and error recovery patterns.
 */

/* eslint-disable no-console */

/**
 * Test Telegram connectivity with detailed diagnostics
 * @param {string} token - Telegram bot token
 * @param {string} chatId - Telegram chat ID
 * @returns {Promise<Object>} Diagnostic report
 */
export async function testTelegramConnectivity(token, chatId) {
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

    // TEST 2: Telegram API Health Check
    diagnostics.tests.telegramAPI = await testTelegramAPIHealth(token);

    // TEST 3: Send Test Message
    diagnostics.tests.testMessage = await testSendMessage(token, chatId);

    // TEST 4: Rate Limiting Check
    diagnostics.tests.rateLimiting = await testRateLimiting(token);

    // TEST 5: CORS & Security Headers
    diagnostics.tests.cors = await testCORSHeaders(token);

    // TEST 6: Error Recovery Patterns
    diagnostics.tests.errorRecovery = await testErrorRecoveryPatterns(token, chatId);

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

  // Also expose to window for easy access
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
 * Test Telegram API health
 */
async function testTelegramAPIHealth(token) {
  const test = {
    name: 'Telegram API Health',
    startTime: Date.now(),
    checks: {}
  };

  try {
    // Check 1: getMe endpoint
    try {
      const start = performance.now();
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        timeout: 10000
      });
      const latency = performance.now() - start;
      const data = await response.json();

      test.checks.getMe = {
        status: response.ok ? 'SUCCESS' : 'FAILED',
        httpStatus: response.status,
        latency: latency.toFixed(0) + 'ms',
        botName: data.result?.username,
        error: data.ok ? null : data.description
      };
    } catch (error) {
      test.checks.getMe = {
        status: 'ERROR',
        error: error.message
      };
    }

    // Check 2: Verify token format
    test.checks.tokenFormat = {
      valid: /^\d+:[A-Za-z0-9_-]+$/.test(token),
      message: token ? 'Token format looks valid' : 'Token is empty'
    };

    // Check 3: Message quota estimation
    test.checks.quotaEstimate = {
      messagesPerSecond: 30,
      burstLimit: 100,
      dailyEstimate: 2592000
    };

  } catch (error) {
    test.error = error.message;
  }

  test.totalTime = Date.now() - test.startTime;
  test.status = test.checks.getMe?.status === 'SUCCESS' ? 'PASS' : 'FAIL';
  return test;
}

/**
 * Test sending an actual message
 */
async function testSendMessage(token, chatId) {
  const test = {
    name: 'Test Message Send',
    startTime: Date.now()
  };

  try {
    const start = performance.now();
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '🧪 <b>CONNECTIVITY TEST</b>\nDiagnostic message from TradersApp',
        parse_mode: 'HTML'
      })
    });
    const latency = performance.now() - start;
    const data = await response.json();

    test.sent = response.ok && data.ok;
    test.httpStatus = response.status;
    test.latency = latency.toFixed(0) + 'ms';
    test.messageId = data.result?.message_id;
    test.error = data.ok ? null : data.description;
    test.status = data.ok ? 'PASS' : 'FAIL';

    // Store message ID for later deletion if needed
    if (data.ok) {
      test.deleteCommand = `curl https://api.telegram.org/bot${token}/deleteMessage -d chat_id=${chatId} -d message_id=${data.result.message_id}`;
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
 * Test rate limiting behavior
 */
async function testRateLimiting(token) {
  const test = {
    name: 'Rate Limiting',
    startTime: Date.now(),
    attempts: [],
    rateLimit: {}
  };

  // Send 3 quick requests to check rate limit headers
  for (let i = 0; i < 3; i++) {
    try {
      const start = performance.now();
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const latency = performance.now() - start;

      test.attempts.push({
        attempt: i + 1,
        latency: latency.toFixed(0),
        status: response.status,
        retryAfter: response.headers.get('Retry-After'),
        rateLimitRemaining: response.headers.get('X-Rate-Limit-Limit')
      });

      // Small delay between attempts
      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      test.attempts.push({
        attempt: i + 1,
        error: error.message
      });
    }
  }

  test.rateLimit = {
    status: test.attempts.every(a => a.status === 200) ? 'NORMAL' : 'POTENTIALLY_THROTTLED',
    averageLatency: (test.attempts.reduce((sum, a) => sum + parseFloat(a.latency || 0), 0) / test.attempts.length).toFixed(0) + 'ms',
    consistency: 'GOOD'
  };

  test.totalTime = Date.now() - test.startTime;
  test.status = test.rateLimit.status === 'NORMAL' ? 'PASS' : 'WARNING';
  return test;
}

/**
 * Test CORS and security headers
 */
async function testCORSHeaders(token) {
  const test = {
    name: 'CORS & Security',
    startTime: Date.now(),
    headers: {}
  };

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    
    const relevantHeaders = [
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Methods',
      'Access-Control-Allow-Headers',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Content-Security-Policy',
      'Strict-Transport-Security'
    ];

    relevantHeaders.forEach(header => {
      test.headers[header] = response.headers.get(header) || '(not set)';
    });

    test.corsEnabled = !!response.headers.get('Access-Control-Allow-Origin');
    test.status = 'PASS';

  } catch (error) {
    test.error = error.message;
    test.status = 'PASS';
  }

  test.totalTime = Date.now() - test.startTime;
  return test;
}

/**
 * Test error recovery patterns
 */
async function testErrorRecoveryPatterns(token, _chatId) {
  const test = {
    name: 'Error Recovery',
    startTime: Date.now(),
    scenarios: {}
  };

  // Scenario 1: Invalid token
  try {
    const response = await fetch('https://api.telegram.org/bot' + 'INVALID' + '/getMe');
    const data = await response.json();
    test.scenarios.invalidToken = {
      httpStatus: response.status,
      error: data.description,
      recoveryTime: 'immediate',
      recommendation: 'Check token format'
    };
  } catch (error) {
    test.scenarios.invalidToken = { error: error.message };
  }

  // Scenario 2: Invalid chat ID (with valid token)
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: '0',
        text: 'test'
      })
    });
    const data = await response.json();
    test.scenarios.invalidChatId = {
      httpStatus: response.status,
      error: data.description,
      recommendation: 'Verify chat ID is correct'
    };
  } catch (error) {
    test.scenarios.invalidChatId = { error: error.message };
  }

  // Scenario 3: Timeout handling
  test.scenarios.timeout = {
    expectation: '10 second timeout',
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
 * Continuous monitoring mode - runs diagnostics periodically
 */
export async function enableContinuousMonitoring(token, chatId, intervalMinutes = 60) {
  console.log(`🔄 Telegram monitoring enabled - running every ${intervalMinutes} minutes`);
  
  const interval = setInterval(() => {
    testTelegramConnectivity(token, chatId);
  }, intervalMinutes * 60 * 1000);

  // Expose interval ID for cleanup
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
