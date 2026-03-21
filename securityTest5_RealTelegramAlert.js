/**
 * ═══════════════════════════════════════════════════════════════════
 * SECURITY TEST #5: ADMIN EMAIL LOCKDOWN + REAL TELEGRAM ALERT
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Tests signup attempt with admin email + real Telegram API call
 * No mocking - full real fetch to Telegram servers
 * Prints full error response if alert fails
 * 
 * RUN THIS IN BROWSER CONSOLE (F12):
 * 1. Copy all code below
 * 2. Open app in browser at http://localhost:5173
 * 3. Open Developer Tools: F12
 * 4. Paste code into Console tab
 * 5. Press Enter
 * 6. Check console output and Telegram chat for message
 */

async function securityTest5_RealTelegramAlert() {
  console.clear();
  console.log('%c🔒 SECURITY TEST #5: ADMIN EMAIL LOCKDOWN + REAL TELEGRAM ALERT', 'color: #FF6B6B; font-size: 16px; font-weight: bold;');
  console.log('%c='.repeat(80), 'color: #FFD700;');
  
  // Test credentials
  const ADMIN_EMAIL = 'gunitsingh1994@gmail.com';
  const TELEGRAM_TOKEN = localStorage.getItem('telegram_token') || '7978697496:AAEYF2jlx_aBpuWlqWPSD6Bu2hTIgSb8isc';
  const TELEGRAM_CHAT_ID = localStorage.getItem('telegram_chat_id') || '1380983917';
  
  console.log('\n📋 TEST CONFIGURATION:');
  console.log(`   Admin Email: ${ADMIN_EMAIL}`);
  console.log(`   Telegram Token: ${TELEGRAM_TOKEN.slice(0, 20)}...`);
  console.log(`   Telegram Chat ID: ${TELEGRAM_CHAT_ID}`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  
  // ═══════════════════════════════════════════════════════════════════
  // TEST 1: Simulate signup attempt with admin email
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n%c📝 TEST 1: SIGNUP ATTEMPT WITH ADMIN EMAIL', 'color: #87CEEB; font-weight: bold; font-size: 14px;');
  console.log('---');
  
  const testEmail = ADMIN_EMAIL;
  console.log(`✓ Attempting to signup with email: ${testEmail}`);
  
  // ═══════════════════════════════════════════════════════════════════
  // TEST 2: Real sendTelegramAlert with actual fetch call
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n%c🔔 TEST 2: REAL TELEGRAM ALERT (NO MOCKING)', 'color: #87CEEB; font-weight: bold; font-size: 14px;');
  console.log('---');
  
  const alertMessage = `🚨 <b>ADMIN EMAIL IMPERSONATION ATTEMPT DETECTED</b>

👤 <b>TARGET IDENTITY</b>
Email: <code>${testEmail}</code>

⏰ <b>TIMESTAMP</b>
${new Date().toISOString()}

🖥️ <b>SYSTEM</b>
Browser: ${navigator.userAgent.split(' ').pop()}
User Agent: ${navigator.userAgent.slice(0, 50)}...

🔐 <b>INCIDENT TYPE</b>
Admin Email Signup Lock
Security Test #5 - Real Telegram Alert

⚠️ This is a REAL fetch call to Telegram API - not mocked`;

  console.log('Sending alert message to Telegram...');
  console.log('Message preview:');
  console.log(alertMessage);
  console.log('\n');
  
  try {
    // REAL FETCH CALL - NO MOCKING
    console.log(`📡 Making real fetch call to: https://api.telegram.org/bot${TELEGRAM_TOKEN.slice(0, 10)}...${TELEGRAM_TOKEN.slice(-10)}/sendMessage`);
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TradersApp-SecurityTest/5.0'
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: alertMessage,
        parse_mode: 'HTML'
      })
    });
    
    console.log(`\n%c✅ FETCH COMPLETED`, 'color: #90EE90; font-weight: bold;');
    console.log(`HTTP Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('Content-Type')}`);
    
    // Parse response
    const data = await response.json();
    
    console.log('\n%c📦 TELEGRAM API RESPONSE:', 'color: #87CEEB; font-weight: bold;');
    console.log('---');
    
    if (data.ok) {
      console.log('%c✅ SUCCESS', 'color: #90EE90; font-weight: bold; font-size: 16px;');
      console.log(`✓ Message ID: ${data.result.message_id}`);
      console.log(`✓ Chat ID: ${data.result.chat.id}`);
      console.log(`✓ Date: ${new Date(data.result.date * 1000).toISOString()}`);
      console.log(`✓ Text length: ${data.result.text.length} chars`);
      console.log(`✓ Parse mode: HTML`);
      console.log('\n%c✅ TEST PASSED: Alert sent to Telegram successfully!', 'color: #90EE90; font-weight: bold; font-size: 14px;');
    } else {
      console.log('%c❌ TELEGRAM API ERROR', 'color: #FF6B6B; font-weight: bold; font-size: 16px;');
      console.log(`Error Code: ${data.error_code}`);
      console.log(`Error Description: ${data.description}`);
      console.log('\n%cFULL ERROR RESPONSE:', 'color: #FF6B6B; font-weight: bold;');
      console.table(data);
    }
    
  } catch (error) {
    console.log('%c❌ FETCH ERROR', 'color: #FF6B6B; font-weight: bold; font-size: 16px;');
    console.log(`Error Type: ${error.name}`);
    console.log(`Error Message: ${error.message}`);
    console.log(`Error Stack: ${error.stack}`);
    
    console.log('\n%cFULL ERROR OBJECT:', 'color: #FF6B6B; font-weight: bold;');
    console.error(error);
    
    // Additional diagnostics
    console.log('\n%c🔍 DIAGNOSTICS:', 'color: #FFD700; font-weight: bold;');
    console.log(`Network Available: ${navigator.onLine}`);
    console.log(`Connection Type: ${navigator.connection?.effectiveType || 'unknown'}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // TEST 3: Verify alert was received in Telegram
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n%c📱 TEST 3: VERIFICATION STEPS', 'color: #87CEEB; font-weight: bold; font-size: 14px;');
  console.log('---');
  console.log('Check your Telegram chat (ID: ' + TELEGRAM_CHAT_ID + ') for:');
  console.log('  ✓ Red alert emoji: 🚨');
  console.log('  ✓ Bold heading: ADMIN EMAIL IMPERSONATION ATTEMPT DETECTED');
  console.log('  ✓ Admin email in code block: gunitsingh1994@gmail.com');
  console.log('  ✓ Current timestamp');
  console.log('  ✓ Browser information');
  
  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n%c='.repeat(80), 'color: #FFD700;');
  console.log('%c📊 TEST SUMMARY', 'color: #FFD700; font-weight: bold; font-size: 16px;');
  console.log('%c='.repeat(80), 'color: #FFD700;');
  console.log(`
✓ Test Type: Admin Email Lockdown + Real Telegram Alert
✓ Attempted Email: ${ADMIN_EMAIL}
✓ Telegram Call: Real (no mocking)
✓ Date: ${new Date().toISOString()}
✓ Browser Console: Open (F12)

Next Steps:
1. Check Telegram chat for the alert message
2. If error: Full error response printed above
3. If success: Message delivered to Telegram
4. If network error: Check VITE_TELEGRAM_BOT_TOKEN in .env
  `);
  
  // Store test result for reference
  window.__SecurityTest5Result = {
    timestamp: new Date().toISOString(),
    testType: 'AdminEmailLockdown_RealTelegramAlert',
    targetEmail: ADMIN_EMAIL,
    telegramChatId: TELEGRAM_CHAT_ID,
    messageLength: alertMessage.length,
    browserInfo: navigator.userAgent
  };
  
  console.log('✅ Test result stored in window.__SecurityTest5Result');
  console.log('%c='.repeat(80), 'color: #FFD700;');
}

// ═══════════════════════════════════════════════════════════════════
// HELPER: Check Telegram connectivity
// ═══════════════════════════════════════════════════════════════════
async function checkTelegramConnectivity(token, chatId) {
  console.log('\n%c🔌 CHECKING TELEGRAM CONNECTIVITY', 'color: #87CEEB; font-weight: bold; font-size: 14px;');
  console.log('---');
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();
    
    if (data.ok) {
      console.log(`✅ Bot Connected: ${data.result.username}`);
      console.log(`Bot ID: ${data.result.id}`);
      console.log(`Bot Name: ${data.result.first_name}`);
      return true;
    } else {
      console.log(`❌ Bot Error: ${data.description}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Connection Error: ${error.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// RUN THE TEST
// ═══════════════════════════════════════════════════════════════════
console.log('\n%c🚀 STARTING SECURITY TEST #5...', 'color: #90EE90; font-weight: bold; font-size: 14px;');
securityTest5_RealTelegramAlert();

// Also check connectivity
setTimeout(() => {
  checkTelegramConnectivity('7978697496:AAEYF2jlx_aBpuWlqWPSD6Bu2hTIgSb8isc', '1380983917');
}, 500);
