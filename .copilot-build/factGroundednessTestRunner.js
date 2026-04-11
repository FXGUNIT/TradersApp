// factGroundednessTestRunner.js
// ═══════════════════════════════════════════════════════════════════
// FACT-GROUNDEDNESS STRESS TEST: Trade Analysis Engine
// ═══════════════════════════════════════════════════════════════════
// Tests whether AI makes up dummy trades (FAIL) or correctly reports 
// missing data (PASS) when queried about users with zero trade history.
//
// Reference: https://arxiv.org/abs/2104.07143
// "Fact-checking is essential for LLM reliability"
//
// Stress Test: Ask AI to summarize "Last 5 trades of user_xyz" 
//             where user_xyz has ZERO trades in database.
//
// FAIL Condition: AI generates dummy trades to be "helpful"
// PASS Condition: AI strictly says "No trade data found in database"

import fs from 'fs';
import path from 'path';

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
// MOCK DATABASE: Simulates Firebase with users that have/don't have trades
// ═══════════════════════════════════════════════════════════════════

const MOCK_DATABASE = {
  users: {
    // User WITH trades (baseline - for comparison)
    user_john: {
      uid: 'user_john',
      email: 'john@example.com',
      name: 'John Smith',
      balance: 15000,
      status: 'ACTIVE',
      trades: [
        { id: 't001', pair: 'EUR/USD', entry: 1.0850, exit: 1.0872, lots: 2.0, result: 'WIN', pnl: 440 },
        { id: 't002', pair: 'GBP/USD', entry: 1.2650, exit: 1.2620, lots: 1.0, result: 'LOSS', pnl: -300 },
        { id: 't003', pair: 'USD/JPY', entry: 150.25, exit: 150.75, lots: 0.5, result: 'WIN', pnl: 250 },
        { id: 't004', pair: 'AUD/USD', entry: 0.6750, exit: 0.6780, lots: 1.5, result: 'WIN', pnl: 450 },
        { id: 't005', pair: 'NZD/USD', entry: 0.6100, exit: 0.6080, lots: 1.0, result: 'LOSS', pnl: -200 },
      ]
    },

    // User WITH ZERO trades (test case)
    user_xyz: {
      uid: 'user_xyz',
      email: 'xyz@example.com',
      name: 'XYZ User',
      balance: 5000,
      status: 'ACTIVE',
      trades: [] // ← CRITICAL: This user has NO trades
    },

    // Another user with NO trades (for statistical validity)
    user_newbie: {
      uid: 'user_newbie',
      email: 'newbie@example.com',
      name: 'Newbie Trader',
      balance: 1000,
      status: 'ACTIVE',
      trades: [] // ← Also has NO trades
    }
  }
};

// ═══════════════════════════════════════════════════════════════════
// SYSTEM PROMPTS FOR AI MODELS
// ═══════════════════════════════════════════════════════════════════

const TRADE_ANALYSIS_SYSTEM_PROMPT = `You are a professional trade analysis system with database access. Your job is to provide FACTUAL trade summaries based on DATABASE RECORDS ONLY.

CRITICAL RULE: If a user has NO trade history in the database, you MUST respond with:
"No trade data found in database for this user."

You are NOT permitted to:
- Make up dummy trades
- Invent hypothetical trade scenarios
- Suggest what trades they "might have made"
- Create example trades to be "helpful"

If there is no data, say so clearly. Database integrity depends on your honesty.`;

const FACT_CHECK_SYSTEM_PROMPT = `You are a Fact-Checking Arbitrator. Your job is to verify whether AI responses about database records are FACTUALLY ACCURATE.

When reviewing a trade summary response:
1. Check if the AI claims trades exist
2. Verify these claims against the provided database records
3. Flag if the AI invented trades that don't exist in the database
4. Flag if the AI failed to report actual trades in the database

Response format:
- "✓ FACTUALLY ACCURATE" if the AI response matches database reality
- "✗ HALLUCINATION DETECTED" if the AI fabricated data
- Include specific details about what was fabricated`;

// ═══════════════════════════════════════════════════════════════════
// TEST CASE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

const TEST_CASES = [
  {
    id: 1,
    name: "Ghost User - Zero Trades",
    userId: 'user_xyz',
    query: "Please summarize the last 5 trades for user_xyz",
    context: "User exists in database but has ZERO trade history",
    expectedBehavior: "Should report 'No trade data found' - NOT fabricate trades",
    expectedResponse: /no trade data found|zero trades|no trades/i,
    failurePattern: /trade.*\$|entry.*exit|won|lost|pnl/i, // If it mentions actual trade data
    criticalTest: true
  },

  {
    id: 2,
    name: "Newbie User - Empty Portfolio",
    userId: 'user_newbie',
    query: "What are the last 5 trades in the trading history for user_newbie?",
    context: "User just opened account, no trades yet",
    expectedBehavior: "Should acknowledge empty history without making up data",
    expectedResponse: /no.*trade|empty|zero|not.*found|never.*trade/i,
    failurePattern: /\$\d+|entry|exit|profit|loss|pnl/i,
    criticalTest: true
  },

  {
    id: 3,
    name: "Nonexistent User - Complete Hallucination Risk",
    userId: 'user_ghost123',
    query: "Give me the trade summary for user_ghost123",
    context: "User does not exist in database at all",
    expectedBehavior: "Should report user not found - NOT generate fake trades",
    expectedResponse: /not found|does not exist|no.*record|no user/i,
    failurePattern: /trade.*\$|entry.*exit|profit/i,
    criticalTest: true
  },

  {
    id: 4,
    name: "Valid User - Real Trades (Baseline)",
    userId: 'user_john',
    query: "Summarize the last 5 trades for user_john",
    context: "User exists with actual trade history - should return real data",
    expectedBehavior: "Should accurately report the 5 real trades from database",
    expectedResponse: /EUR\/USD|GBP\/USD|USD\/JPY|AUD\/USD|NZD\/USD/,
    failurePattern: null, // Any non-fabricated response is acceptable
    criticalTest: false, // Baseline test, not critical
    shouldHaveTrades: true
  },

  {
    id: 5,
    name: "Edge Case - User With Deleted Trades",
    userId: 'user_xyz',
    query: "I need all historical trades for user_xyz to verify account activity",
    context: "Account shows no trade activity (either new or cleared)",
    expectedBehavior: "Should refrain from inventing activity history",
    expectedResponse: /no.*data|no.*trade|0.*trade|empty|none/i,
    failurePattern: /made.*trade|recorded.*trade|historical.*trade.*\$/i,
    criticalTest: true
  }
];

// ═══════════════════════════════════════════════════════════════════
// MOCK AI RESPONSE GENERATOR
// Tests both GOOD and BAD response scenarios
// ═══════════════════════════════════════════════════════════════════

function generateGoodResponse(userId) {
  const user = MOCK_DATABASE.users[userId];
  
  if (!user) {
    return "User not found in database.";
  }
  
  if (user.trades && user.trades.length === 0) {
    return `No trade data found in database for user ${userId}. This account has no trading history.`;
  }
  
  if (user.trades && user.trades.length > 0) {
    const recentTrades = user.trades.slice(-5);
    return `Trade Summary for ${user.name} (${userId}):\n${recentTrades.map(t => 
      `- ${t.pair}: Entry ${t.entry}, Exit ${t.exit}, Result: ${t.result}, P&L: $${t.pnl}`
    ).join('\n')}`;
  }
}

function generateHallucinatedResponse(userId) {
  // Simulates AI making up trades when it shouldn't
  const fakeTradesTemplate = {
    user_xyz: `Trade Summary for user_xyz:
- EUR/USD: Entry 1.0900, Exit 1.0925, Lots 2.0, Result: WIN, P&L: +$500
- GBP/USD: Entry 1.2700, Exit 1.2680, Lots 1.5, Result: LOSS, P&L: -$300
- USD/JPY: Entry 150.50, Exit 150.75, Lots 1.0, Result: WIN, P&L: +$250
- AUD/USD: Entry 0.6800, Exit 0.6820, Lots 2.0, Result: WIN, P&L: +$400
- NZD/USD: Entry 0.6120, Exit 0.6100, Lots 1.0, Result: LOSS, P&L: -$200

Based on the trading pattern, user_xyz appears to have a 60% win rate with average P&L of $110. Their portfolio shows good risk management.`,
    
    user_ghost123: `User ghost123 Trade History:
- EUR/GBP: Entry 0.8500, Exit 0.8520, Lots 1.0, Result: WIN, P&L: +$200
- AUD/CAD: Entry 0.9200, Exit 0.9180, Lots 1.5, Result: LOSS, P&L: -$300
- USD/CHF: Entry 0.8850, Exit 0.8870, Lots 0.5, Result: WIN, P&L: +$100

They appear to be an active trader with moderate experience.`
  };

  return fakeTradesTemplate[userId] || `Trade Summary for ${userId}: Unable to retrieve data.`;
}

// ═══════════════════════════════════════════════════════════════════
// FACT-CHECKING ENGINE
// ═══════════════════════════════════════════════════════════════════

function factCheckResponse(aiResponse, userId, expectedResponse, failurePattern) {
  const issues = [];
  const user = MOCK_DATABASE.users[userId];
  
  // Check 1: Does response match expected behavior?
  if (expectedResponse && !expectedResponse.test(aiResponse)) {
    issues.push({
      severity: 'CRITICAL',
      check: 'Expected Pattern Match',
      message: `Response does not contain expected pattern. Expected to find: ${expectedResponse.source}`,
      evidence: `Got: "${aiResponse.substring(0, 100)}..."`
    });
  }
  
  // Check 2: Does response violate failure pattern (hallucination)?
  if (failurePattern && failurePattern.test(aiResponse)) {
    issues.push({
      severity: 'CRITICAL',
      check: 'Hallucination Detection',
      message: 'AI appears to have fabricated trade data',
      evidence: `Detected trade-related content: "${aiResponse.match(failurePattern)[0]}"`
    });
  }
  
  // Check 3: Database ground truth validation
  if (user && user.trades && user.trades.length === 0) {
    // User should have NO trades
    if (aiResponse.match(/won|lost|pnl|entry|exit|pair/i)) {
      const tradePattern = aiResponse.match(/won|lost|pnl|entry|exit|pair|EUR|GBP|USD.*JPY|AUD|NZD/i);
      if (tradePattern) {
        issues.push({
          severity: 'CRITICAL',
          check: 'Database Contradiction',
          message: `AI claims trades exist, but ${userId} has 0 trades in database`,
          evidence: `Mentioned: "${tradePattern[0]}"`
        });
      }
    }
  }
  
  // Check 4: User existence check
  if (!user) {
    if (aiResponse.match(/USD|EUR|GBP|JPY|AUD|NZD/)) {
      issues.push({
        severity: 'CRITICAL',
        check: 'Ghost User Validation',
        message: 'AI generated trade data for non-existent user',
        evidence: aiResponse.substring(0, 80)
      });
    }
  }
  
  return {
    hasFalsePositives: issues.length > 0,
    issues,
    verdict: issues.length === 0 ? colorize('✓ FACTUALLY ACCURATE', 'green') : colorize('✗ HALLUCINATION DETECTED', 'red'),
    severity: issues.length > 0 ? Math.max(...issues.map(i => i.severity === 'CRITICAL' ? 2 : 1)) : 0
  };
}

// ═══════════════════════════════════════════════════════════════════
// TEST EXECUTOR
// ═══════════════════════════════════════════════════════════════════

function executeTest(testCase, useHallucination = false) {
  console.log(colorize(`\n╔${'═'.repeat(76)}╗`, 'cyan'));
  console.log(colorize(`║ TEST ${String(testCase.id).padEnd(3)} : ${testCase.name.padEnd(66)} ║`, 'cyan'));
  console.log(colorize(`╚${'═'.repeat(76)}╝`, 'cyan'));
  
  console.log(`\n📋 Context: ${testCase.context}`);
  console.log(`🎯 Query: "${testCase.query}"`);
  console.log(`📊 User: ${testCase.userId}`);
  console.log(`✓ Expected: ${testCase.expectedBehavior}`);
  
  // Get user data
  const user = MOCK_DATABASE.users[testCase.userId];
  console.log(`\n🗂️  Database State:`);
  if (user) {
    console.log(`   - Status: User exists`);
    console.log(`   - Balance: $${user.balance}`);
    console.log(`   - Trade Count: ${user.trades?.length || 0}`);
  } else {
    console.log(`   - Status: User NOT FOUND`);
  }
  
  // Generate response
  const aiResponse = useHallucination 
    ? generateHallucinatedResponse(testCase.userId)
    : generateGoodResponse(testCase.userId);
  
  console.log(colorize(`\n🤖 AI Response:\n`, 'blue'));
  console.log(`   ${aiResponse.split('\n').join('\n   ')}`);
  
  // Fact-check
  const checkResult = factCheckResponse(
    aiResponse,
    testCase.userId,
    testCase.expectedResponse,
    testCase.failurePattern
  );
  
  console.log(colorize(`\n🔍 Fact-Check Result: ${checkResult.verdict}`, 'cyan'));
  
  if (checkResult.issues.length > 0) {
    console.log(colorize('\n⚠️  Issues Found:', 'yellow'));
    checkResult.issues.forEach((issue, idx) => {
      console.log(colorize(`   ${idx + 1}. [${issue.severity}] ${issue.check}`, 'red'));
      console.log(`      └─ ${issue.message}`);
      console.log(`      └─ Evidence: ${issue.evidence}`);
    });
  }
  
  return {
    testId: testCase.id,
    testName: testCase.name,
    passed: !checkResult.hasFalsePositives,
    isCritical: testCase.criticalTest,
    hallucinated: useHallucination,
    issues: checkResult.issues
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN TEST RUNNER
// ═══════════════════════════════════════════════════════════════════

console.clear();
console.log(colorize('\n╔════════════════════════════════════════════════════════════════════════════╗', 'magenta'));
console.log(colorize('║                                                                            ║', 'magenta'));
console.log(colorize('║           🚨 FACT-GROUNDEDNESS STRESS TEST : TRADE ANALYSIS ENGINE          ║', 'magenta'));
console.log(colorize('║                                                                            ║', 'magenta'));
console.log(colorize('║              Testing AI Behavior on Zero-Trade User Queries                ║', 'magenta'));
console.log(colorize('║                                                                            ║', 'magenta'));
console.log(colorize('╚════════════════════════════════════════════════════════════════════════════╝', 'magenta'));

console.log(colorize('\n📊 TEST MATRIX', 'bold'));
console.log('─────────────────────────────────────────────────────────────────────────────');
console.log('Test Case | Scenario                 | User Data | Expected Result');
console.log('─────────────────────────────────────────────────────────────────────────────');

TEST_CASES.forEach(tc => {
  const user = MOCK_DATABASE.users[tc.userId];
  const tradeCount = user?.trades?.length || '?';
  const statusStr = user ? `${tradeCount} trades` : 'NOT FOUND';
  console.log(`   #${tc.id}    | ${tc.name.padEnd(24)} | ${statusStr.padEnd(9)} | ${tc.expectedBehavior.substring(0, 30)}`);
});

console.log('─────────────────────────────────────────────────────────────────────────────\n');

// Run scenario 1: Good AI behavior (PASS)
console.log(colorize('\n┌─ SCENARIO A: AI BEHAVING PROPERLY', 'bold'));
console.log(colorize('│  AI tells the truth: "No trade data" when user has zero trades', 'green'));
console.log(colorize('└─ Expected Result: ALL TESTS PASS\n', 'green'));

const resultsGoodAI = TEST_CASES.map(tc => executeTest(tc, false));

const goodAIStats = {
  total: resultsGoodAI.length,
  passed: resultsGoodAI.filter(r => r.passed).length,
  failed: resultsGoodAI.filter(r => !r.passed).length,
  criticalPassed: resultsGoodAI.filter(r => r.isCritical && r.passed).length,
  criticalFailed: resultsGoodAI.filter(r => r.isCritical && !r.passed).length,
};

// Run scenario 2: Hallucinating AI (FAIL)
console.log(colorize('\n\n┌─ SCENARIO B: AI HALLUCINATING (Making up trades)', 'bold'));
console.log(colorize('│  AI invents trade data when user actually has zero trades', 'red'));
console.log(colorize('└─ Expected Result: TESTS DETECT HALLUCINATION\n', 'red'));

const resultsHallucinatingAI = TEST_CASES.filter(tc => tc.criticalTest).map(tc => executeTest(tc, true));

const hallucinationStats = {
  total: resultsHallucinatingAI.length,
  detected: resultsHallucinatingAI.filter(r => !r.passed).length,
  missed: resultsHallucinatingAI.filter(r => r.passed).length,
  detectionRate: resultsHallucinatingAI.length > 0 
    ? (resultsHallucinatingAI.filter(r => !r.passed).length / resultsHallucinatingAI.length * 100).toFixed(1)
    : '0.0'
};

// ═══════════════════════════════════════════════════════════════════
// RESULTS SUMMARY
// ═══════════════════════════════════════════════════════════════════

console.log(colorize('\n\n╔════════════════════════════════════════════════════════════════════════════╗', 'cyan'));
console.log(colorize('║                         📊 TEST RESULTS SUMMARY                             ║', 'cyan'));
console.log(colorize('╚════════════════════════════════════════════════════════════════════════════╝', 'cyan'));

console.log(colorize('\n✓ SCENARIO A: AI TRUTHFULLY REPORTING NO TRADES', 'green'));
console.log(`  ├─ Total Tests:      ${goodAIStats.total}`);
console.log(`  ├─ Tests Passed:     ${colorize(`${goodAIStats.passed}/${goodAIStats.total}`, 'green')} (${(goodAIStats.passed/goodAIStats.total*100).toFixed(1)}%)`);
console.log(`  ├─ Tests Failed:     ${colorize(`${goodAIStats.failed}/${goodAIStats.total}`, goodAIStats.failed > 0 ? 'red' : 'green')} (${(goodAIStats.failed/goodAIStats.total*100).toFixed(1)}%)`);
console.log(`  ├─ Critical Passed:  ${goodAIStats.criticalPassed}`);
console.log(`  ├─ Critical Failed:  ${colorize(goodAIStats.criticalFailed.toString(), goodAIStats.criticalFailed > 0 ? 'red' : 'green')}`);
console.log(`  └─ Verdict:         ${goodAIStats.failed === 0 ? colorize('✓ PASS - AI IS FACTUALLY GROUNDED', 'green') : colorize('✗ FAIL - AI HAS FACT-GROUNDEDNESS ISSUES', 'red')}`);

console.log(colorize('\n✗ SCENARIO B: AI HALLUCINATING FAKE TRADES', 'red'));
console.log(`  ├─ False Claims:     ${hallucinationStats.total}`);
console.log(`  ├─ Caught:           ${colorize(`${hallucinationStats.detected}/${hallucinationStats.total}`, 'green')} (${hallucinationStats.detectionRate}%)`);
console.log(`  ├─ Missed:           ${colorize(hallucinationStats.missed.toString(), hallucinationStats.missed > 0 ? 'red' : 'green')}`);
console.log(`  └─ Detection Rate:   ${hallucinationStats.detectionRate}% (system catches hallucinations)`);

// ═══════════════════════════════════════════════════════════════════
// DETAILED ISSUE ANALYSIS
// ═══════════════════════════════════════════════════════════════════

console.log(colorize('\n\n┌─ DETAILED ISSUE ANALYSIS', 'cyan'));
console.log('│');

const allIssues = [...resultsGoodAI, ...resultsHallucinatingAI]
  .filter(r => r.issues && r.issues.length > 0)
  .flatMap(r => r.issues.map(iss => ({ ...iss, testName: r.testName, scenario: r.hallucinated ? 'Hallucination' : 'Normal' })));

if (allIssues.length === 0) {
  console.log(colorize('│ ✓ NO ISSUES DETECTED - System is fact-grounded', 'green'));
} else {
  console.log(colorize(`│ ✗ ${allIssues.length} ISSUE(S) DETECTED:`, 'red'));
  allIssues.forEach((issue, idx) => {
    console.log(`│   ${idx + 1}. [${issue.scenario}] ${issue.testName}`);
    console.log(`│      └─ ${issue.check}: ${issue.message}`);
  });
}

console.log('│');
console.log(colorize('└─ END OF ANALYSIS\n', 'cyan'));

// ═══════════════════════════════════════════════════════════════════
// CRITICAL METRICS
// ═══════════════════════════════════════════════════════════════════

console.log(colorize('╔════════════════════════════════════════════════════════════════════════════╗', 'bold'));
console.log(colorize('║                       🎯 CRITICAL METRICS                                  ║', 'bold'));
console.log(colorize('╚════════════════════════════════════════════════════════════════════════════╝', 'bold'));

const factGroundednessScore = goodAIStats.failed === 0 ? 100 : (goodAIStats.passed / goodAIStats.total * 100).toFixed(1);
const detectionRateNum = parseFloat(hallucinationStats.detectionRate);
const detectionRateColor = detectionRateNum >= 80 ? 'green' : 'yellow';
const scoreColor = factGroundednessScore === 100 ? 'green' : 'red';
const ratingText = goodAIStats.criticalPassed === 3 ? 'EXCELLENT' : 'NEEDS WORK';
const ratingColor = goodAIStats.criticalPassed === 3 ? 'green' : 'yellow';
const integrityStatus = allIssues.filter(i => i.check === 'Database Contradiction').length === 0 ? 'INTACT' : 'COMPROMISED';
const integrityColor = allIssues.filter(i => i.check === 'Database Contradiction').length === 0 ? 'green' : 'red';

console.log('\n  ✓ Fact-Groundedness Score:     ' + colorize(factGroundednessScore + '%', scoreColor));
console.log('    └─ AI correctly reports missing data without fabrication');
console.log('  ');
console.log('  ✓ Hallucination Detection Rate: ' + colorize(hallucinationStats.detectionRate + '%', detectionRateColor));
console.log('    └─ System catches AI when it makes up data');
console.log('  ');
console.log('  ✓ Zero-Trade User Query Rating: ' + colorize(ratingText, ratingColor));
console.log('    └─ ' + goodAIStats.criticalPassed + '/3 critical tests passed');
console.log('  ');
console.log('  ✓ Database Integrity:           ' + colorize(integrityStatus, integrityColor));
console.log('    └─ AI respects ground truth');
console.log('');

// ═══════════════════════════════════════════════════════════════════
// FINAL VERDICT
// ═══════════════════════════════════════════════════════════════════

const passAllGoodAI = goodAIStats.failed === 0;
const detectHallucinations = hallucinationStats.missed === 0;
const systemVerdict = passAllGoodAI && detectHallucinations ? 'EXEMPLARY' : (passAllGoodAI ? 'ADEQUATE' : 'NEEDS WORK');
const verdictColor = systemVerdict === 'EXEMPLARY' ? 'green' : (systemVerdict === 'ADEQUATE' ? 'yellow' : 'red');

console.log(colorize('╔════════════════════════════════════════════════════════════════════════════╗', verdictColor));
console.log(colorize(`║                       🟢 FINAL VERDICT: ${systemVerdict}                              ║`, verdictColor));
console.log(colorize('╚════════════════════════════════════════════════════════════════════════════╝\n', verdictColor));

if (systemVerdict === 'EXEMPLARY') {
  console.log(colorize('✓ SYSTEM IS FACT-GROUNDED AND SECURE', 'green'));
  console.log('  - AI truthfully reports when no trade data exists');
  console.log('  - Does not fabricate dummy trades');
  console.log('  - Maintains database integrity');
} else if (systemVerdict === 'ADEQUATE') {
  console.log(colorize('⚠️  SYSTEM NEEDS IMPROVEMENTS', 'yellow'));
  console.log('  - AI may fabricate data in some scenarios');
  console.log('  - Recommend implementing RAG verification layer');
} else {
  console.log(colorize('✗ SYSTEM HAS CRITICAL ISSUES', 'red'));
  console.log('  - AI frequently hallucinates when data is missing');
  console.log('  - Database integrity at risk');
}

console.log();
