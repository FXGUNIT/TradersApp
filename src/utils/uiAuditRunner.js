/* eslint-disable no-console */
/**
 * ═══════════════════════════════════════════════════════════════════
 * UI INTEGRITY AUDIT - MASTER RUNNER
 * ═══════════════════════════════════════════════════════════════════
 * Orchestrates all three audit steps and generates comprehensive report
 * 
 * Usage:
 *   import { initUIAudit, runFullUIAudit } from './uiAuditRunner.js';
 *   
 *   // Initialize in App.jsx:
 *   useEffect(() => {
 *     initUIAudit({
 *       telegramToken: TELEGRAM_TOKEN,
 *       telegramChatId: TELEGRAM_CHAT_ID,
 *       onError: showToast,
 *     });
 *   }, []);
 *   
 *   // Run full audit:
 *   const fullReport = await runFullUIAudit();
 *   console.log(fullReport);
 */

import { runUICrawler } from './uiAuditCrawler.js';
import { initBrokenLinkDetector, getBrokenLinkReport } from './uiAuditBrokenLinkDetector.js';
import { runIconValidation, generateA11yReport } from './uiAuditIconValidation.js';

const AUDIT_STATE = {
  isRunning: false,
  crawlerReport: null,
  brokenLinkReport: null,
  iconValidationReport: null,
  fullReport: null,
  startTime: null,
  endTime: null,
};

/**
 * Initialize audit system
 */
export function initUIAudit(config = {}) {
  console.log('🚀 Initializing UI Integrity Audit System...');
  console.log('═'.repeat(80));
  
  // Initialize broken link detector with Telegram integration
  initBrokenLinkDetector({
    telegramToken: config.telegramToken,
    telegramChatId: config.telegramChatId,
    onError: config.onError,
    captureNetworkErrors: true,
    monitorConsoleErrors: true,
    logToConsole: config.verbose || false,
  });
  
  console.log('✅ UI Audit System Ready');
  console.log('  📍 Step 1: UI Crawler (simulates clicks)');
  console.log('  📍 Step 2: Broken Link Detector (network monitoring)');
  console.log('  📍 Step 3: Icon Validation (accessibility checks)');
  console.log('');
  console.log('Run: await runFullUIAudit() to start comprehensive audit');
  console.log('═'.repeat(80));
  console.log('');
}

/**
 * Run Step 1: The Crawler
 */
async function runStep1_Crawler() {
  console.log('');
  console.log('🎯 STEP 1: THE CRAWLER - Simulating Navigation Clicks');
  console.log('═'.repeat(80));
  
  try {
    const report = await runUICrawler({ verbose: false });
    AUDIT_STATE.crawlerReport = report;
    
    console.log('✅ Step 1 Complete');
    console.log(`  • Total Elements: ${report.summary.totalElements}`);
    console.log(`  • Successful Clicks: ${report.summary.successfulClicks}`);
    console.log(`  • Failed Clicks: ${report.summary.failedClicks}`);
    console.log(`  • Failure Rate: ${report.summary.failureRate}`);
    console.log(`  • Accessibility Issues: ${report.summary.accessibilityIssues}`);
    console.log(`  • Avg Load Time: ${report.summary.avgLoadTime}`);
    console.log('');
    
    return report;
  } catch (error) {
    console.error('❌ Step 1 Failed:', error.message);
    return null;
  }
}

/**
 * Run Step 2: Broken Link Detector (already monitoring)
 */
function runStep2_BrokenLinkDetector() {
  console.log('🎯 STEP 2: BROKEN LINK DETECTOR - Network Monitoring');
  console.log('═'.repeat(80));
  
  try {
    const report = getBrokenLinkReport();
    AUDIT_STATE.brokenLinkReport = report;
    
    console.log('✅ Step 2 Active (Real-time Monitoring)');
    console.log(`  • Broken Links Found: ${report.summary.totalBrokenLinks}`);
    console.log(`  • Network Errors: ${report.summary.totalNetworkErrors}`);
    console.log(`  • Component Errors: ${report.summary.totalComponentErrors}`);
    console.log(`  • Console Errors: ${report.summary.totalConsoleErrors}`);
    console.log(`  • Critical Issues: ${report.summary.criticalIssues.length}`);
    console.log('');
    console.log('📡 Status: Telegram alerts configured and active');
    console.log('');
    
    return report;
  } catch (error) {
    console.error('❌ Step 2 Failed:', error.message);
    return null;
  }
}

/**
 * Run Step 3: Icon Validation
 */
async function runStep3_IconValidation() {
  console.log('🎯 STEP 3: ICON VALIDATION - Accessibility & Active States');
  console.log('═'.repeat(80));
  
  try {
    const report = await runIconValidation({
      checkAriaLabels: true,
      checkActiveStates: true,
      checkKeyboardNavigation: true,
      verbose: false,
    });
    
    AUDIT_STATE.iconValidationReport = report;
    const a11yReport = generateA11yReport();
    
    console.log('✅ Step 3 Complete');
    console.log(`  • Total Icons: ${report.summary.totalIcons}`);
    console.log(`  • Valid Icons: ${report.summary.validIcons}`);
    console.log(`  • Invalid Icons: ${report.summary.invalidIcons}`);
    console.log(`  • Pass Rate: ${report.summary.passRate}%`);
    console.log(`  • Accessibility Issues: ${report.summary.accessibilityIssues}`);
    console.log(`  • Keyboard Traps: ${report.summary.keyboardTraps}`);
    console.log(`  • Contrast Issues: ${report.summary.contrastIssues}`);
    console.log(`  • Active State Coverage: ${report.summary.activeStateCoverage}`);
    console.log('');
    console.log('📋 WCAG 2.1 Violations:', Object.keys(a11yReport.wcagCompliance).map(level => {
      const count = a11yReport.wcagCompliance[level].length;
      return count > 0 ? `${level}: ${count}` : null;
    }).filter(Boolean).join(' | '));
    console.log('');
    
    return { report, a11yReport };
  } catch (error) {
    console.error('❌ Step 3 Failed:', error.message);
    return null;
  }
}

/**
 * Aggregate results and generate full report
 */
function generateFullReport() {
  const executionTime = AUDIT_STATE.endTime - AUDIT_STATE.startTime;
  
  // Calculate overall health score (0-100)
  let healthScore = 100;
  
  if (AUDIT_STATE.crawlerReport) {
    const crawlerFailureRate = parseInt(AUDIT_STATE.crawlerReport.summary.failureRate);
    healthScore -= crawlerFailureRate * 0.5;
  }
  
  if (AUDIT_STATE.brokenLinkReport) {
    const brokenLinkPenalty = AUDIT_STATE.brokenLinkReport.summary.totalBrokenLinks * 2;
    healthScore -= Math.min(brokenLinkPenalty, 30);
  }
  
  if (AUDIT_STATE.iconValidationReport) {
    const passRate = parseInt(AUDIT_STATE.iconValidationReport.summary.passRate);
    healthScore -= (100 - passRate) * 0.3;
  }
  
  healthScore = Math.max(0, Math.min(100, healthScore));
  
  const riskLevel = healthScore >= 80 ? 'LOW' : 
                   healthScore >= 60 ? 'MEDIUM' : 
                   healthScore >= 40 ? 'HIGH' : 'CRITICAL';
  
  const fullReport = {
    timestamp: new Date().toISOString(),
    executionTime: {
      total: `${executionTime.toFixed(0)}ms`,
      value: executionTime,
    },
    overallHealth: {
      score: healthScore.toFixed(2),
      riskLevel,
      emoji: healthScore >= 80 ? '🟢' : healthScore >= 60 ? '🟡' : '🔴',
    },
    steps: {
      step1_crawler: AUDIT_STATE.crawlerReport,
      step2_brokenLinks: AUDIT_STATE.brokenLinkReport,
      step3_iconValidation: AUDIT_STATE.iconValidationReport,
    },
    recommendations: generateAuditRecommendations(),
    criticalFindings: identifyCriticalIssues(),
  };
  
  return fullReport;
}

/**
 * Identify critical issues that need immediate attention
 */
function identifyCriticalIssues() {
  const critical = [];
  
  if (AUDIT_STATE.crawlerReport) {
    const failureRate = parseInt(AUDIT_STATE.crawlerReport.summary.failureRate);
    if (failureRate > 10) {
      critical.push({
        severity: 'CRITICAL',
        issue: 'High UI element failure rate',
        finding: `${failureRate}% of navigation elements failed to respond to clicks`,
        impact: 'Users may not be able to navigate the application',
        recommendation: 'Review failed elements and test click handlers',
      });
    }
  }
  
  if (AUDIT_STATE.brokenLinkReport) {
    if (AUDIT_STATE.brokenLinkReport.summary.totalBrokenLinks > 5) {
      critical.push({
        severity: 'CRITICAL',
        issue: 'Multiple broken links detected',
        finding: `${AUDIT_STATE.brokenLinkReport.summary.totalBrokenLinks} broken links found`,
        impact: '404 errors will blocks users from accessing content',
        recommendation: 'Check and fix all 404 responses in API endpoints',
      });
    }
    
    if (AUDIT_STATE.brokenLinkReport.summary.totalComponentErrors > 3) {
      critical.push({
        severity: 'HIGH',
        issue: 'Component loading failures',
        finding: `${AUDIT_STATE.brokenLinkReport.summary.totalComponentErrors} components failed to load`,
        impact: 'Features may not render correctly for users',
        recommendation: 'Debug component initialization and error boundaries',
      });
    }
  }
  
  if (AUDIT_STATE.iconValidationReport) {
    const passRate = parseInt(AUDIT_STATE.iconValidationReport.summary.passRate);
    if (passRate < 60) {
      critical.push({
        severity: 'HIGH',
        issue: 'Widespread accessibility issues',
        finding: `Only ${passRate}% of icons are properly labeled`,
        impact: 'Screen reader users cannot understand icon buttons',
        recommendation: 'Add aria-labels to all icon buttons (WCAG 2.1 Level A)',
      });
    }
    
    if (AUDIT_STATE.iconValidationReport.summary.keyboardTraps > 0) {
      critical.push({
        severity: 'CRITICAL',
        issue: 'Keyboard navigation traps detected',
        finding: `${AUDIT_STATE.iconValidationReport.summary.keyboardTraps} keyboard traps found`,
        impact: 'Keyboard users may become trapped in focus loops',
        recommendation: 'Fix tabindex values and ensure all elements are keyboard accessible',
      });
    }
  }
  
  return critical;
}

/**
 * Generate audit recommendations
 */
function generateAuditRecommendations() {
  const recommendations = [];
  
  // Crawler recommendations
  if (AUDIT_STATE.crawlerReport?.failedElements?.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Navigation',
      action: 'Fix broken navigation elements',
      details: `${AUDIT_STATE.crawlerReport.failedElements.length} elements failed to respond`,
      effort: 'MEDIUM',
    });
  }
  
  // Broken link recommendations
  if (AUDIT_STATE.brokenLinkReport?.brokenLinks?.length > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      category: 'API/Backend',
      action: 'Fix 404 broken links',
      details: `${AUDIT_STATE.brokenLinkReport.brokenLinks.length} 404s detected`,
      effort: 'HIGH',
    });
  }
  
  // Icon validation recommendations
  if (AUDIT_STATE.iconValidationReport?.accessibilityIssues?.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Accessibility',
      action: 'Add aria-labels to icons',
      details: `${AUDIT_STATE.iconValidationReport.accessibilityIssues.length} icons missing labels`,
      effort: 'LOW',
    });
  }
  
  if (parseInt(AUDIT_STATE.iconValidationReport?.summary?.activeStateCoverage || 0) < 80) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'UX',
      action: 'Add visual active state indicators',
      details: `Only ${AUDIT_STATE.iconValidationReport?.summary?.activeStateCoverage || 0}% coverage`,
      effort: 'MEDIUM',
    });
  }
  
  return recommendations.sort((a, b) => {
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Run full UI integrity audit (all 3 steps)
 */
export async function runFullUIAudit() {
  if (AUDIT_STATE.isRunning) {
    console.warn('⚠️ Audit already running. Please wait for it to complete.');
    return null;
  }
  
  AUDIT_STATE.isRunning = true;
  AUDIT_STATE.startTime = performance.now();
  
  console.log('');
  console.log('🔍 LAUNCHING FULL UI INTEGRITY AUDIT');
  console.log('═'.repeat(80));
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log('');
  
  try {
    // Run Step 1: Crawler
    await runStep1_Crawler();
    
    // Step 2: Broken Link Detector (passive monitoring)
    runStep2_BrokenLinkDetector();
    
    // Run Step 3: Icon Validation
    await runStep3_IconValidation();
    
    // Generate full report
    AUDIT_STATE.endTime = performance.now();
    const fullReport = generateFullReport();
    AUDIT_STATE.fullReport = fullReport;
    
    // Display summary
    displayAuditSummary(fullReport);
    
    AUDIT_STATE.isRunning = false;
    
    return fullReport;
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    AUDIT_STATE.isRunning = false;
    return null;
  }
}

/**
 * Display audit summary in console with formatting
 */
function displayAuditSummary(report) {
  console.log('');
  console.log('═'.repeat(80));
  console.log(`${report.overallHealth.emoji} UI INTEGRITY AUDIT COMPLETE`);
  console.log('═'.repeat(80));
  console.log('');
  
  console.log('📊 HEALTH SCORE:', report.overallHealth.score, `(${report.overallHealth.riskLevel})`);
  console.log('⏱️  Execution Time:', report.executionTime.total);
  console.log('');
  
  console.log('📋 STEP RESULTS:');
  console.log('');
  
  if (report.steps.step1_crawler) {
    console.log('  STEP 1: Crawler');
    console.log(`    ✓ Click Success: ${report.steps.step1_crawler.summary.successfulClicks}/${report.steps.step1_crawler.summary.totalElements}`);
    console.log(`    ✗ Failures: ${report.steps.step1_crawler.summary.failedClicks} (${report.steps.step1_crawler.summary.failureRate})`);
    console.log('');
  }
  
  if (report.steps.step2_brokenLinks) {
    console.log('  STEP 2: Broken Link Detection');
    console.log(`    🔴 Broken Links: ${report.steps.step2_brokenLinks.summary.totalBrokenLinks}`);
    console.log(`    ⚠️  Network Errors: ${report.steps.step2_brokenLinks.summary.totalNetworkErrors}`);
    console.log(`    🔧 Component Errors: ${report.steps.step2_brokenLinks.summary.totalComponentErrors}`);
    console.log('');
  }
  
  if (report.steps.step3_iconValidation) {
    console.log('  STEP 3: Icon Validation');
    console.log(`    ✓ Valid Icons: ${report.steps.step3_iconValidation.summary.validIcons}/${report.steps.step3_iconValidation.summary.totalIcons}`);
    console.log(`    ✗ Accessibility Issues: ${report.steps.step3_iconValidation.summary.accessibilityIssues}`);
    console.log(`    🎨 Active State Coverage: ${report.steps.step3_iconValidation.summary.activeStateCoverage}`);
    console.log('');
  }
  
  if (report.criticalFindings.length > 0) {
    console.log('⚠️  CRITICAL FINDINGS:');
    report.criticalFindings.forEach(finding => {
      console.log(`\n  [${finding.severity}] ${finding.issue}`);
      console.log(`    Finding: ${finding.finding}`);
      console.log(`    Impact: ${finding.impact}`);
      console.log(`    Fix: ${finding.recommendation}`);
    });
    console.log('');
  }
  
  if (report.recommendations.length > 0) {
    console.log('💡 TOP RECOMMENDATIONS:');
    report.recommendations.slice(0, 5).forEach((rec, idx) => {
      console.log(`\n  ${idx + 1}. [${rec.priority}] ${rec.action}`);
      console.log(`     Category: ${rec.category}`);
      console.log(`     Effort: ${rec.effort}`);
    });
    console.log('');
  }
  
  console.log('═'.repeat(80));
  console.log('✅ Full audit report available via: window.__auditReport');
  console.log('');
}

/**
 * Get full audit report
 */
export function getFullAuditReport() {
  return AUDIT_STATE.fullReport;
}

/**
 * Export full audit report to JSON
 */
export function exportFullAuditReport(filename = 'ui-integrity-audit-full.json') {
  const report = AUDIT_STATE.fullReport;
  if (!report) {
    console.warn('No audit report available. Run runFullUIAudit() first.');
    return;
  }
  
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
 * Make audit functions globally available
 */
export function exposeAuditToWindow() {
  window.__UIAudit = {
    init: initUIAudit,
    run: runFullUIAudit,
    getReport: getFullAuditReport,
    export: exportFullAuditReport,
  };
  
  console.log('✅ UI Audit accessible via: window.__UIAudit');
}
