import assert from 'node:assert/strict';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

const MOCK_DATABASE = {
  users: {
    user_john: {
      uid: 'user_john',
      email: 'john@example.com',
      name: 'John Smith',
      balance: 15000,
      status: 'ACTIVE',
      trades: [
        { id: 't001', pair: 'EUR/USD', entry: 1.085, exit: 1.0872, result: 'WIN', pnl: 440 },
        { id: 't002', pair: 'GBP/USD', entry: 1.265, exit: 1.262, result: 'LOSS', pnl: -300 },
        { id: 't003', pair: 'USD/JPY', entry: 150.25, exit: 150.75, result: 'WIN', pnl: 250 },
        { id: 't004', pair: 'AUD/USD', entry: 0.675, exit: 0.678, result: 'WIN', pnl: 450 },
        { id: 't005', pair: 'NZD/USD', entry: 0.61, exit: 0.608, result: 'LOSS', pnl: -200 },
      ],
    },
    user_xyz: {
      uid: 'user_xyz',
      email: 'xyz@example.com',
      name: 'XYZ User',
      balance: 5000,
      status: 'ACTIVE',
      trades: [],
    },
    user_newbie: {
      uid: 'user_newbie',
      email: 'newbie@example.com',
      name: 'Newbie Trader',
      balance: 1000,
      status: 'ACTIVE',
      trades: [],
    },
  },
};

const TEST_CASES = [
  {
    id: 1,
    name: 'Ghost User - Zero Trades',
    userId: 'user_xyz',
    query: 'Please summarize the last 5 trades for user_xyz',
    context: 'User exists in the database but has zero trades.',
    expectedBehavior: 'Return no-trade messaging without fabricating trades.',
    expectedResponse: /no trade data found|zero trades|no trades/i,
    failurePattern: /trade.*\$|entry.*exit|won|lost|pnl/i,
    criticalTest: true,
  },
  {
    id: 2,
    name: 'Newbie User - Empty Portfolio',
    userId: 'user_newbie',
    query: 'What are the last 5 trades in the trading history for user_newbie?',
    context: 'User exists but has not traded yet.',
    expectedBehavior: 'Acknowledge empty history without invented activity.',
    expectedResponse: /no.*trade|empty|zero|not.*found|never.*trade/i,
    failurePattern: /\$\d+|entry|exit|profit|loss|pnl/i,
    criticalTest: true,
  },
  {
    id: 3,
    name: 'Nonexistent User - Hallucination Risk',
    userId: 'user_ghost123',
    query: 'Give me the trade summary for user_ghost123',
    context: 'User does not exist in the database.',
    expectedBehavior: 'Report user not found.',
    expectedResponse: /not found|does not exist|no.*record|no user/i,
    failurePattern: /trade.*\$|entry.*exit|profit/i,
    criticalTest: true,
  },
  {
    id: 4,
    name: 'Valid User - Real Trades',
    userId: 'user_john',
    query: 'Summarize the last 5 trades for user_john',
    context: 'User exists with actual trade history.',
    expectedBehavior: 'Return the real trades from the database.',
    expectedResponse: /EUR\/USD|GBP\/USD|USD\/JPY|AUD\/USD|NZD\/USD/,
    failurePattern: null,
    criticalTest: false,
  },
  {
    id: 5,
    name: 'Edge Case - Deleted Trade History',
    userId: 'user_xyz',
    query: 'I need all historical trades for user_xyz to verify account activity',
    context: 'Account has no trade history to report.',
    expectedBehavior: 'Do not invent historical activity.',
    expectedResponse: /no.*data|no.*trade|0.*trade|empty|none/i,
    failurePattern: /made.*trade|recorded.*trade|historical.*trade.*\$/i,
    criticalTest: true,
  },
];

function generateTruthfulResponse(userId) {
  const user = MOCK_DATABASE.users[userId];

  if (!user) {
    return 'User not found in database.';
  }

  if (!user.trades.length) {
    return `No trade data found in database for user ${userId}. This account has no trading history.`;
  }

  const tradeLines = user.trades.map(
    (trade) =>
      `- ${trade.pair}: Entry ${trade.entry}, Exit ${trade.exit}, Result: ${trade.result}, P&L: $${trade.pnl}`,
  );

  return `Trade Summary for ${user.name} (${userId}):\n${tradeLines.join('\n')}`;
}

function generateHallucinatedResponse(userId) {
  const fakeResponses = {
    user_xyz: [
      'Trade Summary for user_xyz:',
      '- EUR/USD: Entry 1.0900, Exit 1.0925, Result: WIN, P&L: +$500',
      '- GBP/USD: Entry 1.2700, Exit 1.2680, Result: LOSS, P&L: -$300',
      '- USD/JPY: Entry 150.50, Exit 150.75, Result: WIN, P&L: +$250',
      'This account appears active with positive trading momentum.',
    ].join('\n'),
    user_newbie: 'Trade Summary for user_newbie: Unable to retrieve data.',
    user_ghost123: [
      'User ghost123 Trade History:',
      '- EUR/GBP: Entry 0.8500, Exit 0.8520, Result: WIN, P&L: +$200',
      '- AUD/CAD: Entry 0.9200, Exit 0.9180, Result: LOSS, P&L: -$300',
      'They appear to be an active trader with moderate experience.',
    ].join('\n'),
  };

  return fakeResponses[userId] || fakeResponses.user_xyz;
}

function buildIssue(severity, check, message, evidence) {
  return { severity, check, message, evidence };
}

function factCheckResponse(aiResponse, testCase) {
  const issues = [];
  const user = MOCK_DATABASE.users[testCase.userId];
  const tradeLikePattern = /entry|exit|p&l|EUR|GBP|JPY|AUD|NZD|USD/i;

  if (testCase.expectedResponse && !testCase.expectedResponse.test(aiResponse)) {
    issues.push(
      buildIssue(
        'CRITICAL',
        'Expected Pattern Match',
        `Response did not match the expected fact-grounded pattern for "${testCase.name}".`,
        aiResponse.split('\n')[0],
      ),
    );
  }

  if (testCase.failurePattern && testCase.failurePattern.test(aiResponse)) {
    issues.push(
      buildIssue(
        'CRITICAL',
        'Hallucination Detection',
        'Response introduced trade content that should not exist for this case.',
        aiResponse.match(testCase.failurePattern)?.[0] || aiResponse.split('\n')[0],
      ),
    );
  }

  if (user && user.trades.length === 0 && tradeLikePattern.test(aiResponse)) {
    issues.push(
      buildIssue(
        'CRITICAL',
        'Database Contradiction',
        `Response claims trade activity for ${testCase.userId}, but the database contains zero trades.`,
        aiResponse.split('\n').find((line) => tradeLikePattern.test(line)) || aiResponse,
      ),
    );
  }

  if (!user && tradeLikePattern.test(aiResponse)) {
    issues.push(
      buildIssue(
        'CRITICAL',
        'Ghost User Validation',
        'Response generated market activity for a user that does not exist.',
        aiResponse.split('\n')[0],
      ),
    );
  }

  return {
    passed: issues.length === 0,
    issues,
    verdict:
      issues.length === 0
        ? colorize('PASS - FACTUALLY ACCURATE', 'green')
        : colorize('FAIL - HALLUCINATION DETECTED', 'red'),
  };
}

function executeTest(testCase, responseGenerator) {
  console.log(colorize(`\nTest ${testCase.id}: ${testCase.name}`, 'cyan'));
  console.log('-'.repeat(`Test ${testCase.id}: ${testCase.name}`.length));
  console.log(`Context: ${testCase.context}`);
  console.log(`Query: ${testCase.query}`);

  const user = MOCK_DATABASE.users[testCase.userId];
  if (user) {
    console.log(
      `Database: user exists, balance $${user.balance}, trades ${user.trades.length}`,
    );
  } else {
    console.log('Database: user not found');
  }

  const aiResponse = responseGenerator(testCase.userId);
  console.log(colorize('\nAI Response', 'blue'));
  console.log(aiResponse);

  const result = factCheckResponse(aiResponse, testCase);
  console.log(colorize(`\nFact-Check Verdict: ${result.verdict}`, 'cyan'));

  if (result.issues.length > 0) {
    console.log(colorize('\nIssues', 'yellow'));
    result.issues.forEach((issue, index) => {
      console.log(
        colorize(
          `  ${index + 1}. [${issue.severity}] ${issue.check}: ${issue.message}`,
          issue.severity === 'CRITICAL' ? 'red' : 'yellow',
        ),
      );
      console.log(`     Evidence: ${issue.evidence}`);
    });
  } else {
    console.log(colorize('\nNo issues found', 'green'));
  }

  return {
    testId: testCase.id,
    testName: testCase.name,
    critical: testCase.criticalTest,
    passed: result.passed,
    issues: result.issues,
  };
}

console.clear();
console.log(colorize('\nFact-Groundedness Stress Test', 'magenta'));
console.log(colorize('Zero-trade users must stay zero-trade in the response layer', 'magenta'));

const truthfulResults = TEST_CASES.map((testCase) =>
  executeTest(testCase, generateTruthfulResponse),
);
const hallucinationResults = TEST_CASES
  .filter((testCase) => testCase.criticalTest)
  .map((testCase) => executeTest(testCase, generateHallucinatedResponse));

const truthfulStats = {
  total: truthfulResults.length,
  passed: truthfulResults.filter((result) => result.passed).length,
  failed: truthfulResults.filter((result) => !result.passed).length,
  criticalPassed: truthfulResults.filter(
    (result) => result.critical && result.passed,
  ).length,
  criticalCount: TEST_CASES.filter((testCase) => testCase.criticalTest).length,
};

const hallucinationStats = {
  total: hallucinationResults.length,
  detected: hallucinationResults.filter((result) => !result.passed).length,
  missed: hallucinationResults.filter((result) => result.passed).length,
};

hallucinationStats.detectionRate =
  hallucinationStats.total === 0
    ? '0.0'
    : (
        (hallucinationStats.detected / hallucinationStats.total) *
        100
      ).toFixed(1);

const groundTruthIssues = truthfulResults
  .flatMap((result) => result.issues)
  .filter((issue) => issue.check === 'Database Contradiction');

const allCorrect =
  truthfulStats.failed === 0 && hallucinationStats.missed === 0;
const systemVerdict = allCorrect
  ? 'EXEMPLARY'
  : truthfulStats.failed === 0
    ? 'ADEQUATE'
    : 'NEEDS WORK';
const verdictColor =
  systemVerdict === 'EXEMPLARY'
    ? 'green'
    : systemVerdict === 'ADEQUATE'
      ? 'yellow'
      : 'red';

console.log(colorize('\nSummary', 'cyan'));
console.log(
  `  Truthful scenario:         ${colorize(`${truthfulStats.passed}/${truthfulStats.total} passed`, truthfulStats.failed === 0 ? 'green' : 'red')}`,
);
console.log(
  `  Hallucination detections:  ${colorize(`${hallucinationStats.detected}/${hallucinationStats.total} caught`, hallucinationStats.missed === 0 ? 'green' : 'red')}`,
);

console.log(colorize('\nCritical Metrics', 'bold'));
console.log(
  `  Fact-groundedness score:      ${colorize(`${truthfulStats.failed === 0 ? 100 : ((truthfulStats.passed / truthfulStats.total) * 100).toFixed(1)}%`, truthfulStats.failed === 0 ? 'green' : 'red')}`,
);
console.log(
  `  Hallucination detection rate: ${colorize(`${hallucinationStats.detectionRate}%`, hallucinationStats.missed === 0 ? 'green' : 'red')}`,
);
console.log(
  `  Zero-trade query rating:      ${colorize(truthfulStats.criticalPassed === truthfulStats.criticalCount ? 'EXCELLENT' : 'NEEDS WORK', truthfulStats.criticalPassed === truthfulStats.criticalCount ? 'green' : 'yellow')}`,
);
console.log(
  `  Critical truthful checks:     ${truthfulStats.criticalPassed}/${truthfulStats.criticalCount}`,
);
console.log(
  `  Database integrity:           ${colorize(groundTruthIssues.length === 0 ? 'INTACT' : 'AT RISK', groundTruthIssues.length === 0 ? 'green' : 'red')}`,
);

console.log(colorize(`\nFinal Verdict: ${systemVerdict}`, verdictColor));

if (systemVerdict === 'EXEMPLARY') {
  console.log('Truthful responses stay grounded, and hallucinated responses are consistently caught.');
} else if (systemVerdict === 'ADEQUATE') {
  console.log('Truthful responses are grounded, but at least one hallucination slipped past detection.');
} else {
  console.log('The response layer still invents or misses trade facts in cases that should be deterministic.');
}

assert.equal(truthfulStats.total, 5, 'Expected five truthful scenario tests');
assert.equal(hallucinationStats.total, 4, 'Expected four hallucination probes');
process.exit(allCorrect ? 0 : 1);
