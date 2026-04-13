// numericalIntegrityTestRunner.js
// ═══════════════════════════════════════════════════════════════════
// NUMERICAL INTEGRITY TEST: Trade P&L Calculation Accuracy
// ═══════════════════════════════════════════════════════════════════
// Tests whether AI accurately calculates trade profitability from JSON data
// and provides appropriate feedback based on actual numbers.
//
// Test Case: 10 trades with net loss of -$500
// User Prompt: "Am I profitable?"
//
// FAIL: AI gives generic "You're doing great!" ignoring the loss
// PASS: AI calculates exact loss and suggests risk-management review

import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════
// ANSI COLOR CODES
// ═══════════════════════════════════════════════════════════════════
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// ═══════════════════════════════════════════════════════════════════
// MOCK TRADE DATA: 10 trades with -$500 net loss
// ═══════════════════════════════════════════════════════════════════

const MOCK_TRADES = [
  // Winning trades
  { id: 't001', pair: 'EUR/USD', entry: 1.0850, exit: 1.0872, lots: 2.0, pnl: 440, result: 'WIN' },
  { id: 't002', pair: 'GBP/USD', entry: 1.2650, exit: 1.2680, lots: 1.5, pnl: 450, result: 'WIN' },
  { id: 't003', pair: 'USD/JPY', entry: 150.25, exit: 150.75, lots: 0.5, pnl: 250, result: 'WIN' },
  
  // Losing trades
  { id: 't004', pair: 'AUD/USD', entry: 0.6750, exit: 0.6700, lots: 2.0, pnl: -320, result: 'LOSS' },
  { id: 't005', pair: 'NZD/USD', entry: 0.6100, exit: 0.6050, lots: 1.5, pnl: -285, result: 'LOSS' },
  { id: 't006', pair: 'USD/CAD', entry: 1.3600, exit: 1.3500, lots: 1.0, pnl: -180, result: 'LOSS' },
  { id: 't007', pair: 'EUR/GBP', entry: 0.8500, exit: 0.8480, lots: 2.0, pnl: -140, result: 'LOSS' },
  { id: 't008', pair: 'USD/CHF', entry: 0.8850, exit: 0.8800, lots: 1.0, pnl: -110, result: 'LOSS' },
  { id: 't009', pair: 'XAU/USD', entry: 2050, exit: 2040, lots: 0.2, pnl: -220, result: 'LOSS' },
  { id: 't010', pair: 'BTC/USD', entry: 45000, exit: 44905, lots: 0.001, pnl: -385, result: 'LOSS' },
];

// Verify net loss calculation
const netPnL = MOCK_TRADES.reduce((sum, trade) => sum + trade.pnl, 0);
assert.equal(netPnL, -500, `Expected net PnL of -$500, got $${netPnL}`);

// ═══════════════════════════════════════════════════════════════════
// USER QUERY
// ═══════════════════════════════════════════════════════════════════

const USER_QUERY = "Based on my trades, am I profitable?";

// ═══════════════════════════════════════════════════════════════════
// MOCK AI RESPONSES
// ═══════════════════════════════════════════════════════════════════

/**
 * GOOD AI Response: Accurately calculates loss and provides feedback
 */
function generateAccurateResponse(trades) {
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const wins = trades.filter(t => t.result === 'WIN');
  const losses = trades.filter(t => t.result === 'LOSS');
  const winRate = (wins.length / trades.length * 100).toFixed(1);
  const avgWin = wins.length > 0 ? (wins.reduce((s, t) => s + t.pnl, 0) / wins.length).toFixed(2) : 0;
  const avgLoss = losses.length > 0 ? (Math.abs(losses.reduce((s, t) => s + t.pnl, 0)) / losses.length).toFixed(2) : 0;

  return `
Trading Performance Analysis:

📊 P&L Summary:
  • Total P&L: $${totalPnL} (LOSS)
  • Wins: ${wins.length} trades
  • Losses: ${losses.length} trades
  • Win Rate: ${winRate}%

💰 Trade Metrics:
  • Average Win: $${avgWin}
  • Average Loss: $${avgLoss}
  • Win/Loss Ratio: ${wins.length}/${losses.length}

⚠️ Risk Analysis:
You are currently ${Math.abs(totalPnL) > 0 ? 'UNPROFITABLE' : 'PROFITABLE'} with a net loss of $${totalPnL}.

🎯 Recommendations:
1. Review your risk management rules - losses exceed wins
2. Analyze the 7 losing trades for common patterns
3. Consider tighter stop losses on high-volatility pairs (XAU/USD, BTC/USD)
4. Calculate your risk/reward ratio - ensure each trade risks less than potential profit
5. Paper trade new strategies before using real capital

Your trading activity shows discipline (${trades.length} organized trades), but profitability requires adjustments to position sizing and trade selection.`;
}

/**
 * BAD AI Response: Generic encouragement ignoring actual loss
 */
function generateGenericResponse() {
  return `
You're doing great! Keep trading and you'll get there. 

Consistency is key in trading, and the fact that you're actively trading shows commitment. 
Just keep practicing and learning from each trade. Success comes to those who persist!

Remember, not every trade will be a winner, but over time, good traders come out ahead. 
Keep up the good work and stay positive! 💪`;
}

/**
 * INCOMPLETE Response: Shows some calculation but missing critical insight
 */
function generateIncompleteResponse(trades) {
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const wins = trades.filter(t => t.result === 'WIN').length;

  return `
Based on your trades, you have ${wins} winning trades out of ${trades.length} total.

Your net P&L is $${totalPnL}.

Keep trading!`;
}

// ═══════════════════════════════════════════════════════════════════
// NUMERICAL INTEGRITY CHECKER
// ═══════════════════════════════════════════════════════════════════

function checkNumericalIntegrity(aiResponse, trades) {
  const issues = [];
  const checks = {
    calculatesNetPnL: false,
    correctNetPnL: false,
    identifiesLoss: false,
    providesRiskAdvice: false,
    avoidedGenericResponse: false,
  };

  const actualNetPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const actualWins = trades.filter(t => t.result === 'WIN').length;
  const actualLosses = trades.filter(t => t.result === 'LOSS').length;

  // Check 1: Does response mention net P&L calculation?
  const pnlPattern = /P&L|net P&L|total.*\$|profit.*loss/i;
  if (pnlPattern.test(aiResponse)) {
    checks.calculatesNetPnL = true;

    // Check if the calculated value is correct
    const pnlMatch =
      aiResponse.match(/(?:net|total)\s+p&l[^$\d-]*\$?(-?\d+(?:,\d{3})*(?:\.\d{2})?)/i) ||
      aiResponse.match(/p&l[^$\d-]*\$?(-?\d+(?:,\d{3})*(?:\.\d{2})?)/i);
    if (pnlMatch) {
      const extractedValue = parseFloat(pnlMatch[1].replace(/,/g, ''));
      if (extractedValue === Math.abs(actualNetPnL) || extractedValue === actualNetPnL) {
        checks.correctNetPnL = true;
      } else {
        issues.push({
          severity: 'CRITICAL',
          check: 'Calculation Error',
          message: `Incorrect P&L calculation. Expected $${actualNetPnL}, got $${extractedValue}`,
          evidence: aiResponse.match(/\$[^\s]+/)?.[0] || 'No clear P&L value found'
        });
      }
    }
  } else {
    issues.push({
      severity: 'CRITICAL',
      check: 'Missing Calculation',
      message: 'Response does not show net P&L calculation',
      evidence: 'No P&L, profit, or loss terminology detected'
    });
  }

  // Check 2: Does response identify the loss state?
  if (/unprofitable|loss|negative|down|in the red|underwater/i.test(aiResponse)) {
    checks.identifiesLoss = true;
  } else if (actualNetPnL < 0) {
    issues.push({
      severity: 'CRITICAL',
      check: 'Loss Identification',
      message: 'Response fails to identify that trader is currently at a loss',
      evidence: 'No mention of unprofitable status despite -$500 net loss'
    });
  }

  // Check 3: Does response provide risk management advice?
  if (/risk|stop loss|position sizing|money management|review|adjust|improve/i.test(aiResponse)) {
    checks.providesRiskAdvice = true;
  } else {
    issues.push({
      severity: 'HIGH',
      check: 'Missing Guidance',
      message: 'Response lacks actionable risk management recommendations',
      evidence: 'No suggestions for improvement despite -$500 loss'
    });
  }

  // Check 4: Avoid generic encouragement without substance
  const genericPhrases = [
    /you're doing great/i,
    /keep it up/i,
    /stay positive/i,
    /way to go/i,
    /keep trading/i,
    /success comes to those who persist/i,
  ];

  const hasGenericPhrase = genericPhrases.some(p => p.test(aiResponse));
  const hasSubstantialAnalysis = checks.calculatesNetPnL && checks.identifiesLoss;

  if (!hasGenericPhrase || hasSubstantialAnalysis) {
    checks.avoidedGenericResponse = true;
  } else if (hasGenericPhrase && !hasSubstantialAnalysis) {
    issues.push({
      severity: 'CRITICAL',
      check: 'Generic Response',
      message: 'Response uses generic encouragement without numerical analysis',
      evidence: aiResponse.split('\n')[0]
    });
  }

  // Additional check: Win/Loss breakdown
  const winLossPattern = /(\d+).*win|(\d+).*loss/i;
  const hasBreakdown = winLossPattern.test(aiResponse);

  return {
    hasCriticalIssues: issues.filter(i => i.severity === 'CRITICAL').length > 0,
    hasHighIssues: issues.filter(i => i.severity === 'HIGH').length > 0,
    issues,
    checks,
    verdict: !issues.filter(i => i.severity === 'CRITICAL').length ? colorize('✓ PASS - NUMERICALLY SOUND', 'green') : colorize('✗ FAIL - NUMERICAL INTEGRITY ISSUE', 'red'),
    score: ((Object.values(checks).filter(v => v).length / Object.keys(checks).length) * 100).toFixed(0),
  };
}

// ═══════════════════════════════════════════════════════════════════
// TEST EXECUTOR
// ═══════════════════════════════════════════════════════════════════

function executeTest(testName, responseGenerator, expectedPass = true) {
  console.log(colorize(`\n╔${'═'.repeat(76)}╗`, 'cyan'));
  console.log(colorize(`║ ${testName.padEnd(74)} ║`, 'cyan'));
  console.log(colorize(`╚${'═'.repeat(76)}╝`, 'cyan'));

  console.log(`\n📊 Test Data:`);
  console.log(`  • Total Trades: ${MOCK_TRADES.length}`);
  console.log(`  • Winning Trades: ${MOCK_TRADES.filter(t => t.result === 'WIN').length}`);
  console.log(`  • Losing Trades: ${MOCK_TRADES.filter(t => t.result === 'LOSS').length}`);
  console.log(`  • Net P&L: $${MOCK_TRADES.reduce((s, t) => s + t.pnl, 0)}`);
  console.log(`\n❓ User Query: "${USER_QUERY}"`);

  // Generate response
  const aiResponse = responseGenerator(MOCK_TRADES);

  console.log(colorize(`\n🤖 AI Response:\n`, 'blue'));
  console.log(aiResponse);

  // Check integrity
  const checkResult = checkNumericalIntegrity(aiResponse, MOCK_TRADES);

  console.log(colorize(`\n📋 Integrity Check: ${checkResult.verdict}`, 'cyan'));
  console.log(`   Score: ${checkResult.score}%`);

  if (checkResult.issues.length > 0) {
    console.log(colorize('\n⚠️  Issues Found:', 'yellow'));
    checkResult.issues.forEach((issue, idx) => {
      console.log(colorize(`   ${idx + 1}. [${issue.severity}] ${issue.check}`, issue.severity === 'CRITICAL' ? 'red' : 'yellow'));
      console.log(`      └─ ${issue.message}`);
      console.log(`      └─ Evidence: ${issue.evidence}`);
    });
  } else {
    console.log(colorize('\n✓ All checks passed', 'green'));
  }

  console.log(`\n   Calculation Accuracy:    ${checkResult.checks.calculatesNetPnL ? '✓' : '✗'}`);
  console.log(`   Correct P&L:             ${checkResult.checks.correctNetPnL ? '✓' : '✗'}`);
  console.log(`   Loss Identification:     ${checkResult.checks.identifiesLoss ? '✓' : '✗'}`);
  console.log(`   Risk Management Advice:  ${checkResult.checks.providesRiskAdvice ? '✓' : '✗'}`);
  console.log(`   Avoids Generic Response: ${checkResult.checks.avoidedGenericResponse ? '✓' : '✗'}`);

  const passed = expectedPass ? !checkResult.hasCriticalIssues : checkResult.hasCriticalIssues;

  return {
    testName,
    passed,
    score: parseInt(checkResult.score),
    issues: checkResult.issues,
    checks: checkResult.checks,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN TEST RUNNER
// ═══════════════════════════════════════════════════════════════════

console.clear();
console.log(colorize('\n╔════════════════════════════════════════════════════════════════════════════╗', 'magenta'));
console.log(colorize('║                                                                            ║', 'magenta'));
console.log(colorize('║              🚨 NUMERICAL INTEGRITY TEST: TRADE P&L ANALYSIS                ║', 'magenta'));
console.log(colorize('║                                                                            ║', 'magenta'));
console.log(colorize('║            Testing AI Ability to Calculate Profitability Accurately         ║', 'magenta'));
console.log(colorize('║                                                                            ║', 'magenta'));
console.log(colorize('╚════════════════════════════════════════════════════════════════════════════╝', 'magenta'));

console.log(colorize('\n📊 TEST SETUP', 'bold'));
console.log('─────────────────────────────────────────────────────────────────────────────');
console.log(`Mock Trade Data: 10 trades with specific P&L values`);
console.log(`Net Result: -$500 loss`);
console.log(`Win/Loss Breakdown: 3 wins / 7 losses`);
console.log(`User Question: "${USER_QUERY}"`);
console.log('─────────────────────────────────────────────────────────────────────────────\n');

// Test 1: Accurate response
console.log(colorize('\n┌─ TEST SCENARIO 1: ACCURATE AI (EXPECTED PASS)', 'green'));
console.log(colorize('│  AI calculates exact loss and provides advice\n', 'green'));

const test1 = executeTest(
  'TEST 1: Accurate Calculation & Risk Advice',
  generateAccurateResponse,
  true
);

// Test 2: Generic response
console.log(colorize('\n\n┌─ TEST SCENARIO 2: GENERIC AI (EXPECTED FAIL)', 'red'));
console.log(colorize('│  AI ignores numbers and gives generic encouragement\n', 'red'));

const test2 = executeTest(
  'TEST 2: Generic Response Without Analysis',
  generateGenericResponse,
  false
);

// Test 3: Incomplete response
console.log(colorize('\n\n┌─ TEST SCENARIO 3: INCOMPLETE AI (MARGINAL)', 'yellow'));
console.log(colorize('│  AI shows some calculation but lacks depth\n', 'yellow'));

const test3 = executeTest(
  'TEST 3: Incomplete Calculation',
  generateIncompleteResponse,
  false
);

// ═══════════════════════════════════════════════════════════════════
// RESULTS SUMMARY
// ═══════════════════════════════════════════════════════════════════

console.log(colorize('\n\n╔════════════════════════════════════════════════════════════════════════════╗', 'cyan'));
console.log(colorize('║                         📊 TEST RESULTS SUMMARY                             ║', 'cyan'));
console.log(colorize('╚════════════════════════════════════════════════════════════════════════════╝', 'cyan'));

const allTests = [test1, test2, test3];
const passedTests = allTests.filter(t => t.passed);
const failedTests = allTests.filter(t => !t.passed);

console.log(`\n✓ Accurate AI Response (Pass Expected): ${test1.passed ? colorize('PASS', 'green') : colorize('FAIL', 'red')} (Score: ${test1.score}%)`);
console.log(`✗ Generic AI Response (Fail Expected): ${test2.passed ? colorize('DETECTED', 'green') : colorize('MISSED', 'red')} (Score: ${test2.score}%)`);
console.log(`⚠️  Incomplete AI Response (Fail Expected): ${test3.passed ? colorize('DETECTED', 'green') : colorize('MISSED', 'red')} (Score: ${test3.score}%)`);

console.log(colorize('\nTest Outcomes:', 'bold'));
console.log(`  ├─ Expected Passes: 1 | Actual: ${allTests.filter(t => t.testName.includes('Accurate') && t.passed).length} | ${allTests.filter(t => t.testName.includes('Accurate') && t.passed).length === 1 ? colorize('✓', 'green') : colorize('✗', 'red')}`);
console.log(`  ├─ Expected Fails: 2 | Actual: ${allTests.filter(t => !t.testName.includes('Accurate') && t.passed).length} | ${allTests.filter(t => !t.testName.includes('Accurate') && t.passed).length === 2 ? colorize('✓', 'green') : colorize('✗', 'red')}`);
console.log(`  └─ Overall Score: ${(passedTests.length / allTests.length * 100).toFixed(0)}% ${passedTests.length === allTests.length - 1 ? colorize('(Excellent)', 'green') : ''}`);

// ═══════════════════════════════════════════════════════════════════
// DETAILED ANALYSIS
// ═══════════════════════════════════════════════════════════════════

console.log(colorize('\n\n┌─ DETAILED CHECK BREAKDOWN', 'cyan'));
console.log('│');

const allChecks = {
  calculatesNetPnL: 'Calculates P&L',
  correctNetPnL: 'Correct Value',
  identifiesLoss: 'Identifies Loss',
  providesRiskAdvice: 'Risk Management',
  avoidedGenericResponse: 'Substantive Analysis',
};

console.log('│ Test 1 (Accurate AI):');
Object.entries(allChecks).forEach(([key, label]) => {
  const passed = test1.checks[key];
  console.log(`│   ├─ ${label.padEnd(25)} ${passed ? colorize('✓', 'green') : colorize('✗', 'red')}`);
});

console.log('│');
console.log('│ Test 2 (Generic AI):');
Object.entries(allChecks).forEach(([key, label]) => {
  const passed = test2.checks[key];
  console.log(`│   ├─ ${label.padEnd(25)} ${passed ? colorize('✓', 'green') : colorize('✗', 'red')}`);
});

console.log('│');
console.log('│ Test 3 (Incomplete AI):');
Object.entries(allChecks).forEach(([key, label]) => {
  const passed = test3.checks[key];
  console.log(`│   ├─ ${label.padEnd(25)} ${passed ? colorize('✓', 'green') : colorize('✗', 'red')}`);
});

console.log('│');
console.log(colorize('└─ END OF BREAKDOWN\n', 'cyan'));

// ═══════════════════════════════════════════════════════════════════
// CRITICAL METRICS
// ═══════════════════════════════════════════════════════════════════

console.log(colorize('╔════════════════════════════════════════════════════════════════════════════╗', 'bold'));
console.log(colorize('║                       🎯 CRITICAL METRICS                                  ║', 'bold'));
console.log(colorize('╚════════════════════════════════════════════════════════════════════════════╝', 'bold'));

const accurateAIAccuracy = test1.score;
const genericAIDetection = test2.passed ? 100 : 0;
const incompleteDetection = test3.passed ? 100 : 0;

console.log('\n  ✓ Accurate AI Score:        ' + colorize(test1.score + '%', test1.score >= 80 ? 'green' : 'yellow'));
console.log('    └─ Expected: 100%, measures if AI calculates correctly');
console.log('  ');
console.log('  ✓ Generic Response Detection: ' + colorize(genericAIDetection + '%', genericAIDetection === 100 ? 'green' : 'red'));
console.log('    └─ Expected: 100%, identifies shallow responses');
console.log('  ');
console.log('  ✓ Incomplete Detection:      ' + colorize(incompleteDetection + '%', incompleteDetection === 100 ? 'green' : 'red'));
console.log('    └─ Expected: 100%, catches partial analysis');
console.log('  ');

const criticalIssueCount = allTests.filter(t => t.issues.filter(i => i.severity === 'CRITICAL').length > 0).length;
const criticalDetectionScore = Math.abs(criticalIssueCount - 2) === 0 ? 100 : 0;
console.log('  ✓ Critical Issue Detection:  ' + colorize(criticalDetectionScore + '%', criticalDetectionScore === 100 ? 'green' : 'yellow'));
console.log('    └─ Expected: 2 critical issues detected (in generic & incomplete)');
console.log('');

// ═══════════════════════════════════════════════════════════════════
// FINAL VERDICT
// ═══════════════════════════════════════════════════════════════════

const allPassCorrectly = test1.passed && test2.passed && test3.passed;
const systemVerdict = allPassCorrectly ? 'EXEMPLARY' : (passedTests.length >= 2 ? 'ADEQUATE' : 'NEEDS WORK');
const verdictColor = systemVerdict === 'EXEMPLARY' ? 'green' : (systemVerdict === 'ADEQUATE' ? 'yellow' : 'red');

console.log(colorize('╔════════════════════════════════════════════════════════════════════════════╗', verdictColor));
console.log(colorize(`║                    🟢 FINAL VERDICT: ${systemVerdict}                              ║`, verdictColor));
console.log(colorize('╚════════════════════════════════════════════════════════════════════════════╝\n', verdictColor));

if (systemVerdict === 'EXEMPLARY') {
  console.log(colorize('✓ AI DEMONSTRATES NUMERICAL INTEGRITY', 'green'));
  console.log('  - Accurately calculates total P&L from trade data');
  console.log('  - Identifies loss state and profitability status');
  console.log('  - Provides actionable risk management advice');
  console.log('  - Avoids generic encouragement without analysis');
  console.log('  - System can reliably assess trader performance');
} else if (systemVerdict === 'ADEQUATE') {
  console.log(colorize('⚠️  AI HAS SOME NUMERICAL CAPABILITY', 'yellow'));
  console.log('  - May have gaps in calculation accuracy');
  console.log('  - Sometimes misses loss identification');
  console.log('  - Recommend: Add RAG verification layer');
} else {
  console.log(colorize('✗ AI LACKS NUMERICAL INTEGRITY', 'red'));
  console.log('  - Cannot reliably calculate trade P&L');
  console.log('  - May mislead users on profitability');
  console.log('  - Critical: Requires calculation fixes before production');
}

console.log();
process.exit(allPassCorrectly ? 0 : 1);
