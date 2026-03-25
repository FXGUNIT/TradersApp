# Feature Index

Master index of all features in the TradersApp project with their relationships and dependencies.

## Core Features

### 1. Authentication System

- **Status**: Implemented
- **Files**:
  - `src/services/authService.js`
  - `src/hooks/useAuth.js`
  - `src/components/GoogleOnboard.jsx`
- **Dependencies**: Firebase Auth
- **Description**: Handles user login, signup, password reset, Google OAuth, and session management.

### 2. Trading Terminal

- **Status**: Implemented
- **Files**:
  - `src/features/terminal/MainTerminal.jsx`
  - `src/features/terminal/journalMetrics.js`
  - `src/features/terminal/terminalUploadUtils.js`
- **Description**: Main trading interface with trade entry, journal, analytics, and account management.

### 3. AI Intelligence System

- **Status**: Partially Implemented (Backend needed)
- **Files**:
  - `src/services/ai-router.js`
  - `src/services/aiEngines/` (planned)
- **Description**: Quad-core intelligence network with fallback mechanisms for trading decisions.

### 4. 24x7 AI Chat Helpline

- **Status**: Frontend Implemented, Backend Pending
- **Files**:
  - `src/components/ChatHelpline.tsx`
  - `src/components/FloatingChatWidget.jsx` (existing support chat)
  - `src/services/telegramService.js`
- **Dependencies**:
  - Backend: n8n workflows, Telegram Bot API, Groq AI
  - Frontend: React, Tailwind CSS, Lucide icons
- **Description**: Professional 24/7 customer support chat with AI agent, pre-chat form, and Telegram integration.

### 5. Security Systems

- **Status**: Implemented
- **Files**:
  - `src/services/securitySentinel.js`
  - `src/services/securityMonitor.js`
  - `src/services/leakagePreventionModule.js`
  - `src/services/socialEngineeringDetectionModule.js`
- **Description**: Comprehensive security suite including bot detection, malware prevention, and leakage prevention.

### 6. Admin Panel

- **Status**: Implemented
- **Files**:
  - `src/services/adminService.js`
  - `src/components/AdminMessagePanel.jsx`
  - `src/components/AdminUserActions.jsx`
  - `src/components/AdminInvitesPanel.jsx`
- **Description**: Administrative interface for user management, approvals, messaging, and invite system.

### 7. Math Engine & Analytics

- **Status**: Partially Implemented
- **Files**:
  - `src/utils/math-engine.js`
  - `src/utils/performanceBenchmark.js`
  - `src/utils/businessLogicUtils.jsx`
- **Description**: Mathematical calculations for trading, including volatility ratios, dynamic parameters, and risk management.

### 8. UI/UX Components

- **Status**: Implemented
- **Files**:
  - `src/components/ThemeSwitcher.jsx`
  - `src/components/FounderCard.jsx`
  - `src/components/ConfettiCelebration.jsx`
  - `src/components/MessageRenderer.jsx`
  - `src/components/GoogleOnboard.jsx`
- **Description**: Reusable UI components including theme switching, animations, and specialized widgets.

## Feature Dependencies

```
Authentication System
        ↓
Trading Terminal ←→ AI Intelligence System
        ↓                     ↓
Math Engine & Analytics   Security Systems
        ↓                     ↓
Admin Panel               UI/UX Components
        ↓                     ↓
                  24x7 AI Chat Helpline
```

## Data Flow Overview

1. User Authentication → Auth Service → Firebase Auth
2. Trading Operations → Terminal Service → Firebase Realtime Database
3. AI Decisions → AI Router → Groq API (with fallback engines)
4. Security Events → Security Sentinel/Security Monitor → Telegram Alerts
5. Chat Messages → ChatHelpline/FloatingChatWidget → Telegram Service → Telegram Bot
6. Admin Actions → Admin Service → Firebase + Email/Telegram Notifications
7. Analytics → Math Engine → Performance Benchmarks → UI Display

## Implementation Status Legend

- ✅ Fully Implemented and Tested
- ⚠️ Partially Implemented (Backend/Frontend missing)
- ❌ Not Implemented
- 🔧 In Progress

## Contact

For questions about specific features, refer to the individual documentation files in this directory or contact the feature owner listed in each file's header.

---

_Last updated: March 25, 2026_
