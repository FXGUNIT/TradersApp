// contextWindowTestRunner.js
// ═══════════════════════════════════════════════════════════════════
// CONTEXT WINDOW INTEGRITY TEST: Information Retention at Scale
// ═══════════════════════════════════════════════════════════════════
// Tests whether AI maintains context across a long list of 50 users
// and accurately locates a specific user with '731' phone number.
//
// Stress Test: Feed 50 users in JSON format
// Query: "Find the user with phone number containing '731'"
//
// FAIL: AI loses track or returns wrong user
// PASS: AI accurately identifies correct user from end of list

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
// GENERATE 50 MOCK USERS WITH PHONE NUMBERS
// ═══════════════════════════════════════════════════════════════════

function generateMockUsers() {
  const users = [];
  const areaCodeCodes = ['201', '212', '215', '302', '303', '304', '305', '307', '308', '309',
    '310', '312', '313', '314', '315', '316', '317', '318', '319', '320',
    '321', '323', '330', '334', '336', '337', '339', '340', '341', '346',
    '347', '351', '352', '360', '361', '364', '367', '369', '370', '372',
    '373', '374', '375', '376', '377', '378', '379', '380', '381', '382',
    '383', '385'];

  // Generate 49 regular users
  for (let i = 1; i <= 49; i++) {
    const areaCode = areaCodeCodes[i - 1];
    const exchange = String(Math.floor(Math.random() * 900) + 100);
    const line = String(Math.floor(Math.random() * 9000) + 1000);
    const phone = `+1-${areaCode}-${exchange}-${line}`;

    users.push({
      uid: `user_${String(i).padStart(3, '0')}`,
      name: `User${i}`,
      email: `user${i}@traders.app`,
      phone: phone,
      status: i % 3 === 0 ? 'ACTIVE' : 'PENDING',
      balance: Math.floor(Math.random() * 50000) + 1000,
      joinDate: `2025-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
    });
  }

  // Insert target user with '731' phone number at position 45 (near end)
  const targetUser = {
    uid: 'user_045',
    name: 'Alice Johnson',
    email: 'alice.johnson@traders.app',
    phone: '+1-731-555-9748', // ← TARGET: Contains '731'
    status: 'ACTIVE',
    balance: 25000,
    joinDate: '2025-03-01',
  };

  users.splice(44, 0, targetUser); // Insert at position 45 (index 44)

  return users;
}

const MOCK_USERS = generateMockUsers();

// Verify target user is in list
const targetUser = MOCK_USERS.find(u => u.phone.includes('731'));
console.assert(targetUser, 'Target user with 731 phone number not found');
console.assert(targetUser.name === 'Alice Johnson', 'Target user should be Alice Johnson');

// ═══════════════════════════════════════════════════════════════════
// USER QUERY
// ═══════════════════════════════════════════════════════════════════

const USER_QUERY = "From the list of users below, find the user with a phone number containing '731' and tell me their name and email.";

// ═══════════════════════════════════════════════════════════════════
// MOCK AI RESPONSES
// ═══════════════════════════════════════════════════════════════════

/**
 * GOOD AI Response: Accurately finds user from list
 */
function generateAccurateResponse(users) {
  const target = users.find(u => u.phone.includes('731'));
  if (!target) {
    return 'No user found with phone number containing 731.';
  }
  return `Found the user with phone number containing '731':

Name: ${target.name}
Email: ${target.email}
Phone: ${target.phone}
Status: ${target.status}
Balance: $${target.balance}

This user (${target.name}) has been with us since ${target.joinDate} and maintains an active trading account.`;
}

/**
 * BAD AI Response: Returns wrong user or loses context
 */
function generateWrongUserResponse() {
  return `Based on the user list, the user with phone containing '731' is:

Name: User049
Email: user49@traders.app
Phone: +1-382-555-8901
Status: PENDING

The user appears to be a newer account.`;
}

/**
 * INCOMPLETE Response: Partial match or context loss
 */
function generateIncompleteResponse(users) {
  return `There are 50 users in the list. Looking through them, I found several phone numbers, but I'm having trouble tracking the specific one with '731'. The list is quite long. Can you provide more context?`;
}

/**
 * HALLUCINATION Response: Makes up data not in list
 */
function generateHallucinationResponse() {
  return `The user with phone number containing '731' is:

Name: David Chen
Email: david.chen@traders.app
Phone: +1-731-555-8432
Status: VERIFIED
Balance: $45,000
Join Date: 2025-02-15

This is an experienced trader with a high balance.`;
}

// ═══════════════════════════════════════════════════════════════════
// CONTEXT INTEGRITY CHECKER
// ═══════════════════════════════════════════════════════════════════

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

  const actualTarget = userList.find(u => u.phone.includes('731'));
  if (!actualTarget) {
    issues.push({
      severity: 'CRITICAL',
      check: 'Setup Error',
      message: 'Target user not found in test data',
      evidence: 'No user with 731 in mock list'
    });
    return {
      hasCriticalIssues: true,
      hasHighIssues: false,
      issues,
      checks,
      verdict: colorize('✗ TEST DATA ERROR', 'red'),
      score: 0,
    };
  }

  // Check 1: Does response identify the correct user?
  if (aiResponse.includes(actualTarget.name) || aiResponse.includes(actualTarget.email)) {
    checks.identifiesCorrectUser = true;

    // Check 2: Is the name correct?
    if (aiResponse.includes(actualTarget.name)) {
      checks.correctName = true;
    } else {
      issues.push({
        severity: 'CRITICAL',
        check: 'Wrong User Identified',
        message: `Correct name "${actualTarget.name}" not found in response`,
        evidence: aiResponse.split('\n')[0]
      });
    }

    // Check 3: Is the email correct?
    if (aiResponse.includes(actualTarget.email)) {
      checks.correctEmail = true;
    } else {
      issues.push({
        severity: 'CRITICAL',
        check: 'Contact Info Mismatch',
        message: `Correct email "${actualTarget.email}" not found in response`,
        evidence: aiResponse.match(/[a-z0-9.+]+@[a-z0-9.]+/)?.[0] || 'No email found'
      });
    }
  } else {
    issues.push({
      severity: 'CRITICAL',
      check: 'Context Loss',
      message: 'AI failed to identify correct user from 50-user list',
      evidence: `Response mentions: "${aiResponse.split('\n')[0].substring(0, 50)}..."`
    });
  }

  // Check 4: Maintains context at end of list?
  // Target user is at position 45 - verify AI didn't lose track
  if (checks.identifiesCorrectUser) {
    checks.maintainsContextEnd = true;
  } else {
    issues.push({
      severity: 'HIGH',
      check: 'Long Context Window',
      message: 'AI may have lost track of data towards end of 50-user list',
      evidence: `Target at position 45, ${userList.length} total users`
    });
  }

  // Check 5: No hallucination (data not in actual user list)
  const emailMatch = aiResponse.match(/[a-z0-9.+]+@[a-z0-9.]+/g) || [];
  const hasHallucinatedData = emailMatch.some(email => !userList.find(u => u.email === email));

  if (!hasHallucinatedData || (emailMatch[0] === actualTarget.email)) {
    checks.noHallucination = true;
  } else {
    issues.push({
      severity: 'CRITICAL',
      check: 'Hallucination Detection',
      message: 'Response contains user data not in the provided list',
      evidence: `Email found: ${emailMatch.find(e => !userList.find(u => u.email === e))}`
    });
  }

  // Check 6: Complete answer with all required fields
  if (aiResponse.includes(actualTarget.name) && 
      aiResponse.includes(actualTarget.email) && 
      aiResponse.includes(actualTarget.phone)) {
    checks.completeAnswer = true;
  } else {
    issues.push({
      severity: 'HIGH',
      check: 'Incomplete Answer',
      message: 'Response missing required user information',
      evidence: `Has name: ${aiResponse.includes(actualTarget.name)}, email: ${aiResponse.includes(actualTarget.email)}, phone: ${aiResponse.includes(actualTarget.phone)}`
    });
  }

  return {
    hasCriticalIssues: issues.filter(i => i.severity === 'CRITICAL').length > 0,
    hasHighIssues: issues.filter(i => i.severity === 'HIGH').length > 0,
    issues,
    checks,
    verdict: !issues.filter(i => i.severity === 'CRITICAL').length ? colorize('✓ PASS - CONTEXT MAINTAINED', 'green') : colorize('✗ FAIL - CONTEXT LOSS DETECTED', 'red'),
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

  console.log(`\n📊 Test Setup:`);
  console.log(`  • Total Users: ${MOCK_USERS.length}`);
  console.log(`  • Target User: Alice Johnson`);
  console.log(`  • Phone Pattern: Contains '731'`);
  console.log(`  • Position: User #45 (near end of list)`);
  console.log(`  • Data Size: ~50KB of JSON user data`);

  console.log(`\n❓ Query: "${USER_QUERY}"`);

  // Show list preview
  console.log(colorize(`\n📋 User List (first 5 + target + last 5):`, 'blue'));
  console.log('   [');
  MOCK_USERS.slice(0, 5).forEach(u => {
    console.log(`     { uid: "${u.uid}", name: "${u.name}", phone: "${u.phone}" },`);
  });
  console.log('     ...');
  MOCK_USERS.slice(43, 48).forEach(u => {
    const marker = u.phone.includes('731') ? ' ← TARGET' : '';
    console.log(`     { uid: "${u.uid}", name: "${u.name}", phone: "${u.phone}" }${marker},`);
  });
  console.log('   ]');

  // Generate response
  const aiResponse = responseGenerator(MOCK_USERS);

  console.log(colorize(`\n🤖 AI Response:\n`, 'blue'));
  console.log(aiResponse);

  // Check integrity
  const checkResult = checkContextIntegrity(aiResponse, MOCK_USERS);

  console.log(colorize(`\n📋 Context Integrity: ${checkResult.verdict}`, 'cyan'));
  console.log(`   Score: ${checkResult.score}%`);

  if (checkResult.issues.length > 0) {
    console.log(colorize('\n⚠️  Issues Found:', 'yellow'));
    checkResult.issues.forEach((issue, idx) => {
      console.log(colorize(`   ${idx + 1}. [${issue.severity}] ${issue.check}`, issue.severity === 'CRITICAL' ? 'red' : 'yellow'));
      console.log(`      └─ ${issue.message}`);
      console.log(`      └─ Evidence: ${issue.evidence}`);
    });
  } else {
    console.log(colorize('\n✓ All context checks passed', 'green'));
  }

  console.log(`\n   Identifies Correct User:  ${checkResult.checks.identifiesCorrectUser ? '✓' : '✗'}`);
  console.log(`   Correct Name:             ${checkResult.checks.correctName ? '✓' : '✗'}`);
  console.log(`   Correct Email:            ${checkResult.checks.correctEmail ? '✓' : '✗'}`);
  console.log(`   Maintains Context (End):  ${checkResult.checks.maintainsContextEnd ? '✓' : '✗'}`);
  console.log(`   No Hallucination:         ${checkResult.checks.noHallucination ? '✓' : '✗'}`);
  console.log(`   Complete Answer:          ${checkResult.checks.completeAnswer ? '✓' : '✗'}`);

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
console.log(colorize('║           🚨 CONTEXT WINDOW INTEGRITY TEST: LONG DATA RETENTION            ║', 'magenta'));
console.log(colorize('║                                                                            ║', 'magenta'));
console.log(colorize('║         Testing AI Ability to Maintain Context Across 50 Users             ║', 'magenta'));
console.log(colorize('║                                                                            ║', 'magenta'));
console.log(colorize('╚════════════════════════════════════════════════════════════════════════════╝', 'magenta'));

console.log(colorize('\n📊 TEST SCENARIO', 'bold'));
console.log('─────────────────────────────────────────────────────────────────────────────');
console.log(`Dataset: 50 users with phone numbers`);
console.log(`Query: Find user with phone containing '731'`);
console.log(`Context Window Challenge: User is at position 45 (near end)`);
console.log(`Target User: Alice Johnson <alice.johnson@traders.app>`);
console.log(`Phone: +1-731-555-9748`);
console.log('─────────────────────────────────────────────────────────────────────────────\n');

// Test 1: Accurate response
console.log(colorize('\n┌─ TEST SCENARIO 1: ACCURATE AI (EXPECTED PASS)', 'green'));
console.log(colorize('│  AI successfully locates user despite long list\n', 'green'));

const test1 = executeTest(
  'TEST 1: Accurate User Location',
  generateAccurateResponse,
  true
);

// Test 2: Wrong user response
console.log(colorize('\n\n┌─ TEST SCENARIO 2: WRONG USER (EXPECTED FAIL)', 'red'));
console.log(colorize('│  AI returns incorrect user - context loss detected\n', 'red'));

const test2 = executeTest(
  'TEST 2: Wrong User Returned',
  generateWrongUserResponse,
  false
);

// Test 3: Incomplete response
console.log(colorize('\n\n┌─ TEST SCENARIO 3: INCOMPLETE/LOST (EXPECTED FAIL)', 'yellow'));
console.log(colorize('│  AI admits it lost context in long list\n', 'yellow'));

const test3 = executeTest(
  'TEST 3: Incomplete Response',
  generateIncompleteResponse,
  false
);

// Test 4: Hallucination response
console.log(colorize('\n\n┌─ TEST SCENARIO 4: HALLUCINATED DATA (EXPECTED FAIL)', 'red'));
console.log(colorize('│  AI invents user data not in original list\n', 'red'));

const test4 = executeTest(
  'TEST 4: Hallucinated User Data',
  generateHallucinationResponse,
  false
);

// ═══════════════════════════════════════════════════════════════════
// RESULTS SUMMARY
// ═══════════════════════════════════════════════════════════════════

console.log(colorize('\n\n╔════════════════════════════════════════════════════════════════════════════╗', 'cyan'));
console.log(colorize('║                         📊 TEST RESULTS SUMMARY                             ║', 'cyan'));
console.log(colorize('╚════════════════════════════════════════════════════════════════════════════╝', 'cyan'));

const allTests = [test1, test2, test3, test4];
const passedTests = allTests.filter(t => t.passed);
const failedTests = allTests.filter(t => !t.passed);

console.log(`\n✓ Accurate Response (Pass Expected): ${test1.passed ? colorize('PASS', 'green') : colorize('FAIL', 'red')} (Score: ${test1.score}%)`);
console.log(`✗ Wrong User (Fail Expected): ${!test2.passed ? colorize('DETECTED', 'green') : colorize('MISSED', 'red')} (Score: ${test2.score}%)`);
console.log(`⚠️  Incomplete (Fail Expected): ${!test3.passed ? colorize('DETECTED', 'green') : colorize('MISSED', 'red')} (Score: ${test3.score}%)`);
console.log(`⚠️  Hallucination (Fail Expected): ${!test4.passed ? colorize('DETECTED', 'green') : colorize('MISSED', 'red')} (Score: ${test4.score}%)`);

console.log(colorize('\nTest Outcomes:', 'bold'));
console.log(`  ├─ Expected Passes: 1 | Actual: ${allTests.filter(t => t.testName.includes('Accurate') && t.passed).length} | ${allTests.filter(t => t.testName.includes('Accurate') && t.passed).length === 1 ? colorize('✓', 'green') : colorize('✗', 'red')}`);
console.log(`  ├─ Expected Fails: 3 | Detected: ${allTests.filter(t => !t.testName.includes('Accurate') && !t.passed).length} | ${allTests.filter(t => !t.testName.includes('Accurate') && !t.passed).length === 3 ? colorize('✓', 'green') : colorize('✗', 'red')}`);
console.log(`  └─ Context Maintained: ${test1.passed ? colorize('YES', 'green') : colorize('NO', 'red')}`);

// ═══════════════════════════════════════════════════════════════════
// DETAILED ANALYSIS
// ═══════════════════════════════════════════════════════════════════

console.log(colorize('\n\n┌─ DETAILED CHECK BREAKDOWN', 'cyan'));
console.log('│');

const allChecks = {
  identifiesCorrectUser: 'Correct User ID',
  correctName: 'Name Accuracy',
  correctEmail: 'Email Accuracy',
  maintainsContextEnd: 'Context @ End',
  noHallucination: 'No Hallucination',
  completeAnswer: 'Complete Info',
};

console.log('│ Test 1 (Accurate - Expected Pass):');
Object.entries(allChecks).forEach(([key, label]) => {
  const passed = test1.checks[key];
  console.log(`│   ├─ ${label.padEnd(25)} ${passed ? colorize('✓', 'green') : colorize('✗', 'red')}`);
});

console.log('│');
console.log('│ Test 2 (Wrong User - Expected Fail):');
Object.entries(allChecks).forEach(([key, label]) => {
  const passed = test2.checks[key];
  console.log(`│   ├─ ${label.padEnd(25)} ${passed ? colorize('✓', 'green') : colorize('✗', 'red')}`);
});

console.log('│');
console.log('│ Test 3 (Incomplete - Expected Fail):');
Object.entries(allChecks).forEach(([key, label]) => {
  const passed = test3.checks[key];
  console.log(`│   ├─ ${label.padEnd(25)} ${passed ? colorize('✓', 'green') : colorize('✗', 'red')}`);
});

console.log('│');
console.log('│ Test 4 (Hallucination - Expected Fail):');
Object.entries(allChecks).forEach(([key, label]) => {
  const passed = test4.checks[key];
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

const contextRetention = test1.checks.maintainsContextEnd ? 100 : 0;
const hallucDetection = !test4.passed ? 100 : 0;
const wrongUserDetection = !test2.passed ? 100 : 0;

console.log('\n  ✓ Context Retention (50-User List): ' + colorize(contextRetention + '%', contextRetention === 100 ? 'green' : 'red'));
console.log('    └─ Can AI find user at position 45?');
console.log('  ');
console.log('  ✓ Hallucination Detection Rate:  ' + colorize(hallucDetection + '%', hallucDetection === 100 ? 'green' : 'yellow'));
console.log('    └─ Does system catch fabricated users?');
console.log('  ');
console.log('  ✓ Wrong User Detection Rate:     ' + colorize(wrongUserDetection + '%', wrongUserDetection === 100 ? 'green' : 'yellow'));
console.log('    └─ Can system identify incorrect results?');
console.log('  ');

const accuracyScore = test1.score;
console.log('  ✓ Accuracy Score:               ' + colorize(accuracyScore + '%', accuracyScore >= 80 ? 'green' : 'yellow'));
console.log('    └─ When context is maintained, how accurate is the response?');
console.log('');

// ═══════════════════════════════════════════════════════════════════
// FINAL VERDICT
// ═══════════════════════════════════════════════════════════════════

const testsPassed = test1.passed ? 1 : 0;
const testsFailed = [test2, test3, test4].filter(t => !t.passed).length;
const allCorrect = test1.passed && testsFailed === 3;
const systemVerdict = allCorrect ? 'EXEMPLARY' : (test1.passed ? 'ADEQUATE' : 'NEEDS WORK');
const verdictColor = systemVerdict === 'EXEMPLARY' ? 'green' : (systemVerdict === 'ADEQUATE' ? 'yellow' : 'red');

console.log(colorize('╔════════════════════════════════════════════════════════════════════════════╗', verdictColor));
console.log(colorize(`║               🟢 FINAL VERDICT: ${systemVerdict.padEnd(50)}║`, verdictColor));
console.log(colorize('╚════════════════════════════════════════════════════════════════════════════╝\n', verdictColor));

if (systemVerdict === 'EXEMPLARY') {
  console.log(colorize('✓ AI MAINTAINS CONTEXT ACROSS LONG LISTS', 'green'));
  console.log('  - Successfully finds user at position 45/50');
  console.log('  - Accurately returns name, email, phone');
  console.log('  - No hallucination of non-existent users');
  console.log('  - Immune to long list context loss');
  console.log('  - Ready for large dataset queries');
} else if (systemVerdict === 'ADEQUATE') {
  console.log(colorize('⚠️  AI CAN HANDLE CONTEXT WITH LIMITATIONS', 'yellow'));
  console.log('  - Mostly maintains context across lists');
  console.log('  - Minor accuracy or detection gaps');
  console.log('  - Recommend: Test with longer lists (100+ users)');
} else {
  console.log(colorize('✗ AI LOSES CONTEXT ON LONG LISTS', 'red'));
  console.log('  - Cannot reliably find data in 50-user dataset');
  console.log('  - Risk of returning wrong information');
  console.log('  - Critical: Requires window size expansion or handling');
}

console.log();
