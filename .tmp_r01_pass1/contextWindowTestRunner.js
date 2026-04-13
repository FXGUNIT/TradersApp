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

function generateMockUsers() {
  const users = [];
  const areaCodes = [
    '201', '212', '215', '302', '303', '304', '305', '307', '308', '309',
    '310', '312', '313', '314', '315', '316', '317', '318', '319', '320',
    '321', '323', '330', '334', '336', '337', '339', '340', '341', '346',
    '347', '351', '352', '360', '361', '364', '367', '369', '370', '372',
    '373', '374', '375', '376', '377', '378', '379', '380', '381',
  ];

  for (let index = 0; index < 49; index += 1) {
    const id = index + 1;
    users.push({
      uid: `user_${String(id).padStart(3, '0')}`,
      name: `User${id}`,
      email: `user${id}@traders.app`,
      phone: `+1-${areaCodes[index]}-555-${String(1100 + index).padStart(4, '0')}`,
      status: id % 3 === 0 ? 'ACTIVE' : 'PENDING',
      balance: 1000 + id * 750,
      joinDate: `2025-${String((id % 12) + 1).padStart(2, '0')}-${String((id % 28) + 1).padStart(2, '0')}`,
    });
  }

  users.splice(44, 0, {
    uid: 'user_045',
    name: 'Alice Johnson',
    email: 'alice.johnson@traders.app',
    phone: '+1-731-555-9748',
    status: 'ACTIVE',
    balance: 25000,
    joinDate: '2025-03-01',
  });

  return users;
}

const MOCK_USERS = generateMockUsers();
const TARGET_USER = MOCK_USERS.find((user) => user.phone.includes('731'));
const USER_QUERY =
  "From the list of users below, find the user with a phone number containing '731' and tell me their name and email.";

assert.equal(MOCK_USERS.length, 50, 'Expected exactly 50 mock users');
assert.ok(TARGET_USER, 'Target user with phone containing 731 must exist');
assert.equal(TARGET_USER.name, 'Alice Johnson', 'Expected Alice Johnson as target');

function generateAccurateResponse(users) {
  const target = users.find((user) => user.phone.includes('731'));
  return [
    "Found the user with phone number containing '731':",
    '',
    `Name: ${target.name}`,
    `Email: ${target.email}`,
    `Phone: ${target.phone}`,
    `Status: ${target.status}`,
    `Balance: $${target.balance}`,
  ].join('\n');
}

function generateWrongUserResponse() {
  return [
    "Found the user with phone number containing '731':",
    '',
    'Name: User049',
    'Email: user49@traders.app',
    'Phone: +1-381-555-1148',
    'Status: PENDING',
  ].join('\n');
}

function generateIncompleteResponse() {
  return [
    'I reviewed the 50-user list, but the requested phone pattern appears near the end.',
    "I cannot confidently identify the user with '731' from the provided data.",
    'Please provide a shorter list or more context.',
  ].join('\n');
}

function generateHallucinationResponse() {
  return [
    "Found the user with phone number containing '731':",
    '',
    'Name: David Chen',
    'Email: david.chen@traders.app',
    'Phone: +1-731-555-8432',
    'Status: VERIFIED',
    'Balance: $45000',
  ].join('\n');
}

function buildIssue(severity, check, message, evidence) {
  return { severity, check, message, evidence };
}

function checkContextIntegrity(aiResponse, userList) {
  const issues = [];
  const checks = {
    identifiesCorrectUser: false,
    correctName: false,
    correctEmail: false,
    maintainsContextEnd: false,
    noHallucination: false,
    completeAnswer: false,
  };

  const actualTarget = userList.find((user) => user.phone.includes('731'));
  const normalizedResponse = aiResponse.toLowerCase();
  const mentionedEmails =
    aiResponse.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
  const hallucinatedEmails = mentionedEmails.filter(
    (email) =>
      !userList.some((user) => user.email.toLowerCase() === email.toLowerCase()),
  );

  if (aiResponse.includes(actualTarget.name)) {
    checks.correctName = true;
  } else {
    issues.push(
      buildIssue(
        'CRITICAL',
        'Wrong User Identified',
        `Correct name "${actualTarget.name}" was not returned.`,
        aiResponse.split('\n')[0],
      ),
    );
  }

  if (aiResponse.includes(actualTarget.email)) {
    checks.correctEmail = true;
  } else {
    issues.push(
      buildIssue(
        'CRITICAL',
        'Contact Info Mismatch',
        `Correct email "${actualTarget.email}" was not returned.`,
        mentionedEmails[0] || 'No email detected',
      ),
    );
  }

  if (checks.correctName || checks.correctEmail) {
    checks.identifiesCorrectUser = true;
    checks.maintainsContextEnd = true;
  } else {
    issues.push(
      buildIssue(
        'HIGH',
        'Long Context Window',
        'The response did not retain the target user near the end of the list.',
        `Target position: 45 of ${userList.length}`,
      ),
    );
  }

  if (hallucinatedEmails.length === 0) {
    checks.noHallucination = true;
  } else {
    issues.push(
      buildIssue(
        'CRITICAL',
        'Hallucination Detection',
        'The response introduced email data that is not present in the source list.',
        hallucinatedEmails.join(', '),
      ),
    );
  }

  if (
    aiResponse.includes(actualTarget.name) &&
    aiResponse.includes(actualTarget.email) &&
    aiResponse.includes(actualTarget.phone)
  ) {
    checks.completeAnswer = true;
  } else {
    issues.push(
      buildIssue(
        'HIGH',
        'Incomplete Answer',
        'The response did not include the full requested identity payload.',
        JSON.stringify({
          hasName: aiResponse.includes(actualTarget.name),
          hasEmail: aiResponse.includes(actualTarget.email),
          hasPhone: aiResponse.includes(actualTarget.phone),
        }),
      ),
    );
  }

  if (
    normalizedResponse.includes('no user found') &&
    !normalizedResponse.includes(actualTarget.phone.toLowerCase())
  ) {
    issues.push(
      buildIssue(
        'CRITICAL',
        'Context Loss',
        'The response declined to answer despite the target being present.',
        aiResponse.split('\n')[0],
      ),
    );
  }

  const criticalIssues = issues.filter((issue) => issue.severity === 'CRITICAL');
  const score = Math.round(
    (Object.values(checks).filter(Boolean).length / Object.keys(checks).length) *
      100,
  );

  return {
    hasCriticalIssues: criticalIssues.length > 0,
    issues,
    checks,
    score,
    verdict:
      criticalIssues.length === 0
        ? colorize('PASS - CONTEXT MAINTAINED', 'green')
        : colorize('FAIL - CONTEXT LOSS DETECTED', 'red'),
  };
}

function printUserPreview(users) {
  console.log(colorize('\nUser Preview', 'blue'));
  console.log('[');
  users.slice(0, 5).forEach((user) => {
    console.log(
      `  { uid: "${user.uid}", name: "${user.name}", phone: "${user.phone}" },`,
    );
  });
  console.log('  ...');
  users.slice(43, 48).forEach((user) => {
    const marker = user.phone.includes('731') ? '  <- target' : '';
    console.log(
      `  { uid: "${user.uid}", name: "${user.name}", phone: "${user.phone}" },${marker}`,
    );
  });
  console.log(']');
}

function executeTest({ name, responseGenerator, expectedPass }) {
  console.log(colorize(`\n${name}`, 'cyan'));
  console.log('-'.repeat(name.length));
  console.log(`Users: ${MOCK_USERS.length}`);
  console.log(`Target: ${TARGET_USER.name} <${TARGET_USER.email}> at position 45`);
  console.log(`Query: ${USER_QUERY}`);
  printUserPreview(MOCK_USERS);

  const aiResponse = responseGenerator(MOCK_USERS);
  console.log(colorize('\nAI Response', 'blue'));
  console.log(aiResponse);

  const result = checkContextIntegrity(aiResponse, MOCK_USERS);
  const metExpectation = expectedPass
    ? !result.hasCriticalIssues
    : result.hasCriticalIssues;

  console.log(colorize(`\nIntegrity Verdict: ${result.verdict}`, 'cyan'));
  console.log(`Score: ${result.score}%`);

  if (result.issues.length > 0) {
    console.log(colorize('\nIssues', 'yellow'));
    result.issues.forEach((issue, index) => {
      const color = issue.severity === 'CRITICAL' ? 'red' : 'yellow';
      console.log(
        colorize(
          `  ${index + 1}. [${issue.severity}] ${issue.check}: ${issue.message}`,
          color,
        ),
      );
      console.log(`     Evidence: ${issue.evidence}`);
    });
  } else {
    console.log(colorize('\nNo issues found', 'green'));
  }

  console.log('\nChecks');
  console.log(
    `  Identifies correct user: ${result.checks.identifiesCorrectUser ? 'yes' : 'no'}`,
  );
  console.log(`  Correct name:           ${result.checks.correctName ? 'yes' : 'no'}`);
  console.log(`  Correct email:          ${result.checks.correctEmail ? 'yes' : 'no'}`);
  console.log(
    `  Maintains end context:  ${result.checks.maintainsContextEnd ? 'yes' : 'no'}`,
  );
  console.log(
    `  No hallucination:       ${result.checks.noHallucination ? 'yes' : 'no'}`,
  );
  console.log(`  Complete answer:        ${result.checks.completeAnswer ? 'yes' : 'no'}`);

  return {
    name,
    expectedPass,
    metExpectation,
    score: result.score,
    checks: result.checks,
    issues: result.issues,
  };
}

console.clear();
console.log(colorize('\nContext Window Integrity Test', 'magenta'));
console.log(colorize('Long-list retention across 50 users', 'magenta'));

const accurateTest = executeTest({
  name: 'Test 1: Accurate user lookup (expected pass)',
  responseGenerator: generateAccurateResponse,
  expectedPass: true,
});

const wrongUserTest = executeTest({
  name: 'Test 2: Wrong user returned (expected fail detection)',
  responseGenerator: generateWrongUserResponse,
  expectedPass: false,
});

const incompleteTest = executeTest({
  name: 'Test 3: Incomplete response (expected fail detection)',
  responseGenerator: generateIncompleteResponse,
  expectedPass: false,
});

const hallucinationTest = executeTest({
  name: 'Test 4: Hallucinated data (expected fail detection)',
  responseGenerator: generateHallucinationResponse,
  expectedPass: false,
});

const allTests = [
  accurateTest,
  wrongUserTest,
  incompleteTest,
  hallucinationTest,
];
const expectedFailureDetections = [wrongUserTest, incompleteTest, hallucinationTest]
  .filter((test) => test.metExpectation).length;
const allCorrect =
  accurateTest.metExpectation && expectedFailureDetections === 3;

console.log(colorize('\nSummary', 'cyan'));
console.log(`  Accurate response:      ${accurateTest.metExpectation ? colorize('PASS', 'green') : colorize('FAIL', 'red')} (${accurateTest.score}%)`);
console.log(`  Wrong-user detection:   ${wrongUserTest.metExpectation ? colorize('DETECTED', 'green') : colorize('MISSED', 'red')} (${wrongUserTest.score}%)`);
console.log(`  Incomplete detection:   ${incompleteTest.metExpectation ? colorize('DETECTED', 'green') : colorize('MISSED', 'red')} (${incompleteTest.score}%)`);
console.log(`  Hallucination detection:${hallucinationTest.metExpectation ? colorize('DETECTED', 'green') : colorize('MISSED', 'red')} (${hallucinationTest.score}%)`);

console.log(colorize('\nCritical Metrics', 'bold'));
console.log(`  Context retention:              ${colorize(accurateTest.checks.maintainsContextEnd ? '100%' : '0%', accurateTest.checks.maintainsContextEnd ? 'green' : 'red')}`);
console.log(`  Wrong-user detection rate:      ${colorize(wrongUserTest.metExpectation ? '100%' : '0%', wrongUserTest.metExpectation ? 'green' : 'red')}`);
console.log(`  Incomplete-response detection:  ${colorize(incompleteTest.metExpectation ? '100%' : '0%', incompleteTest.metExpectation ? 'green' : 'red')}`);
console.log(`  Hallucination detection rate:   ${colorize(hallucinationTest.metExpectation ? '100%' : '0%', hallucinationTest.metExpectation ? 'green' : 'red')}`);

const systemVerdict = allCorrect
  ? 'EXEMPLARY'
  : accurateTest.metExpectation
    ? 'ADEQUATE'
    : 'NEEDS WORK';
const verdictColor =
  systemVerdict === 'EXEMPLARY'
    ? 'green'
    : systemVerdict === 'ADEQUATE'
      ? 'yellow'
      : 'red';

console.log(
  colorize(`\nFinal Verdict: ${systemVerdict}`, verdictColor),
);

if (systemVerdict === 'EXEMPLARY') {
  console.log('The harness confirms that correct answers pass and the three bad-answer classes are detected.');
} else if (systemVerdict === 'ADEQUATE') {
  console.log('The accurate scenario passes, but one or more failure detections were missed.');
} else {
  console.log('The accurate scenario itself failed, so long-context retention is not reliable.');
}

assert.equal(allTests.length, 4, 'Expected four test scenarios');
process.exit(allCorrect ? 0 : 1);
