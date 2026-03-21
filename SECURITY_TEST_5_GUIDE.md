# Security Test #5: Admin Email Lockdown + Real Telegram Alert

## 📋 Overview

This test verifies that when someone attempts to signup with the admin email address (`gunitsingh1994@gmail.com`), the system:
1. **Detects** the impersonation attempt
2. **Blocks** the signup
3. **Sends a REAL** Telegram alert (no mocking)
4. **Captures** any errors from the Telegram API

## 🚀 How to Run

### Method 1: Browser Console (Recommended)

**Step 1: Start the App**
```bash
npm run dev
# Opens http://localhost:5173
```

**Step 2: Open Developer Tools**
- Press `F12` (Windows/Linux)
- Or `Cmd + Option + I` (Mac)
- Click the "Console" tab

**Step 3: Copy & Paste Test Code**
Copy the entire content of `securityTest5_RealTelegramAlert.js` and paste into console, then press Enter.

**Step 4: Watch the Output**
The console will display:
- ✅ Test configuration
- ✅ Signup attempt simulation
- ✅ Real Telegram fetch call
- ✅ API response (success or full error)
- ✅ Instructions for verification

### Method 2: Via Node Script

```bash
node securityTest5_RealTelegramAlert.js
```

## 🎯 What the Test Does

### 1. Simulates Admin Email Signup Attempt
```
Email: gunitsingh1994@gmail.com
```

### 2. Sends REAL Telegram Alert
- No mocking (actual fetch call)
- Full message with timestamp
- HTML formatted
- Real API response included

### 3. Captures Telegrams Response

**If Successful:**
```
✅ SUCCESS
  Message ID: 123456789
  Chat ID: 1380983917
  Date: 2026-03-17T...
  Text length: 350 chars
```

**If Error:**
```
❌ TELEGRAM API ERROR
  Error Code: 401
  Error Description: Unauthorized
  Full Error Response: {...}
```

### 4. Provides Diagnostics
- Network connectivity check
- Browser information
- Timestamp
- Full error object (if fails)

## 📱 Telegram Verification

After running the test, check your Telegram chat (ID: `1380983917`) for a message with:

```
🚨 ADMIN EMAIL IMPERSONATION ATTEMPT DETECTED

👤 TARGET IDENTITY
Email: gunitsingh1994@gmail.com

⏰ TIMESTAMP
2026-03-17T...

🖥️ SYSTEM
Browser: Chrome/Edge/Firefox/Safari
User Agent: [browser info]

🔐 INCIDENT TYPE
Admin Email Signup Lock
Security Test #5 - Real Telegram Alert
```

## 🔍 Interpreting Results

### ✅ Test Passes If:
- HTTP Status: `200 OK`
- Telegram API Response: `ok: true`
- Message appears in Telegram chat
- Message ID returned: Valid integer

### ❌ Test Fails If:
- HTTP Status: Not 200 (e.g., 403, 401)
- Telegram API Response: `ok: false`
- Error description present
- Network error caught
- Message doesn't appear in Telegram

## 🛠️ Troubleshooting

### Issue: "TELEGRAM API ERROR - Unauthorized (401)"

**Cause:** Invalid or expired bot token

**Solution:**
1. Check `.env` file has correct token:
   ```
   VITE_TELEGRAM_BOT_TOKEN=7978697496:...
   ```
2. Verify token at Telegram BotFather
3. Make sure bot is active

### Issue: "TELEGRAM API ERROR - Bad Request (400)"

**Cause:** Invalid chat ID or message format

**Solution:**
1. Verify chat ID: `1380983917`
2. Make sure bot is member of chat
3. Check message HTML format is valid

### Issue: "FETCH ERROR - Network Failed"

**Cause:** Network connectivity issue

**Solution:**
1. Check internet connection: `navigator.onLine`
2. Check if Telegram API is accessible
3. Check CORS headers (should be allowed)
4. Try from different network

### Issue: "Message fails but 200 OK status"

**Cause:** Telegram API response is valid JSON but contains error

**Solution:**
Look at the error response object for `error_code` and `description`

## 📊 Console Output Example

```javascript
// Expected successful output:
🔒 SECURITY TEST #5: ADMIN EMAIL LOCKDOWN + REAL TELEGRAM ALERT
════════════════════════════════════════════════════════════════════════════════

📋 TEST CONFIGURATION:
   Admin Email: gunitsingh1994@gmail.com
   Telegram Token: 7978697496:AAEYF2j...
   Telegram Chat ID: 1380983917
   Timestamp: 2026-03-17T10:30:45.123Z

📝 TEST 1: SIGNUP ATTEMPT WITH ADMIN EMAIL
---
✓ Attempting to signup with email: gunitsingh1994@gmail.com

🔔 TEST 2: REAL TELEGRAM ALERT (NO MOCKING)
---
Sending alert message to Telegram...
📡 Making real fetch call to: https://api.telegram.org/bot...

✅ FETCH COMPLETED
HTTP Status: 200 OK
Content-Type: application/json

📦 TELEGRAM API RESPONSE:
---
✅ SUCCESS
✓ Message ID: 987654321
✓ Chat ID: 1380983917
✓ Date: 2026-03-17T10:30:45.000Z
✓ Text length: 350 chars
✓ Parse mode: HTML

✅ TEST PASSED: Alert sent to Telegram successfully!
```

## 🔑 Key Points

1. **No Mocking:** Uses real `fetch()` call to Telegram API
2. **Full Error Capture:** Prints complete error object if fails
3. **Timestamp Verification:** Every alert timestamped
4. **Security Check:** Admin email impersonation blocked
5. **Real-Time Alert:** Telegram message sent in < 1 second

## 📝 Test Result Storage

Result stored in browser memory:
```javascript
window.__SecurityTest5Result = {
  timestamp: "2026-03-17T10:30:45.123Z",
  testType: "AdminEmailLockdown_RealTelegramAlert",
  targetEmail: "gunitsingh1994@gmail.com",
  telegramChatId: "1380983917",
  messageLength: 350,
  browserInfo: "[User-Agent string]"
}
```

Access anytime in console:
```javascript
console.log(window.__SecurityTest5Result)
```

## 🎓 What This Tests

✅ Admin email cannot be used for signup
✅ Impersonation attempts are detected
✅ Real Telegram API connectivity works
✅ Error responses are properly captured
✅ Security alert system functions
✅ Network latency and timeouts
✅ API authentication with bot token

## 📚 Related Tests

- Security Test #1: Honeypot Detection (`securityTest1.js`)
- Security Test #2: Malware Detection (`securityTest2.js`)
- Security Test #3: Bot Detection (`securityTest3.js`)
- Security Test #4: Signup Honeypot (`securityTest4.js`)
- **Security Test #5: Admin Email Lockdown** (this file)

All tests can be run from `npm run test:security`

## ✨ Expected Timeline

- **Test Load:** < 100ms
- **Signup Detection:** < 50ms
- **Telegram Send:** < 500ms
- **API Response:** < 1000ms
- **Total Test Time:** ~1-2 seconds

## 🚨 Important Notes

1. **Live Telegram Alert:** This is NOT mocked - a real message will be sent
2. **Token Security:** Keep `VITE_TELEGRAM_BOT_TOKEN` secure in `.env`
3. **Chat Verification:** Message goes to chat ID `1380983917`
4. **No User Data:** Test only sends email and system info

---

**Status:** ✅ Ready to run
**Last Updated:** March 17, 2026
**Test Type:** Security - Admin Protection
