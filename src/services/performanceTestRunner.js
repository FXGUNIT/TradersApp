/**
 * ═══════════════════════════════════════════════════════════════════
 * STAGE 3: PERFORMANCE TEST RUNNER
 * ═══════════════════════════════════════════════════════════════════
 * Orchestrates all three performance tests:
 * 1. Data Load Test (FPS & RAM monitoring)
 * 2. Firebase Heartbeat (Database listener latency)
 * 3. Image Optimization Check (Upload size validation)
 * 
 * Usage:
 *   import { runFullPerformanceTest } from './performanceTestRunner.js';
 *   const results = await runFullPerformanceTest(database);
 */

import { runDataLoadTest } from '../utils/performanceBenchmark.js';
import { runFirebaseHeartbeat } from './firebaseHeartbeat.js';
import { runImageOptimizationCheck } from '../utils/imageOptimizationChecker.js';

const RUNNER_STATE = {
  isRunning: false,
  currentStep: null,
  results: null,
  startTime: null,
  endTime: null,
};

/**
 * Display step header
 */
function displayStepHeader(stepNum, title, description) {
  console.log('');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log(`║ STAGE 3 - STEP ${stepNum}: ${title.padEnd(50)} ║`);
  console.log('║ ' + description.padEnd(68) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');
  console.log('');
}

/**
 * Run speed & data benchmark
 */
async function runStep1_DataLoadTest() {
  displayStepHeader(
    1,
    'DATA LOAD TEST',
    'Monitor FPS & RAM when loading 500 traders'
  );

  RUNNER_STATE.currentStep = 'Data Load Test';

  try {
    const report = await runDataLoadTest(500);
    return report;
  } catch (error) {
    console.error('❌ Data Load Test failed:', error.message);
    return null;
  }
}

/**
 * Run Firebase heartbeat test
 */
async function runStep2_FirebaseHeartbeat(database) {
  displayStepHeader(
    2,
    'FIREBASE HEARTBEAT',
    'Measure database listener latency (DB change → UI update)'
  );

  RUNNER_STATE.currentStep = 'Firebase Heartbeat';

  try {
    const report = await runFirebaseHeartbeat(database);
    return report;
  } catch (error) {
    console.error('❌ Firebase Heartbeat failed:', error.message);
    return null;
  }
}

/**
 * Run image optimization check
 */
async function runStep3_ImageOptimization(database) {
  displayStepHeader(
    3,
    'IMAGE OPTIMIZATION',
    'Check user uploads for uncompressed images > 500KB'
  );

  RUNNER_STATE.currentStep = 'Image Optimization';

  try {
    const report = await runImageOptimizationCheck(database);
    return report;
  } catch (error) {
    console.error('❌ Image Optimization Check failed:', error.message);
    return null;
  }
}

/**
 * Generate consolidated health report
 */
function generateConsolidatedReport(step1, step2, step3) {
  const overallHealthScore = calculateOverallScore(step1, step2, step3);

  return {
    timestamp: new Date().toISOString(),
    testType: 'Performance & Speed Benchmark (Stage 3)',
    duration_seconds: ((RUNNER_STATE.endTime - RUNNER_STATE.startTime) / 1000).toFixed(2),
    overall: {
      health_score: overallHealthScore,
      risk_level: getRiskLevel(overallHealthScore),
      emoji: getHealthEmoji(overallHealthScore),
      summary: generateSummary(step1, step2, step3),
    },
    tests: {
      data_load_test: step1,
      firebase_heartbeat: step2,
      image_optimization: step3,
    },
    critical_findings: identifyCriticalIssues(step1, step2, step3),
    recommendations: generateMasterRecommendations(step1, step2, step3),
  };
}

/**
 * Calculate overall health score
 */
function calculateOverallScore(step1, step2, step3) {
  let scores = [];

  if (step1) scores.push(parseFloat(step1.health_score || 50));
  if (step2) scores.push(parseFloat(step2.health_score || 50));
  if (step3) scores.push(parseFloat(step3.health_score || 50));

  if (scores.length === 0) return 0;
  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
}

/**
 * Get risk level
 */
function getRiskLevel(score) {
  const num = parseFloat(score);
  if (num >= 80) return 'LOW ✅';
  if (num >= 60) return 'MEDIUM ⚠️';
  if (num >= 40) return 'HIGH 🔴';
  return 'CRITICAL ⚠️❌';
}

/**
 * Get health emoji
 */
function getHealthEmoji(score) {
  const num = parseFloat(score);
  if (num >= 80) return '🟢';
  if (num >= 60) return '🟡';
  if (num >= 40) return '🔴';
  return '⚠️';
}

/**
 * Generate summary
 */
function generateSummary(step1, step2, step3) {
  const summaryPoints = [];

  if (step1) {
    const fps = step1.performance?.fps;
    if (fps && fps.average < 60) {
      summaryPoints.push(`Data grid FPS below 60 (${fps.average})`);
    }
  }

  if (step2) {
    const latency = step2.performance?.latency;
    if (latency && parseFloat(latency.average_ms) > 500) {
      summaryPoints.push(`Firebase listeners slow (${latency.average_ms}ms avg)`);
    }
  }

  if (step3) {
    const oversized = step3.summary?.oversizedImages || 0;
    if (oversized > 0) {
      summaryPoints.push(`${oversized} images over 500KB detected`);
    }
  }

  return summaryPoints.length > 0 
    ? summaryPoints.join(' | ')
    : 'All performance metrics within acceptable ranges';
}

/**
 * Identify critical issues
 */
function identifyCriticalIssues(step1, step2, step3) {
  const critical = [];

  if (step1) {
    if (step1.performance?.fps?.min < 30) {
      critical.push({
        severity: 'CRITICAL',
        component: 'Data Grid',
        issue: `FPS dropped below 30 (${step1.performance.fps.min})`,
        impact: 'Severe UI jank when scrolling large datasets',
        fix: 'Implement virtual scrolling (react-window)',
      });
    }

    if (step1.performance?.ram?.peak_mb > 200) {
      critical.push({
        severity: 'HIGH',
        component: 'Memory',
        issue: `Peak RAM: ${step1.performance.ram.peak_mb}MB (threshold: 150MB)`,
        impact: 'May crash on low-memory devices',
        fix: 'Implement pagination or lazy loading',
      });
    }
  }

  if (step2) {
    if (step2.performance?.updates_failed > 0) {
      critical.push({
        severity: 'CRITICAL',
        component: 'Firebase Listeners',
        issue: `${step2.performance.updates_failed} listener updates failed`,
        impact: 'Users may see stale data',
        fix: 'Add error handling and retry logic to listeners',
      });
    }

    if (parseFloat(step2.performance?.latency?.average_ms || 0) > 1000) {
      critical.push({
        severity: 'HIGH',
        component: 'Database',
        issue: `Average latency: ${step2.performance.latency.average_ms}ms (critical: 1000ms)`,
        impact: 'Slow data updates = poor UX',
        fix: 'Split listeners, add pagination, or optimize queries',
      });
    }
  }

  if (step3) {
    const critical_images = step3.images?.oversized?.filter(img => parseFloat(img.size_kb) > 1000) || [];
    if (critical_images.length > 0) {
      critical.push({
        severity: 'CRITICAL',
        component: 'Image Optimization',
        issue: `${critical_images.length} images over 1MB detected`,
        impact: 'Slow load times, excess bandwidth usage',
        fix: 'Compress images using WebP format, target < 300KB',
      });
    }
  }

  return critical;
}

/**
 * Generate master recommendations
 */
function generateMasterRecommendations(step1, step2, step3) {
  const recommendations = [];

  // From data load test
  if (step1?.optimizations) {
    recommendations.push(...step1.optimizations.map(opt => ({
      ...opt,
      source: 'Data Load Test',
    })));
  }

  // From firebase heartbeat
  if (step2?.optimizations) {
    recommendations.push(...step2.optimizations.map(opt => ({
      ...opt,
      source: 'Firebase Heartbeat',
    })));
  }

  // From image optimization
  if (step3?.images?.oversized) {
    const criticalImages = step3.images.oversized.filter(img => parseFloat(img.size_kb) > 1000);
    if (criticalImages.length > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        optimization: 'Compress Critical Images',
        reason: `${criticalImages.length} images exceed 1MB`,
        implementation: [
          '1. Use WebP format for all user uploads',
          '2. Server-side compression on upload',
          '3. Generate multiple sizes (thumbnail, normal, full)',
          `4. Expected savings: ${step3.summary.potentialSavings_mb}MB`,
        ],
        source: 'Image Optimization Check',
      });
    }
  }

  // Sort by priority
  const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  recommendations.sort((a, b) => {
    const aPriority = priorityOrder[a.priority] || 4;
    const bPriority = priorityOrder[b.priority] || 4;
    return aPriority - bPriority;
  });

  return recommendations.slice(0, 10); // Top 10
}

/**
 * Display final comprehensive report
 */
function displayFinalReport(report) {
  console.log('');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' STAGE 3: SPEED & DATA BENCHMARK - FINAL REPORT '.padStart(45).padEnd(69) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');
  console.log('');

  console.log(`Overall Health Score: ${report.overall.health_score} ${report.overall.emoji}`);
  console.log(`Risk Level: ${report.overall.risk_level}`);
  console.log(`Test Duration: ${report.duration_seconds}s`);
  console.log('');

  // Critical findings
  if (report.critical_findings?.length > 0) {
    console.log('🚨 CRITICAL FINDINGS:');
    report.critical_findings.forEach(finding => {
      console.log(`\n  [${finding.severity}] ${finding.issue}`);
      console.log(`  Component: ${finding.component}`);
      console.log(`  Impact: ${finding.impact}`);
      console.log(`  Fix: ${finding.fix}`);
    });
    console.log('');
  }

  // Top recommendations
  if (report.recommendations?.length > 0) {
    console.log('💡 TOP RECOMMENDATIONS:');
    report.recommendations.slice(0, 5).forEach((rec, idx) => {
      console.log(`\n  ${idx + 1}. [${rec.priority}] ${rec.optimization}`);
      console.log(`     From: ${rec.source}`);
      console.log(`     Effort: ${rec.effort || 'N/A'}`);
    });
    console.log('');
  }

  console.log('═'.repeat(70));
  console.log('Full report available via: window.__performanceTest.getReport()');
}

/**
 * Run complete performance test
 */
export async function runFullPerformanceTest(database) {
  if (RUNNER_STATE.isRunning) {
    console.warn('⚠️ Performance test already running');
    return null;
  }

  RUNNER_STATE.isRunning = true;
  RUNNER_STATE.startTime = performance.now();

  console.log('');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' STAGE 3: SPEED & DATA BENCHMARK '.padStart(35).padEnd(69) + '║');
  console.log('║' + ' Complete Institutional Performance Test '.padStart(40).padEnd(69) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');

  // Run all three tests
  const step1 = await runStep1_DataLoadTest();
  const step2 = await runStep2_FirebaseHeartbeat(database);
  const step3 = await runStep3_ImageOptimization(database);

  RUNNER_STATE.endTime = performance.now();

  // Generate consolidated report
  const consolidatedReport = generateConsolidatedReport(step1, step2, step3);
  RUNNER_STATE.results = consolidatedReport;

  // Display final report
  displayFinalReport(consolidatedReport);

  RUNNER_STATE.isRunning = false;

  return consolidatedReport;
}

/**
 * Get test report
 */
export function getPerformanceTestReport() {
  return RUNNER_STATE.results;
}

/**
 * Export full test report
 */
export function exportPerformanceTestReport(filename = 'stage3-performance-benchmark.json') {
  if (!RUNNER_STATE.results) {
    console.warn('No test results available. Run runFullPerformanceTest() first.');
    return;
  }

  const dataStr = JSON.stringify(RUNNER_STATE.results, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Expose to window for console access
 */
export function exposePerformanceTestToWindow() {
  window.__performanceTest = {
    run: runFullPerformanceTest,
    getReport: getPerformanceTestReport,
    export: exportPerformanceTestReport,
  };

  console.log('✅ Performance Test accessible via: window.__performanceTest.run()');
}
