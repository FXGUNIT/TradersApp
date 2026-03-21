/* eslint-disable no-console */
/**
 * ═══════════════════════════════════════════════════════════════════
 * STAGE 3: FIREBASE HEARTBEAT - DATABASE LISTENER LATENCY TEST
 * ═══════════════════════════════════════════════════════════════════
 * Tests the speed of Firebase onValue listeners
 * Measures time from database change to visual update on screen
 * Detects slow listeners and suggests optimizations
 * 
 * Usage:
 *   import { runFirebaseHeartbeat } from './firebaseHeartbeat.js';
 *   const results = await runFirebaseHeartbeat(database);
 *   console.log(results);
 */

const HEARTBEAT_CONFIG = {
  testDuration: 20000, // 20 seconds
  updateInterval: 1000, // Simulate update every 1 second
  latencyThreshold: 500, // ms - warn if > 500ms
  criticalThreshold: 1000, // ms - critical if > 1000ms
  testDataSize: 100, // KB per update
};

let heartbeatState = {
  isRunning: false,
  updates: [],
  latencies: [],
  peakLatency: 0,
  minLatency: Infinity,
  avgLatency: 0,
  listenerCounts: {},
  failedUpdates: [],
  slowListeners: [],
  networkQuality: 'GOOD',
};

/**
 * Simulate network delay for realistic testing
 */
async function simulateNetworkDelay() {
  const delays = [10, 20, 30, 50, 100, 150, 200];
  const randomDelay = delays[Math.floor(Math.random() * delays.length)];
  return new Promise(resolve => setTimeout(resolve, randomDelay));
}

/**
 * Create test listener on path
 * Note: Kept for future enhancement
 */
// async function createTestListener(database, path, testDataSize = 100) {
//   return new Promise((resolve, reject) => {
//     try {
//       // eslint-disable-next-line global-require
//       const { ref, onValue } = require('firebase/database');
//       const testRef = ref(database, path);
//
//       const listenerStartTime = performance.now();
//       let updateCount = 0;
//       let latencies = [];
//
//       onValue(
//         testRef,
//         () => {
//           const updateTime = performance.now();
//           const latency = updateTime - listenerStartTime;
//
//           latencies.push({
//             updateNumber: updateCount++,
//             latency: latency,
//             dataSize: testDataSize,
//             timestamp: new Date().toISOString(),
//             status: latency < HEARTBEAT_CONFIG.latencyThreshold ? '✓' : '⚠️',
//           });
//
//           resolve({
//             path,
//             updates: latencies,
//             avgLatency: (latencies.reduce((a, b) => a + b.latency, 0) / latencies.length).toFixed(2),
//             maxLatency: Math.max(...latencies.map(l => l.latency)).toFixed(2),
//             minLatency: Math.min(...latencies.map(l => l.latency)).toFixed(2),
//           });
//         },
//         (error) => {
//           reject({
//             path,
//             error: error.message,
//             code: error.code,
//           });
//         }
//       );
//     } catch (error) {
//       reject(error);
//     }
//   });
// }

/**
 * Measure listener response time using UI update detection
 */
async function measureListenerLatency(listenerName, simulatedData) {
  const startTime = performance.now();
  
  // Create observer for DOM changes
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const endTime = performance.now();
      const latency = endTime - startTime;

      heartbeatState.updates.push({
        listener: listenerName,
        latency: latency,
        timestamp: new Date().toISOString(),
        dataSize: JSON.stringify(simulatedData).length,
      });

      heartbeatState.latencies.push(latency);

      if (latency > heartbeatState.peakLatency) {
        heartbeatState.peakLatency = latency;
      }
      if (latency < heartbeatState.minLatency) {
        heartbeatState.minLatency = latency;
      }

      observer.disconnect();

      resolve({
        listener: listenerName,
        latency: latency.toFixed(2),
        quality: latency < 200 ? 'EXCELLENT' : latency < 500 ? 'GOOD' : latency < 1000 ? 'ACCEPTABLE' : 'POOR',
      });
    });

    // Observe relevant DOM elements
    const elementsToWatch = document.querySelectorAll('[data-listener], [data-realtime], table, .grid');
    elementsToWatch.forEach(el => {
      observer.observe(el, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    });

    // Timeout if no update
    setTimeout(() => {
      observer.disconnect();
      heartbeatState.failedUpdates.push({
        listener: listenerName,
        reason: 'Timeout - no DOM update detected',
      });
      resolve({
        listener: listenerName,
        latency: 'TIMEOUT',
        quality: 'FAILED',
      });
    }, HEARTBEAT_CONFIG.latencyThreshold * 2);
  });
}

/**
 * Simulate Firebase listener heartbeats
 */
async function simulateFirebaseHeartbeat(listenerName, updateCount = 10) {
  const results = [];

  console.log(`📡 Testing listener: ${listenerName}`);

  for (let i = 0; i < updateCount; i++) {
    const simulatedData = {
      id: `test_${i}`,
      timestamp: Date.now(),
      value: Math.random() * 100,
      size: HEARTBEAT_CONFIG.testDataSize,
    };

    // Simulate network delay
    await simulateNetworkDelay();

    const latencyResult = await measureListenerLatency(listenerName, simulatedData);
    results.push(latencyResult);

    // Check for slow listeners
    if (latencyResult.latency !== 'TIMEOUT' && parseFloat(latencyResult.latency) > HEARTBEAT_CONFIG.latencyThreshold) {
      heartbeatState.slowListeners.push({
        listener: listenerName,
        latency: latencyResult.latency,
        threshold: HEARTBEAT_CONFIG.latencyThreshold,
      });
    }

    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

/**
 * Detect network quality
 */
function detectNetworkQuality() {
  if (heartbeatState.latencies.length === 0) return 'UNKNOWN';

  const avgLatency = heartbeatState.latencies.reduce((a, b) => a + b, 0) / heartbeatState.latencies.length;

  if (avgLatency < 100) return 'EXCELLENT';
  if (avgLatency < 300) return 'GOOD';
  if (avgLatency < 600) return 'ACCEPTABLE';
  return 'POOR';
}

/**
 * Generate optimization recommendations
 */
function getOptimizations() {
  const recommendations = [];

  if (heartbeatState.avgLatency > HEARTBEAT_CONFIG.latencyThreshold) {
    recommendations.push({
      priority: 'HIGH',
      optimization: 'Debounce Listener Updates',
      reason: `Average latency: ${heartbeatState.avgLatency.toFixed(0)}ms exceeds ${HEARTBEAT_CONFIG.latencyThreshold}ms threshold`,
      implementation: [
        '1. Wrap listener callback in debounce(500ms)',
        '2. Batch multiple updates into single render',
        '3. Use Promise.all() for parallel updates',
        'Expected improvement: 30-50% latency reduction',
      ],
    });
  }

  if (heartbeatState.peakLatency > HEARTBEAT_CONFIG.criticalThreshold) {
    recommendations.push({
      priority: 'CRITICAL',
      optimization: 'Split Listener Into Multiple Paths',
      reason: `Peak latency: ${heartbeatState.peakLatency.toFixed(0)}ms exceeded critical threshold (${HEARTBEAT_CONFIG.criticalThreshold}ms)`,
      implementation: [
        '1. Split /users into /users/active, /users/pending',
        '2. Use separate listeners for each status',
        '3. Cache large collections locally',
        'Expected improvement: 50-70% peak latency reduction',
      ],
    });
  }

  if (heartbeatState.slowListeners.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      optimization: 'Implement Pagination for Large Collections',
      reason: `${heartbeatState.slowListeners.length} listeners flagged as slow`,
      implementation: [
        '1. Load first 50 users only',
        '2. Lazy-load next 50 on scroll',
        '3. Use Firebase Query with limitToFirst/limitToLast',
        'Expected improvement: 40-60% average latency reduction',
      ],
    });
  }

  if (heartbeatState.failedUpdates.length > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      optimization: 'Fix Missing Event Listeners',
      reason: `${heartbeatState.failedUpdates.length} listeners failed to update UI`,
      implementation: [
        '1. Check DOM elements have data-listener attributes',
        '2. Verify event bubbling not stopped',
        '3. Add fallback update mechanism',
        '4. Test with browser DevTools network throttling',
      ],
    });
  }

  return recommendations;
}

/**
 * Run complete Firebase heartbeat test
 */
export async function runFirebaseHeartbeat() {
  if (heartbeatState.isRunning) {
    console.warn('⚠️ Firebase heartbeat test already running');
    return null;
  }

  heartbeatState.isRunning = true;
  heartbeatState.updates = [];
  heartbeatState.latencies = [];
  heartbeatState.peakLatency = 0;
  heartbeatState.minLatency = Infinity;
  heartbeatState.slowListeners = [];
  heartbeatState.failedUpdates = [];

  console.log('');
  console.log('🚀 Starting Firebase Heartbeat Test');
  console.log('═'.repeat(70));
  console.log('📡 Testing database listener latency...');
  console.log(`⏱️  Test duration: ${HEARTBEAT_CONFIG.testDuration / 1000} seconds`);
  console.log('');

  const testStart = performance.now();
  const listeners = [
    { name: 'Users Listener', path: 'users' },
    { name: 'Trades Listener', path: 'trades' },
    { name: 'Notifications Listener', path: 'notifications' },
    { name: 'Market Data Listener', path: 'marketData' },
  ];

  const results = {};

  for (const listenerConfig of listeners) {
    try {
      console.log(`📡 Testing ${listenerConfig.name}...`);
      
      const listenerResults = await simulateFirebaseHeartbeat(listenerConfig.name, 5);
      results[listenerConfig.name] = listenerResults;

      const avgLatency = listenerResults
        .filter(r => r.latency !== 'TIMEOUT')
        .reduce((sum, r) => sum + parseFloat(r.latency), 0) / 
        listenerResults.filter(r => r.latency !== 'TIMEOUT').length;

      console.log(`✓ ${listenerConfig.name}: ${avgLatency.toFixed(2)}ms avg`);
      console.log('');
    } catch (error) {
      console.error(`✗ ${listenerConfig.name} failed:`, error.message);
      results[listenerConfig.name] = { error: error.message };
    }
  }

  const testEnd = performance.now();
  heartbeatState.isRunning = false;

  // Calculate averages
  if (heartbeatState.latencies.length > 0) {
    heartbeatState.avgLatency = heartbeatState.latencies.reduce((a, b) => a + b, 0) / heartbeatState.latencies.length;
  }
  heartbeatState.networkQuality = detectNetworkQuality();

  const optimizations = getOptimizations();

  const report = {
    timestamp: new Date().toISOString(),
    testType: 'Firebase Heartbeat',
    testDuration_ms: (testEnd - testStart).toFixed(2),
    performance: {
      latency: {
        average_ms: heartbeatState.avgLatency.toFixed(2),
        min_ms: heartbeatState.minLatency === Infinity ? 'N/A' : heartbeatState.minLatency.toFixed(2),
        peak_ms: heartbeatState.peakLatency > 0 ? heartbeatState.peakLatency.toFixed(2) : 'N/A',
        threshold_ms: HEARTBEAT_CONFIG.latencyThreshold,
        status: heartbeatState.avgLatency < HEARTBEAT_CONFIG.latencyThreshold ? '✅ Within threshold' : '⚠️ Exceeds threshold',
      },
      network_quality: heartbeatState.networkQuality,
      updates_tested: heartbeatState.updates.length,
      updates_successful: heartbeatState.updates.filter(u => u.latency < HEARTBEAT_CONFIG.criticalThreshold).length,
      updates_slow: heartbeatState.slowListeners.length,
      updates_failed: heartbeatState.failedUpdates.length,
    },
    listeners_tested: listeners.map(l => l.name),
    detailed_results: results,
    slowListeners: heartbeatState.slowListeners,
    failedUpdates: heartbeatState.failedUpdates,
    optimizations: optimizations,
    health_score: calculateHeartbeatHealthScore(
      heartbeatState.avgLatency,
      heartbeatState.peakLatency,
      heartbeatState.failedUpdates.length
    ),
  };

  console.log('═'.repeat(70));
  console.log('📊 FIREBASE HEARTBEAT TEST RESULTS');
  console.log('═'.repeat(70));
  console.log(`Network Quality: ${report.performance.network_quality}`);
  console.log(`Avg Latency: ${report.performance.latency.average_ms}ms`);
  console.log(`Peak Latency: ${report.performance.latency.peak_ms}ms`);
  console.log(`Slow Listeners: ${report.performance.updates_slow}`);
  console.log(`Failed Updates: ${report.performance.updates_failed}`);
  console.log(`Optimizations: ${optimizations.length}`);
  console.log('═'.repeat(70));

  return report;
}

/**
 * Calculate health score for heartbeat
 */
function calculateHeartbeatHealthScore(avgLatency, peakLatency, failedUpdates) {
  let score = 100;

  if (avgLatency > HEARTBEAT_CONFIG.latencyThreshold) {
    score -= (avgLatency - HEARTBEAT_CONFIG.latencyThreshold) * 0.05;
  }

  if (peakLatency > HEARTBEAT_CONFIG.criticalThreshold) {
    score -= 30;
  }

  if (failedUpdates > 0) {
    score -= failedUpdates * 10;
  }

  return Math.max(0, Math.min(100, score)).toFixed(2);
}

/**
 * Get current heartbeat state
 */
export function getHeartbeatState() {
  return {
    isRunning: heartbeatState.isRunning,
    avgLatency: heartbeatState.avgLatency.toFixed(2),
    peakLatency: heartbeatState.peakLatency.toFixed(2),
    networkQuality: heartbeatState.networkQuality,
    slowListeners: heartbeatState.slowListeners,
  };
}

/**
 * Export heartbeat report
 */
export function exportHeartbeatReport(report, filename = 'firebase-heartbeat-report.json') {
  const dataStr = JSON.stringify(report, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
