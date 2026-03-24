# TradersApp Implementation Plan

## Execution Protocol

**RULES (Strictly Followed):**
1. ONE task at a time only
2. After each task: Debug → Toggle → Test → Run → Repeat until clean
3. Use modular folder structure (new folder per feature)
4. Create git checkpoint before moving to next task
5. Wait for manual permission before proceeding
6. If error exists, do NOT move forward

---

## Current Stable Baseline
- **Commit**: `3ae2548`
- **Features**: FloatingChatWidget, AdminMessagePanel, FounderCard, AI Status
- **Status**: Ready for new feature work

---

# ROADMAP A: MainTerminal Mechanics + AI Watch Tower + TR AI

## Phase A1: MainTerminal Mechanics (Drag & Drop + Performance Dashboard + Cloud Sync)

### Task A1.1: Drag & Drop Engine
**Location**: `src/features/terminal/utils/dragDrop.js`
**Logic**:
- Create `onScreenshotDrop(e, setScreenshots, maxImages)` function
- Prevent default behavior on drop
- Read `e.dataTransfer.files`
- Filter for `type.startsWith('image/')`
- Use FileReader to read as DataURL
- Split at ',' to extract Base64
- Append to screenshots array (max 4 images)

**Deliverable**: `src/features/terminal/utils/dragDrop.js`

### Task A1.2: makeImgHandler Higher-Order Function
**Location**: `src/features/terminal/utils/dragDrop.js`
**Logic**:
- Create `makeImgHandler(setter)` function
- Takes a state setter (e.g., setVwapChart)
- Reads dropped file, converts to Base64
- Updates that specific state

**Deliverable**: Extended `src/features/terminal/utils/dragDrop.js`

### Task A1.3: Performance Dashboard Live Math
**Location**: `src/features/terminal/components/PerformanceStats.jsx`
**Logic**:
- Create component that calculates from journal array on every render:

```
wins = journal.filter(entry => entry.result === 'win')
losses = journal.filter(entry => entry.result === 'loss')
pnlTotal = journal.reduce((sum, entry) => sum + entry.pnl, 0)
wr = (wins.length / journal.length) * 100
avgWin = wins.reduce((sum, w) => sum + w.pnl, 0) / wins.length
avgLoss = Math.abs(losses.reduce((sum, l) => sum + l.pnl, 0) / losses.length)
pf = (avgWin * wins.length) / (avgLoss * losses.length)
```

**Deliverable**: `src/features/terminal/components/PerformanceStats.jsx`

### Task A1.4: Cloud Sync Wiring
**Location**: Update MainTerminal component in App.jsx
**Logic**:
- Pass `onSaveJournal` and `onSaveAccount` props from TradersRegiment
- Wire Journal updates to call `onSaveJournal(journal)`
- Wire Account State updates to call `onSaveAccount(accountState)`

**Deliverable**: Updated MainTerminal in App.jsx

---

## Phase A2: AI Watch Tower (Telemetry & Security)

### Task A2.1: Create Watch Tower Folder Structure
**Location**: `src/features/watchtower/`
**Structure**:
```
src/features/watchtower/
├── hooks/
│   └── useWatchTower.js
├── utils/
│   ├── consoleInterceptor.js
│   ├── networkTracker.js
│   ├── ttiTracker.js
│   └── ipScanner.js
└── components/
    ├── DebugOverlay.jsx
    └── SecurityBadge.jsx
```

### Task A2.2: Console Interceptor Module
**Location**: `src/features/watchtower/utils/consoleInterceptor.js`
**Logic**:
- Override `window.console.log`, `console.warn`, `console.error`
- Store in array (limit 99 entries)
- Format: `{ type, message, timestamp }`
- Restore originals on unmount
- Export: `setupConsoleInterceptor()`, `restoreConsole()`

### Task A2.3: Network Latency Tracker
**Location**: `src/features/watchtower/utils/networkTracker.js`
**Logic**:
- Override `window.fetch`
- Record `performance.now()` before and after
- Save latency (ms) + endpoint to array
- If latency > 2000ms, flag as "Slow Request"
- Export: `setupNetworkTracker()`, `restoreFetch()`

### Task A2.4: TTI Tracker
**Location**: `src/features/watchtower/utils/ttiTracker.js`
**Logic**:
- Use `performance.timing.navigationStart`
- Calculate with `performance.now()`
- Export: `getTTI()`

### Task A2.5: Anti-Hacker Sentinel (Click Speed)
**Location**: `src/features/watchtower/utils/sentinel.js`
**Logic**:
- Track clicks with timestamps
- If > 5 clicks/second → `blocked: true`
- Export: `recordAdminActivity(action, target)`
- Return `{ blocked, isSuspicious, clicksPerSecond }`

### Task A2.6: Duplicate IP Scanner
**Location**: `src/features/watchtower/utils/ipScanner.js`
**Logic**:
- Function: `detectDuplicateIPs(users)`
- Map through all users
- If `user.forensic.ip` matches another user's IP
- Return array of duplicate UIDs
- Export: `detectDuplicateIPs()`

### Task A2.7: Watch Tower Hook
**Location**: `src/features/watchtower/hooks/useWatchTower.js`
**Logic**:
- Centralize all watchtower state:
  - `debugLogs`
  - `debugLatencies`
  - `debugTTI`
  - `securityBlocked`
- Combine all utilities into one hook

### Task A2.8: Debug Overlay Component
**Location**: `src/features/watchtower/components/DebugOverlay.jsx`
**Logic**:
- Display console logs panel
- Display network latencies
- Display TTI
- Show security status

### Task A2.9: Wire Watch Tower into App
**Location**: App.jsx
**Logic**:
- Import and use useWatchTower hook
- Protect admin approve/block with sentinel
- Render DebugOverlay

---

## Phase A3: TR AI (Deliberation Engine)

### Task A3.1: Create TR AI Folder Structure
**Location**: `src/features/tr-ai/`
**Structure**:
```
src/features/tr-ai/
├── services/
│   └── deliberationService.js
├── state/
│   └── councilState.js
└── components/
    ├── CouncilLoader.jsx
    └── QuadCoreStatus.jsx
```

### Task A3.2: runDeliberation Service
**Location**: `src/features/tr-ai/services/deliberationService.js`
**Logic**:
- Function: `runDeliberation(systemPrompt, userContent)`
- POST to: `https://api.anthropic.com/v1/messages`
- Payload: `{ model: 'claude-sonnet-4-20250514', max_tokens: 8000, system: systemPrompt, messages: [{role: 'user', content: parsedContent}] }`
- Return joined text from response blocks
- Error-safe return path

### Task A3.3: Council Stage State Machine
**Location**: `src/features/tr-ai/state/councilState.js`
**Logic**:
- Global object: `councilStage`
- States: `stage1`, `stage2`, `stage3`, `stage4`, `stage5`
- Labels: 'Initializing...', 'Running analysis...', 'Cross-Exam', 'Briefing', 'Complete'/'Error'
- Export: `councilStage` object, `setCouncilStage(stage, label)` function

### Task A3.4: Council Loader UI
**Location**: `src/features/tr-ai/components/CouncilLoader.jsx`
**Logic**:
- Render 5-stage progress indicator
- Show current label
- Reflect complete/error state
- Animated loader CSS

### Task A3.5: Quad-Core Status Footer
**Location**: `src/features/tr-ai/components/QuadCoreStatus.jsx`
**Logic**:
- Render 4 AI nodes: Claude, Groq, Mistral, Gemini
- LED behavior:
  - Purple glow if `isReserve: true`
  - Green pulse if `online: true`
  - Red if `offline: true`
- Import from ai-router.js

### Task A3.6: Wire TR AI into App
**Location**: App.jsx
**Logic**:
- Import services and components
- Integrate deliberationService
- Render QuadCoreStatus at bottom

---

# ROADMAP B: Identity Pipeline + Security Interceptor + Waiting Room

## Phase B1: Identity Pipeline

### Task B1.1: validateSignupInput
**Location**: `src/services/authService.js`
**Logic**:
- Function: `validateSignupInput(email, password)`
- Email regex validation
- Password strength (min 8 chars)
- Return: `{ valid: boolean, error: string }`

### Task B1.2: createEmailUser
**Location**: `src/services/authService.js`
**Logic**:
- Function: `createEmailUser(email, password)`
- Use Firebase auth createUserWithEmailAndPassword
- Return user credential

### Task B1.3: provisionUserRecord
**Location**: `src/services/databaseService.js`
**Logic**:
- Function: `provisionUserRecord(uid, userData)`
- Write to `users/{uid}` in Firebase
- Set initial status: PENDING

### Task B1.4: sendWelcomeEmail
**Location**: `src/services/emailService.js`
**Logic**:
- Function: `sendWelcomeEmail(email, fullName)`
- Use EmailJS to send welcome template

### Task B1.5: Wire Manual Email Signup → OTP Flow
**Location**: App.jsx signup logic
**Logic**:
- After successful signup, route to OTP screen

### Task B1.6: handleGoogleSignup
**Location**: `src/services/authService.js`
**Logic**:
- Function: `handleGoogleSignup()`
- Use Firebase Google sign-in popup

### Task B1.7: checkUserExists
**Location**: `src/services/databaseService.js`
**Logic**:
- Function: `checkUserExists(uid)`
- Check if user record exists in Firebase

### Task B1.8: Wire Google User → Provisioning + WaitingRoom
**Location**: App.jsx
**Logic**:
- New Google user → provision → send welcome → WaitingRoom
- Returning Google user → Security Interceptor

### Task B1.9: handleGoogleUserPasswordReset
**Location**: `src/services/authService.js`
**Logic**:
- Function: `handleGoogleUserPasswordReset(email)`

---

## Phase B2: Security Interceptor

### Task B2.1: checkUserStatus
**Location**: `src/services/authService.js`
**Logic**:
- Function: `checkUserStatus(uid)`
- Return: PENDING | ACTIVE | BLOCKED

### Task B2.2-2.5: Routing Handlers
**Location**: `src/services/routingService.js`
**Logic**:
- `handleLockedAccount()` → show lock screen
- `handleBlockedAccount()` → show blocked screen
- `handlePendingAccount()` → route to WaitingRoom
- `handleActiveAccount()` → route to MainTerminal

### Task B2.6: sendSecurityAlert
**Location**: `src/services/telegramService.js`
**Logic**:
- Function: `sendSecurityAlert(alertType, userData)`
- Send Telegram alert for security events

---

## Phase B3: Waiting Room & Admin Approval

### Task B3.1: Create WaitingRoom Page
**Location**: `src/pages/WaitingRoom.jsx` (exists)
**Enhancement**: Add live Firebase listener for status

### Task B3.2: Live Status Listener
**Location**: `src/pages/WaitingRoom.jsx`
**Logic**:
- Use Firebase onValue to listen to `users/{uid}/status`
- Auto-transition when status changes to ACTIVE

### Task B3.3: approveUser Service
**Location**: `src/services/adminService.js`
**Logic**:
- Function: `approveUser(uid, adminUid)`
- Update status to ACTIVE in Firebase

### Task B3.4: AdminUserActions Component
**Location**: `src/components/AdminUserActions.jsx` (exists)
**Enhancement**: Green approve button styling

### Task B3.5: sendApprovalConfirmationEmail
**Location**: `src/services/emailService.js`
**Logic**:
- Function: `sendApprovalConfirmationEmail(email, fullName)`

### Task B3.6: Magic Handshake (PENDING → ACTIVE)
**Location**: App.jsx + WaitingRoom.jsx
**Logic**:
- WaitingRoom listens for status change
- Auto-route to MainTerminal when ACTIVE

### Task B3.7: ConfettiCelebration Component
**Location**: `src/components/ConfettiCelebration.jsx` (exists)

### Task B3.8: Auto-Route Approved Users
**Location**: App.jsx
**Logic**:
- After approval, redirect to MainTerminal

---

# IMPLEMENTATION SEQUENCE

```
Step 1: Git Checkpoint (COMPLETED ✓ - commit 3ae2548)

Step 2: Phase A1 - MainTerminal Mechanics
        A1.1 → Test → A1.2 → Test → A1.3 → Test → A1.4 → Test → Checkpoint

Step 3: Phase A2 - AI Watch Tower
        A2.1 → A2.2 → Test → A2.3 → Test → A2.4 → Test → A2.5 → Test → 
        A2.6 → Test → A2.7 → Test → A2.8 → Test → A2.9 → Test → Checkpoint

Step 4: Phase A3 - TR AI
        A3.1 → A3.2 → Test → A3.3 → Test → A3.4 → Test → A3.5 → Test → 
        A3.6 → Test → Checkpoint

Step 5: Phase B1 - Identity Pipeline (if needed)
        B1.1 → Test → ... → B1.9 → Checkpoint

Step 6: Phase B2 - Security Interceptor (if needed)
        B2.1 → Test → ... → B2.6 → Checkpoint

Step 7: Phase B3 - Waiting Room (if needed)
        B3.1 → Test → ... → B3.8 → Checkpoint
```

---

# TESTING PROTOCOL (Per Task)

1. **Debug**: Check console for errors
2. **Toggle**: Enable/disable feature flag if applicable
3. **Test**: Run specific test or manual QA
4. **Run**: `npm run dev` and verify in browser
5. **Repeat**: Until zero errors

---

# FOLDER STRUCTURE TARGET

```
src/
├── features/
│   ├── watchtower/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── components/
│   ├── tr-ai/
│   │   ├── services/
│   │   ├── state/
│   │   └── components/
│   └── terminal/
│       ├── utils/
│       └── components/
├── services/
│   ├── authService.js
│   ├── databaseService.js
│   ├── emailService.js
│   ├── adminService.js
│   ├── routingService.js
│   └── telegramService.js
├── pages/
│   └── WaitingRoom.jsx
└── components/
    ├── FloatingChatWidget.jsx
    ├── AdminMessagePanel.jsx
    ├── AdminUserActions.jsx
    ├── ConfettiCelebration.jsx
    └── FounderCard.jsx
```

---

**Document Version**: 1.0
**Created**: 2026-03-25
**Protocol**: Strict - One task at a time, full testing loop, modular structure
