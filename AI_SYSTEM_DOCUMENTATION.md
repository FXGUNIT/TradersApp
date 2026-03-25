/**
 * ============================================================================
 * AI ENGINE STATUS SYSTEM - COMPREHENSIVE DOCUMENTATION
 * ============================================================================
 * 
 * This document explains how the AI Engine LED status system works in TradersApp.
 * It covers the display logic, scheduling, fallback mechanism, and all related code.
 * 
 * =============================================================================
 * OVERVIEW
 * =============================================================================
 * 
 * The TradersApp uses 6 AI providers for processing AI requests. The status
 * system does two things:
 * 1. Displays LED indicators showing which AIs are online/offline
 * 2. Automatically falls back to reserve AIs when primary ones fail
 * 
 * =============================================================================
 * AI PROVIDERS
 * =============================================================================
 * 
 * The app uses 6 AI providers (in order of preference):
 * 
 * | Index | Key        | Name        | API Endpoint                          |
 * |-------|------------|-------------|----------------------------------------|
 * | 0     | gemini     | Gemini      | generativelanguage.googleapis.com     |
 * | 1     | groq       | Groq        | api.groq.com                          |
 * | 2     | openrouter | OpenRouter  | openrouter.ai                         |
 * | 3     | cerebras   | Cerebras    | api.cerebras.ai                       |
 * | 4     | deepseek   | DeepSeek    | api.deepseek.com                      |
 * | 5     | sambanova  | SambaNova   | api.sambanova.ai                      |
 * 
 * API Keys are loaded from environment variables:
 * - VITE_GEMINI_PRO_KEY
 * - VITE_GROQ_TURBO_KEY
 * - VITE_OPENROUTER_KEY
 * - VITE_CEREBRAS_KEY
 * - VITE_DEEPSEEK_KEY
 * - VITE_SAMBANOVA_KEY
 * 
 * =============================================================================
 * FILE STRUCTURE
 * =============================================================================
 * 
 * Files involved in this system:
 * 
 * 1. src/services/ai-router.js
 *    - Contains all AI provider configurations
 *    - Handles API calls to each provider
 *    - Implements fallback chain logic
 *    - Manages status checking scheduler
 * 
 * 2. src/components/AiEnginesStatus.jsx
 *    - React component that renders the LED indicators
 *    - Implements display logic (when to show live vs offline)
 * 
 * 3. src/App.jsx
 *    - Imports and uses AiEnginesStatus component
 *    - Initializes the status scheduler on mount
 *    - Manages aiStatuses state
 * 
 * =============================================================================
 * DISPLAY LOGIC (LED INDICATORS)
 * =============================================================================
 * 
 * The LED display follows these rules:
 * 
 * RULE 1: Show only LIVE (online) AIs as green indicators
 * RULE 2: Show OFFLINE indicators only when >3 AIs are down
 * RULE 3: Cap offline indicators at 1 when 4+ are offline
 * RULE 4: Show up to 3 offline indicators when 1-3 are offline
 * 
 * Example scenarios:
 * 
 * | Online AIs | Offline AIs | Display                              |
 * |------------|-------------|--------------------------------------|
 * | 6          | 0           | 6 green LEDs                         |
 * | 5          | 1           | 5 green LEDs                         |
 * | 4          | 2           | 4 green + 2 red LEDs                |
 * | 3          | 3           | 3 green + 3 red LEDs                |
 * | 2          | 4           | 2 green + 1 red (capped)            |
 * | 1          | 5           | 1 green + 1 red (capped)            |
 * | 0          | 6           | 0 green + 1 red (capped)            |
 * 
 * This ensures that when most AIs are up, we show their live status.
 * Only when many AIs fail do we show the offline indicators.
 * 
 * =============================================================================
 * STATUS CHECKING SCHEDULER
 * =============================================================================
 * 
 * The scheduler runs in src/services/ai-router.js using setInterval.
 * 
 * TIMING LOGIC (IST - India Standard Time, UTC+5:30):
 * 
 * | Time Range         | Check Frequency | Reason                    |
 * |--------------------|-----------------|---------------------------|
 * | 8:00 AM - 10:00 PM | Every 15 mins   | Peak usage hours         |
 * | 10:01 PM - 7:59 AM | Every 60 mins   | Low usage (overnight)    |
 * 
 * Functions:
 * 
 * - getISTHour(): Returns current hour in IST (0-23)
 * - shouldCheckFrequently(): Returns true if between 8AM-10PM IST
 * - getNextIntervalMs(): Returns 15min or 60min based on time
 * 
 * =============================================================================
 * STATUS CHECK FUNCTIONS
 * =============================================================================
 * 
 * 1. checkAllAIStatus()
 *    - Iterates through all 6 AI providers
 *    - Makes a GET request to each provider's /models endpoint
 *    - Marks online if response is OK, offline otherwise
 *    - Returns array of { engine, online, reason } objects
 * 
 * 2. startAIStatusScheduler(callback)
 *    - Initializes the interval timer
 *    - Runs check immediately on call
 *    - Calls callback with new statuses on each check
 *    - Automatically adjusts interval based on time of day
 * 
 * 3. stopAIStatusScheduler()
 *    - Clears the interval timer
 *    - Called in useEffect cleanup in App.jsx
 * 
 * 4. getAIStatuses()
 *    - Returns simple array of booleans [true/false, ...] x 6
 *    - Used by App.jsx to pass to AiEnginesStatus component
 * 
 * 5. getAIStatusesDetailed()
 *    - Returns array of objects with name, online, lastPing, errors
 *    - Can be used for debugging or detailed monitoring
 * 
 * =============================================================================
 * FALLBACK MECHANISM
 * =============================================================================
 * 
 * When an AI request is made (via runDeliberation), the system:
 * 
 * 1. Tries each AI in this order:
 *    Groq → Gemini → OpenRouter → Cerebras → DeepSeek → SambaNova
 * 
 * 2. If one fails, marks it as offline and tries the next
 * 
 * 3. If all fail, throws "All AI models unavailable" error
 * 
 * 4. On success, marks that AI as online and resets error count
 * 
 * This ensures continuous service even when some AIs are down.
 * 
 * =============================================================================
 * STATE MANAGEMENT IN APP.JSX
 * =============================================================================
 * 
 * In App.jsx:
 * 
 * 1. State declaration:
 *    const [aiStatuses, setAiStatuses] = useState([true, true, true, true, true, true]);
 * 
 * 2. Scheduler initialization (useEffect):
 *    useEffect(() => {
 *      startAIStatusScheduler((statuses) => {
 *        setAiStatuses(statuses);
 *      });
 *      return () => stopAIStatusScheduler();
 *    }, []);
 * 
 * 3. Rendering:
 *    <AiEnginesStatus statuses={aiStatuses} />
 * 
 * =============================================================================
 * COLOR SCHEME
 * =============================================================================
 * 
 * Green (Online): #22c55e with box-shadow: 0 0 6px #34d399
 * Red (Offline):   #f87171 with no box-shadow
 * Label:          #64748b (gray), uppercase, font-weight: 700
 * 
 * =============================================================================
 * HOVER TOOLTIPS
 * =============================================================================
 * 
 * - Green LED: "Gemini: Online" / "Groq: Online" / etc.
 * - Red LED (≤3 offline): "Gemini: Offline" / "Groq: Offline" / etc.
 * - Red LED (>3 offline): "4 AI engines offline" / "5 AI engines offline" / etc.
 * 
 * =============================================================================
 * MAKING CHANGES
 * =============================================================================
 * 
 * To modify this system:
 * 
 * 1. To add a new AI provider:
 *    - Add key to aiEngineStatus object in ai-router.js
 *    - Add API key variable at top of file
 *    - Add askXxx function for the provider
 *    - Add to providers array in runDeliberation()
 * 
 * 2. To change display logic:
 *    - Modify AiEnginesStatus.jsx component
 *    - The component receives statuses array as prop
 * 
 * 3. To change timing:
 *    - Modify getISTHour(), shouldCheckFrequently(), getNextIntervalMs()
 *    - In ai-router.js
 * 
 * 4. To change which AIs are tried first:
 *    - Modify the providers array in runDeliberation()
 *    - In ai-router.js
 * 
 * =============================================================================
 * ENVIRONMENT VARIABLES
 * =============================================================================
 * 
 * Required in .env file:
 * 
 * VITE_GEMINI_PRO_KEY=your_gemini_key
 * VITE_GROQ_TURBO_KEY=your_groq_key
 * VITE_OPENROUTER_KEY=your_openrouter_key
 * VITE_CEREBRAS_KEY=your_cerebras_key
 * VITE_DEEPSEEK_KEY=your_deepseek_key
 * VITE_SAMBANOVA_KEY=your_sambanova_key
 * 
 * =============================================================================
 * TESTING
 * =============================================================================
 * 
 * To test the system:
 * 
 * 1. Start the app: npm run dev
 * 2. Look for AI LED indicators in the UI
 * 3. Check browser console for status check logs
 * 4. To test fallback: temporarily remove an API key from .env
 * 
 * =============================================================================
 * DEBUGGING TIPS
 * =============================================================================
 * 
 * - Check browser console for "⚠️ X failed: error" messages
 * - aiEngineStatus object in ai-router.js has current status
 * - getAIStatuses() returns current boolean array
 * - Watch network tab for /models API calls (every 15 or 60 mins)
 * 
 * =============================================================================
 */

import React from 'react';

const AI_ENGINE_NAMES = ['Gemini', 'Groq', 'OpenRouter', 'Cerebras', 'DeepSeek', 'SambaNova'];

const AiEnginesStatus = ({ statuses = [true, true, true, true, true, true] }) => {
  const normalizedStatuses = statuses.length >= 6 ? statuses : [...statuses, ...Array(6 - statuses.length).fill(true)];
  
  const offlineIndices = normalizedStatuses.map((ok, idx) => ok ? -1 : idx).filter(idx => idx >= 0);
  const liveIndices = normalizedStatuses.map((ok, idx) => ok ? idx : -1).filter(idx => idx >= 0);
  
  const offlineCount = offlineIndices.length;
  
  const displayOfflineIndicators = offlineCount > 3 ? 1 : Math.min(offlineCount, 3);
  
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>AI</span>
      {liveIndices.map(idx => (
        <span 
          key={`live-${idx}`} 
          title={`${AI_ENGINE_NAMES[idx]}: Online`} 
          style={{ 
            width: 10, 
            height: 10, 
            borderRadius: 6, 
            display: 'inline-block', 
            background: '#22c55e', 
            boxShadow: '0 0 6px #34d399'
          }} 
        />
      ))}
      {displayOfflineIndicators > 0 && Array(displayOfflineIndicators).fill(0).map((_, i) => (
        <span 
          key={`offline-${i}`} 
          title={offlineCount > 3 ? `${offlineCount} AI engines offline` : `${AI_ENGINE_NAMES[offlineIndices[i]]}: Offline`}
          style={{ 
            width: 10, 
            height: 10, 
            borderRadius: 6, 
            display: 'inline-block', 
            background: '#f87171', 
            boxShadow: 'none'
          }} 
        />
      ))}
    </div>
  );
};

export default AiEnginesStatus;

// Full ai-router.js implementation reference below:

/*
// AI Engine Configuration (from ai-router.js)
const AI_ENGINE_NAMES = ['Gemini', 'Groq', 'OpenRouter', 'Cerebras', 'DeepSeek', 'SambaNova'];

const aiEngineStatus = {
  gemini: { name: 'Gemini', key: GEMINI_KEY, online: true, lastPing: null, errors: 0, checkUrl: 'https://generativelanguage.googleapis.com/v1/models' },
  groq: { name: 'Groq', key: GROQ_KEY, online: true, lastPing: null, errors: 0, checkUrl: 'https://api.groq.com/openai/v1/models' },
  openrouter: { name: 'OpenRouter', key: OPENROUTER_KEY, online: true, lastPing: null, errors: 0, checkUrl: 'https://openrouter.ai/api/v1/models' },
  cerebras: { name: 'Cerebras', key: CEREBRAS_KEY, online: true, lastPing: null, errors: 0, checkUrl: 'https://api.cerebras.ai/v1/models' },
  deepseek: { name: 'DeepSeek', key: DEEPSEEK_KEY, online: true, lastPing: null, errors: 0, checkUrl: 'https://api.deepseek.com/v1/models' },
  sambanova: { name: 'SambaNova', key: SAMBANOVA_KEY, online: true, lastPing: null, errors: 0, checkUrl: 'https://api.sambanova.ai/v1/models' },
};

// Status check functions
function getISTHour() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.getUTCHours();
}

function getNextIntervalMs() {
  const hour = getISTHour();
  if (hour >= 8 && hour < 22) {
    return 15 * 60 * 1000;  // 15 minutes during 8AM-10PM IST
  }
  return 60 * 60 * 1000;    // 60 minutes during 10PM-8AM IST
}

// Fallback chain order
const aiProviders = [
  { name: 'Groq', fn: askGroq, key: 'groq' },
  { name: 'Gemini', fn: askGemini, key: 'gemini' },
  { name: 'OpenRouter', fn: askOpenRouter, key: 'openrouter' },
  { name: 'Cerebras', fn: askCerebras, key: 'cerebras' },
  { name: 'DeepSeek', fn: askDeepSeek, key: 'deepseek' },
  { name: 'SambaNova', fn: askSambaNova, key: 'sambanova' },
];
*/