# Telegram Connectivity Audit System - Documentation

## Overview

A comprehensive diagnostic system for monitoring and troubleshooting Telegram bot connectivity in the TradersApp. The system runs automatically on app initialization and provides admin tools for real-time monitoring.

## Features

### 1. **Automatic Connectivity Test on App Load**
- Runs without blocking app initialization
- Tests 6 key connectivity areas:
  - Basic connectivity to external services
  - Telegram API health (getMe endpoint)
  - Test message delivery
  - Rate limiting behavior
  - CORS headers and security
  - Error recovery patterns

### 2. **Admin Dashboard Integration**
- Accessible via `window.__TelegramMonitor` in browser console
- Available after admin authentication
- Full history tracking and reporting

### 3. **Continuous Monitoring**
- Optional periodic health checks
- Error logging and success tracking
- Uptime calculation
- Performance benchmarking

## Quick Start Guide

### 1. **Check Automatic Audit Results**
On app load, the system automatically runs diagnostics. Results are logged to console:

```javascript
// View in browser console - look for output like:
// 🔌 Starting Telegram connectivity audit...
// ✅ Telegram audit complete: {status: 'ALL_SYSTEMS_OPERATIONAL', ...}
// Or check window object:
window.__TelegramDiagnostics
```

### 2. **Use Admin Monitor (For Admins)**

After logging in as admin, the monitor is initialized:

```javascript
// Test connection
window.__TelegramMonitor.testConnection()
  .then(diagnostics => console.log('Diagnostics:', diagnostics))
  .catch(error => console.error('Test failed:', error))

// Check current status
window.__TelegramMonitor.getStatus()

// Start 1-hour monitoring
window.__TelegramMonitor.startMonitoring(60)

// Run benchmark
window.__TelegramMonitor.benchmark()

// Export data as JSON
const data = window.__TelegramMonitor.exportDiagnostics()
```

### 3. **View Formatted Report**
```javascript
// Get HTML report
const report = window.__TelegramMonitor.getReport()
// Can be inserted into DOM or sent as message
```

## API Reference

### TelegramMonitor Methods

#### `testConnection()`
Runs full connectivity audit.

**Returns:** Promise<Diagnostics>

```javascript
const diagnostics = await window.__TelegramMonitor.testConnection()
console.log(diagnostics.summary.status) // 'ALL_SYSTEMS_OPERATIONAL'
```

#### `startMonitoring(intervalMinutes = 60)`
Starts periodic health checks.

**Parameters:**
- `intervalMinutes` (number): Check interval in minutes (default: 60)

**Returns:** Promise<{running: boolean, stop: Function}>

```javascript
const monitoring = await window.__TelegramMonitor.startMonitoring(30)
monitoring.stop() // Stop monitoring
```

#### `stopMonitoring()`
Stops active monitoring.

**Returns:** boolean (success)

#### `getStatus()`
Returns current monitoring status.

**Returns:** Object with:
- `lastDiagnostics`: Last diagnostic run results
- `monitoringActive`: Boolean status
- `errorCount`: Total errors logged
- `successCount`: Total successes
- `lastErrors`: Array of last 5 errors
- `lastSuccess`: Most recent successful test
- `uptime`: Percentage string

#### `benchmark()`
Runs performance benchmark with multiple request types.

**Returns:** Promise<{tests: Array}>

#### `exportDiagnostics()`
Exports all collected data as JSON.

**Returns:** Object with timestamp, stats, and error/success logs

#### `getReport()`
Gets formatted HTML report.

**Returns:** HTML string

#### `testEndpoint(url, method = 'GET', timeout = 5000)`
Test specific endpoint.

**Parameters:**
- `url` (string): Full URL to test
- `method` (string): HTTP method (default: 'GET')
- `timeout` (number): Timeout in ms (default: 5000)

**Returns:** Promise<{success: boolean, latency: string, status?: number}>

## Diagnostic Checks Explained

### 1. Basic Connectivity
Tests public DNS endpoints to ensure internet connectivity and resolves api.telegram.org.

**What it checks:**
- Can reach api.telegram.org via TCP/DNS
- Network availability
- DNS resolution working

**Expected result:** PASS if internet is available

### 2. Telegram API Health
Tests the bot's ability to authenticate with Telegram.

**What it checks:**
- Token format validity
- Bot identity (getMe endpoint)
- API responsiveness
- Expected quota limits

**Expected result:** PASS if token is valid and bot exists

### 3. Test Message Send
Sends an actual message to verify end-to-end delivery.

**What it checks:**
- Message delivery success
- Chat ID validity
- Message formatting
- Response time

**Expected result:** PASS if message delivered

### 4. Rate Limiting
Detects rate limiting patterns and API throttling.

**What it checks:**
- 3 rapid consecutive requests
- Latency consistency
- Retry-After headers
- Rate limit remaining values

**Expected result:** PASS if no throttling detected

### 5. CORS & Security
Checks response headers for proper security configuration.

**What it checks:**
- CORS headers present
- Security headers
- SSL/TLS status
- Content-Type headers

**Expected result:** PASS (informational)

### 6. Error Recovery
Simulates error conditions to test fallback behavior.

**What it checks:**
- Invalid token handling
- Invalid chat ID handling
- Timeout recovery
- Retry logic readiness

**Expected result:** INFORMATIONAL

## Common Issues & Solutions

### Issue: "FAIL - API not responding"
**Possible causes:**
- Telegram API is down
- Token is invalid or expired
- Network blocked by ISP/firewall
- VPN issues

**Solutions:**
1. Check token in TELEGRAM_TOKEN constant
2. Test basic connectivity first
3. Try from different network
4. Check Telegram Bot API status page

### Issue: "WARNING - Rate limited"
**Possible causes:**
- Too many messages in short time
- Bot used elsewhere simultaneously
- Previous error loop

**Solutions:**
1. Reduce message frequency
2. Implement exponential backoff
3. Check other bot instances
4. Wait 1-2 minutes for reset

### Issue: "Invalid chat ID"
**Possible causes:**
- TELEGRAM_CHAT_ID not set correctly
- Chat doesn't exist
- Bot not member of chat/channel

**Solutions:**
1. Verify TELEGRAM_CHAT_ID value
2. Ensure bot is invited to chat
3. Use `/start` command to initialize chat if private
4. Check if chat exists: `curl https://api.telegram.org/botTOKEN/getChat?chat_id=CHATID`

## Integration with Existing Systems

### Automatically Triggered
- **App Initialization:** Runs non-blocking test on page load
- **Admin Login:** Initializes monitor with admin tools
- **Connection Restoration:** Tests on online event

### Manual Triggers
- Console commands for admins
- Admin dashboard integration point
- Performance monitoring in admin overlay

## Monitoring Best Practices

1. **Run Diagnostics Weekly:** Schedule periodic checks
   ```javascript
   // In admin console, run weekly:
   window.__TelegramMonitor.startMonitoring(60 * 24 * 7) // 1 week
   ```

2. **Export Reports:** Save diagnostic data for analysis
   ```javascript
   const data = window.__TelegramMonitor.exportDiagnostics()
   // Send to backend or download as JSON
   ```

3. **Monitor Uptime:** Check success rate
   ```javascript
   const status = window.__TelegramMonitor.getStatus()
   console.log('Uptime:', status.uptime) // e.g., "98.50%"
   ```

4. **Alert on Failures:** Receive Telegram messages when issues detected

## Performance Considerations

- **Non-blocking:** Diagnostics run async without blocking app render
- **Minimal overhead:** ~500ms for initial test
- **Bandwidth:** Single test uses ~20KB of data
- **Rate limiting:** Respects Telegram API limits (30 msg/sec)

## Development & Testing

### Run Diagnostics in Development
```javascript
// In browser console:
await window.__TelegramMonitor.testConnection()
```

### Test Error Scenarios
```javascript
// Test specific endpoint
await window.__TelegramMonitor.testEndpoint('https://api.telegram.org/botINVALID/getMe')
```

### Performance Benchmark
```javascript
const benchmark = await window.__TelegramMonitor.benchmark()
console.table(benchmark.tests)
```

## Files Modified/Created

1. **src/telegramDiagnostics.js** - Core diagnostic engine
2. **src/telegramMonitor.js** - Admin monitor interface
3. **src/App.jsx** - Integration points:
   - Import statements
   - Automatic test on init
   - Admin monitor initialization

## Troubleshooting the Audit System

If diagnostics don't run:

1. Check browser console for errors
2. Verify Telegram constants are set:
   ```javascript
   console.log(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID)
   ```
3. Check network tab for failed requests
4. Enable verbose logging:
   ```javascript
   window.__TelegramDiagnostics // View last results
   ```

## Future Enhancements

- [ ] Dashboard visualization of metrics
- [ ] Automated alert escalation
- [ ] Historical trend analysis
- [ ] Geographic latency tracking
- [ ] Webhook endpoint health checks
- [ ] Message queue monitoring
