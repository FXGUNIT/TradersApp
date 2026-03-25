# TRADERSAPP AI SYSTEM - COMPLETE DOCUMENTATION

> **Last Updated:** March 25, 2026
> **Purpose:** Comprehensive guide for developers working on this project

---

## TABLE OF CONTENTS

1. [AI Engine Overview](#ai-engine-overview)
2. [File Structure](#file-structure)
3. [AI Providers Configuration](#ai-providers-configuration)
4. [LED Status Display System](#led-status-display-system)
5. [Fallback & Deliberation Chain](#fallback--deliberation-chain)
6. [Scheduled Status Checking](#scheduled-status-checking)
7. [AI Persona & Response System](#ai-persona--response-system)
8. [Context Handling for Different Users](#context-handling-for-different-users)
9. [Environment Variables](#environment-variables)
10. [API Functions Reference](#api-functions-reference)
11. [Making Changes](#making-changes)
12. [Theme Switcher System](#12-theme-switcher-system)
13. [Collective Consciousness Page](#13-collective-consciousness-page)

---

## 1. AI ENGINE OVERVIEW

The TradersApp uses **6 AI providers** working together to ensure users always get AI assistance. The system provides:

- **6 LED indicators** showing which AIs are online/offline
- **Automatic fallback** - if one AI fails, the next one takes over
- **Smart scheduling** - checks status every 15 minutes (day) or 1 hour (night) IST
- **High-IQ responses** - rare, valuable insights in humble servant tone
- **Personalized context** - different handling for new vs experienced users

---

## 2. FILE STRUCTURE

```
src/
├── services/
│   └── ai-router.js              # Core AI logic, providers, scheduler
├── components/
│   └── AiEnginesStatus.jsx      # LED display component
├── pages/
│   └── CollectiveConsciousness.jsx  # Main chat interface using AI
└── App.jsx                       # Initializes scheduler on mount
```

---

## 3. AI PROVIDERS CONFIGURATION

### Providers (in order of preference)

| Index | Key | Name | API Endpoint | Key Env Variable |
|-------|-----|------|--------------|------------------|
| 0 | `gemini` | Gemini | `generativelanguage.googleapis.com` | `VITE_GEMINI_PRO_KEY` |
| 1 | `groq` | Groq | `api.groq.com` | `VITE_GROQ_TURBO_KEY` |
| 2 | `openrouter` | OpenRouter | `openrouter.ai` | `VITE_OPENROUTER_KEY` |
| 3 | `cerebras` | Cerebras | `api.cerebras.ai` | `VITE_CEREBRAS_KEY` |
| 4 | `deepseek` | DeepSeek | `api.deepseek.com` | `VITE_DEEPSEEK_KEY` |
| 5 | `sambanova` | SambaNova | `api.sambanova.ai` | `VITE_SAMBANOVA_KEY` |

### Configuration Object (in `ai-router.js`)

```javascript
export const aiEngineStatus = {
  gemini: { name: 'Gemini', key: GEMINI_KEY, online: true, lastPing: null, errors: 0, checkUrl: '...' },
  groq: { name: 'Groq', key: GROQ_KEY, online: true, lastPing: null, errors: 0, checkUrl: '...' },
  openrouter: { name: 'OpenRouter', key: OPENROUTER_KEY, online: true, lastPing: null, errors: 0, checkUrl: '...' },
  cerebras: { name: 'Cerebras', key: CEREBRAS_KEY, online: true, lastPing: null, errors: 0, checkUrl: '...' },
  deepseek: { name: 'DeepSeek', key: DEEPSEEK_KEY, online: true, lastPing: null, errors: 0, checkUrl: '...' },
  sambanova: { name: 'SambaNova', key: SAMBANOVA_KEY, online: true, lastPing: null, errors: 0, checkUrl: '...' },
};
```

---

## 4. LED STATUS DISPLAY SYSTEM

### Component: `AiEnginesStatus.jsx`

**Purpose:** Shows users which AIs are online via LED indicators

**Display Logic (Updated March 25, 2026):**

| Online AIs | Offline AIs | Display |
|------------|-------------|---------|
| 6 | 0 | 6 green LEDs |
| 5 | 1 | 5 green LEDs |
| 4 | 2 | 4 green + 2 red |
| 3 | 3 | 3 green + 3 red |
| 2 | 4 | 2 green + 1 red (capped) |
| 1 | 5 | 1 green + 1 red (capped) |
| 0 | 6 | 0 green + 1 red (capped) |

**Key Rules:**
- Show only LIVE (online) AIs as green indicators
- Show OFFLINE indicators only when >3 AIs are down
- Cap offline indicators at 1 when 4+ are offline
- Show up to 3 offline indicators when 1-3 are offline

**Why This Design:**
- When most AIs are up, we show their live status
- When many fail (>3), we just indicate some are down
- This ensures the display is meaningful and not cluttered

**Colors:**
- Green (Online): `#22c55e` with `box-shadow: 0 0 6px #34d399`
- Red (Offline): `#f87171` with no shadow

**Hover Tooltips:**
- Green: "Gemini: Online", "Groq: Online", etc.
- Red (≤3): "Gemini: Offline", etc.
- Red (>3): "4 AI engines offline", etc.

---

## 5. FALLBACK & DELIBERATION CHAIN

### Function: `runDeliberation(systemPrompt, userPrompt)`

**Purpose:** Try each AI in sequence until one succeeds

**Order of Attempt:**
1. Groq
2. Gemini
3. OpenRouter
4. Cerebras
5. DeepSeek
6. SambaNova

**How it works:**
```javascript
const aiProviders = [
  { name: 'Groq', fn: askGroq, key: 'groq' },
  { name: 'Gemini', fn: askGemini, key: 'gemini' },
  { name: 'OpenRouter', fn: askOpenRouter, key: 'openrouter' },
  { name: 'Cerebras', fn: askCerebras, key: 'cerebras' },
  { name: 'DeepSeek', fn: askDeepSeek, key: 'deepseek' },
  { name: 'SambaNova', fn: askSambaNova, key: 'sambanova' },
];

for (const provider of aiProviders) {
  try {
    const response = await provider.fn(systemPrompt, userPrompt);
    return response;  // Success - return result
  } catch (err) {
    markOffline(provider.key, err.message);  // Mark as offline
    // Continue to next provider
  }
}
throw new Error('All AI models unavailable');  // All failed
```

**Key Functions for Each Provider:**
- `askGemini(systemPrompt, userPrompt)`
- `askGroq(systemPrompt, userPrompt)`
- `askOpenRouter(systemPrompt, userPrompt)`
- `askCerebras(systemPrompt, userPrompt)`
- `askDeepSeek(systemPrompt, userPrompt)`
- `askSambaNova(systemPrompt, userPrompt)`

---

## 6. SCHEDULED STATUS CHECKING

### Time-Based Logic (IST - India Standard Time, UTC+5:30)

| Time Range | Check Frequency | Interval |
|------------|------------------|----------|
| 8:00 AM - 10:00 PM | Every 15 minutes | `15 * 60 * 1000` ms |
| 10:01 PM - 7:59 AM | Every 60 minutes | `60 * 60 * 1000` ms |

### Functions

```javascript
function getISTHour() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.getUTCHours();
}

function getNextIntervalMs() {
  const hour = getISTHour();
  if (hour >= 8 && hour < 22) {
    return 15 * 60 * 1000;  // 15 minutes during day
  }
  return 60 * 60 * 1000;    // 60 minutes at night
}
```

### Starting/Stopping Scheduler

```javascript
// In App.jsx - starts on mount
useEffect(() => {
  startAIStatusScheduler((statuses) => {
    setAiStatuses(statuses);
  });
  return () => stopAIStatusScheduler();
}, []);
```

---

## 7. AI PERSONA & RESPONSE SYSTEM

### Master System Prompt (Updated March 25, 2026)

**File:** `src/services/ai-router.js`

**Prompt defines the AI as:**
> "a humble servant to the user - their dedicated trading muse"

**Key Characteristics:**

1. **Humble Service**
   - "You are here to SERVE, not to show off"
   - "The user is the king/queen - you are their loyal advisor"
   - "Never make them feel like you're giving free advice"

2. **Rare, Valuable Insights**
   - "Give one insight worth more than everything else they've read"
   - "Every answer must contain something the user has NEVER heard before"
   - Share secrets that successful traders know but rarely share

3. **The Secrets Shared**
   - Trading isn't about winning - it's about not losing when it matters most
   - Position sizing > strategy - most blowups from size, not direction
   - 90% of success is psychology, 10% is mechanics
   - The best trades feel uncomfortable
   - Most traders fail because they can't sit with being right while position goes against them

4. **Tone Examples**
   - Instead of "The secret is position sizing" → "If I may share, one thing many successful traders have found helpful..."
   - Instead of "You need to understand psychology" → "There's a perspective that might serve you well..."

5. **Format**
   - 1-3 sentences MAX - punchy but delivered with grace
   - No jargon unless explained simply
   - Lead with insight, not preamble

---

## 8. CONTEXT HANDLING FOR DIFFERENT USERS

### File: `src/pages/CollectiveConsciousness.jsx`

The AI tailors its response based on user profile:

### Scenario 1: New User (No Balance / No History)

```javascript
const scenarioContext = `
CONTEXT: New user visiting for the first time - treat them like royalty visiting your home.
- Welcome them with warmth and genuine respect
- Offer one rare insight as a gift: "I'd be honored to share something that might help you..."
- Make them feel valued and excited to explore
- Keep it brief - honor their time
- End by inviting them to ask anything they want to know more about
`;
```

**Expected Response Style:**
- Warm welcome
- One rare insight as a gift
- "I'd be honored to share..."
- Invites them to explore more

### Scenario 2: Has Balance But No Journal Entries

```javascript
const scenarioContext = `
CONTEXT: A valued member who hasn't started their trading journey yet.
- Serve them with eagerness to help them succeed
- Share one insight that respects their intelligence
- Make them feel you're grateful for the chance to serve them
- Guide them toward what excites them most
`;
```

**Expected Response Style:**
- Eager to help
- Respects their intelligence
- Guides toward their interests

### Scenario 3: Experienced User (Has Journal/History)

```javascript
const scenarioContext = `
CONTEXT: Our valued experienced trader.
- Serve them with the deep respect they deserve
- Challenge them with something worthy of their level
- Reference their journey with genuine interest
- Make them feel seen and valued
`;
```

**Expected Response Style:**
- Deep respect for their level
- Challenges their assumptions
- References their journal/patterns
- Makes them feel seen

---

## 9. ENVIRONMENT VARIABLES

### Required in `.env` file:

```env
VITE_GEMINI_PRO_KEY=your_gemini_key
VITE_GROQ_TURBO_KEY=your_groq_key
VITE_OPENROUTER_KEY=your_openrouter_key
VITE_CEREBRAS_KEY=your_cerebras_key
VITE_DEEPSEEK_KEY=your_deepseek_key
VITE_SAMBANOVA_KEY=your_sambanova_key
```

### How They're Loaded (in `ai-router.js`):

```javascript
const GEMINI_KEY = import.meta.env.VITE_GEMINI_PRO_KEY;
const GROQ_KEY = import.meta.env.VITE_GROQ_TURBO_KEY;
const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_KEY;
const CEREBRAS_KEY = import.meta.env.VITE_CEREBRAS_KEY;
const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_KEY;
const SAMBANOVA_KEY = import.meta.env.VITE_SAMBANOVA_KEY;
```

---

## 10. API FUNCTIONS REFERENCE

### In `ai-router.js`:

| Function | Purpose |
|----------|---------|
| `checkAllAIStatus()` | Checks all 6 AIs by calling their /models endpoint |
| `getAIStatuses()` | Returns array of booleans: `[true, true, false, true, ...]` |
| `getAIStatusesDetailed()` | Returns array of objects with name, online, lastPing, errors |
| `startAIStatusScheduler(callback)` | Starts automatic status checking |
| `stopAIStatusScheduler()` | Stops the scheduler |
| `runDeliberation(systemPrompt, userPrompt)` | Main AI call with fallback |
| `askGemini(systemPrompt, userPrompt)` | Direct Gemini API call |
| `askGroq(systemPrompt, userPrompt)` | Direct Groq API call |
| `askOpenRouter(systemPrompt, userPrompt)` | Direct OpenRouter API call |
| `askCerebras(systemPrompt, userPrompt)` | Direct Cerebras API call |
| `askDeepSeek(systemPrompt, userPrompt)` | Direct DeepSeek API call |
| `askSambaNova(systemPrompt, userPrompt)` | Direct SambaNova API call |
| `markOnline(engine)` | Marks an AI as online |
| `markOffline(engine, err)` | Marks an AI as offline |

---

## 11. MAKING CHANGES

### To Add a New AI Provider:

1. **Add key to `aiEngineStatus` object** in `ai-router.js`
2. **Add API key variable** at top of file
3. **Create `askXxx()` function** for the provider
4. **Add to providers array** in `runDeliberation()`
5. **Add to `AiEnginesStatus.jsx`** - add name to `AI_ENGINE_NAMES` array

### To Change Display Logic:

Modify `src/components/AiEnginesStatus.jsx`

### To Change AI Persona:

Modify `MASTER_INTELLIGENCE_SYSTEM_PROMPT` in `src/services/ai-router.js`

### To Change User Context Logic:

Modify the `scenarioContext` building code in `src/pages/CollectiveConsciousness.jsx`

### To Change Scheduler Timing:

Modify `getISTHour()`, `shouldCheckFrequently()`, or `getNextIntervalMs()` in `src/services/ai-router.js`

---

---

## 12. THEME SWITCHER SYSTEM

### Component: `src/components/ThemeSwitcher.jsx`

A world-class 3-mode theme selector (Day / Night / Eye Comfort).

**Features:**
- Beautiful 3-button pill selector with icons
- Smooth transitions and hover effects
- Active state with gradient blue background
- Works seamlessly with app theme system

**States:**
| Mode | ID | Description |
|------|-----|-------------|
| Day | `day` | Bright & clear - light theme |
| Night | `night` | Dark mode - for low light |
| Eye Comfort | `eye` | Warm tones - reduces eye strain |

**Theme Mapping:**
```javascript
if (currentTheme === "day") {
  return createTheme(false, "BLUE");  // Light mode, blue accent
} else if (currentTheme === "night") {
  return createTheme(true, "BLUE");   // Dark mode, blue accent
} else if (currentTheme === "eye") {
  return createTheme(false, "GOLD");  // Light mode, warm gold accent
}
```

**In App.jsx:**
- `handleThemeChange` updates both `currentTheme` and `isDarkMode` state
- Theme is applied via `_THEME` useMemo which creates theme object
- Old `SystemThemeSync` button removed - now handled by ThemeSwitcher

---

## 13. COLLECTIVE CONSCIOUSNESS PAGE

### File: `src/pages/CollectiveConsciousness.jsx`

The main AI chat interface where users interact with the trading muse.

### Page Overview

This is the primary interface where users talk to the AI. It provides:
- A chat interface with message history
- Visual feedback showing AI processing stages
- Personalized context based on user's account data

### Key Components

#### 12.1 Processing Stages (WarRoomLoader)

The page shows visual feedback during AI processing:

```javascript
const PHASE_DEFINITIONS = [
  { key: 'stage1', label: 'Phase 1: Alpha, Beta, & Groq deployed', icon: '📡' },
  { key: 'stage2', label: 'Phase 2: Gemini synthesizing preliminary intel', icon: '⚖️' },
  { key: 'stage3', label: 'Phase 3: Cross-Examination in progress', icon: '🔍' },
  { key: 'stage4', label: 'Phase 4: Qwen 397B assembling Intelligence Briefing', icon: '🏛️' },
  { key: 'stage5', label: 'Phase 5: Gemini rendering Supreme Verdict', icon: '🏆' },
];
```

**How it works:**
- The `councilStage` object in `ai-router.js` tracks current stage
- Updates to `stage1` → `stage2` → etc. during processing
- Shows corresponding icon and label during each phase

#### 12.2 User Data Context

The page builds context about the user:

```javascript
const hasBalance = userData?.balance && userData.balance > 0;
const hasHistory = localHistory.length > 0;
const journalCount = userData?.journal ? Object.keys(userData.journal).length : 0;
```

This determines which scenario context to provide.

#### 12.3 Message Handling

**State Variables:**
- `messages` - Array of all messages with role, content, timestamp
- `localHistory` - Chat history for AI context (last 6 messages)
- `input` - Current user input
- `isProcessing` - Loading state

**Message Flow:**
1. User submits message → added to messages array
2. Input cleared, isProcessing = true
3. Build context (user profile, history, scenario)
4. Call `runDeliberation(MASTER_INTELLIGENCE_SYSTEM_PROMPT, fullPrompt)`
5. Response added to messages and localHistory
6. isProcessing = false

#### 12.4 Context Building

The page builds three types of context:

**User Profile Context:**
```javascript
const userContext = userData ? `
USER PROFILE:
- Name: ${userData.fullName || 'New Member'}
- Status: ${userData.status || 'PENDING'}
- Balance: ${userData.balance || 0}
- Journal Entries: ${journalCount}
- Join Date: ${userData.joinDate || 'New'}
` : 'USER: New member (no account data available)';
```

**Chat History Context:**
```javascript
const historyContext = localHistory.length > 0 ? `
CHAT HISTORY:
${localHistory.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.substring(0, 200)}`).join('\n')}
` : '';
```

**Scenario Context** (varies by user type - see Section 8)

### Key Imports

```javascript
import { runDeliberation, councilStage, quadCoreStatus, MASTER_INTELLIGENCE_SYSTEM_PROMPT } from '../services/ai-router.js';
```

**Important:** Always pass `MASTER_INTELLIGENCE_SYSTEM_PROMPT` as the first argument to `runDeliberation` - never an empty string.

### UI Components

- **WarRoomLoader**: Shows processing stages with icons and labels
- **MessageRenderer**: Renders messages (supports markdown, code blocks)
- **Chat input**: Text area with Enter to submit, Shift+Enter for new line

### Props Passed from Parent (App.jsx)

The page receives from App.jsx:
- `userData` - User's account data from Firebase
- `theme` - Current theme (day/night/eye)
- `onBack` - Function to navigate back

---

## CHANGELOG

### March 25, 2026 - Major Updates

1. **LED Display System**
   - Changed from 4 to 6 LED indicators
   - Implemented smart display logic (show live vs offline based on count)
   - Added capping for >3 offline AIs

2. **AI Providers**
   - Added Cerebras, DeepSeek, SambaNova as additional providers
   - Updated fallback chain to use all 6 AIs
   - Created individual API functions for each provider

3. **Status Scheduler**
   - Implemented time-based scheduling (15min day / 60min night IST)
   - Created `startAIStatusScheduler()` and `stopAIStatusScheduler()`

4. **AI Persona (MAJOR)**
   - Completely revamped from basic assistant to "humble trading muse"
   - Added rare secrets that successful traders know
   - Changed tone from professor to servant
   - Made responses short, punchy, and valuable

5. **User Context**
   - Added different handling for new users vs experienced users
   - Added scenario-based context injection
   - Made AI aware of user's balance and journal status

---

## TESTING

To test the AI system:

1. Start the app: `npm run dev`
2. Navigate to Collective Consciousness page
3. Ask questions and observe responses
4. Check browser console for status check logs
5. Watch network tab for API calls

To test fallback:
- Temporarily remove an API key from `.env`
- Observe automatic fallback to next provider

---

## DEBUGGING TIPS

- Check browser console for "⚠️ X failed: error" messages
- `aiEngineStatus` object has current status of all AIs
- `getAIStatuses()` returns current boolean array
- Watch network tab for /models API calls (every 15 or 60 mins)
- Check `councilStage.current` for AI processing status

---

## IMPORTANT NOTES FOR DEVELOPERS

1. **Never pass empty string as first argument to `runDeliberation`** - always use `MASTER_INTELLIGENCE_SYSTEM_PROMPT`

2. **The AI is designed to sound humble, not smart** - don't change the tone to be more "expert-like"

3. **Keep responses short** - the prompt explicitly says 1-3 sentences max

4. **The display shows LIVE AIs first** - this is intentional to show backup AIs are active

5. **IST timezone is used for scheduling** - this is because the app serves primarily Indian traders

---

*End of Documentation*