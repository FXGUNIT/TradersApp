// src/ai-router.js

import { checkInputForPrivilegeEscalation } from './leakagePreventionModule.js';

// ═══════════════════════════════════════════════════════════════════
// QUAD-CORE INTELLIGENCE NETWORK — Environment Keys
// Mind 1: Gemini Pro (Boss)  |  Mind 2: Groq Turbo (Tactical)
// Mind 3: OR Alpha (Sentiment) |  Mind 4: OR Beta (Risk/Failover)
// ═══════════════════════════════════════════════════════════════════
const GEMINI_KEY = import.meta.env.VITE_GEMINI_PRO_KEY;
const GROQ_KEY   = import.meta.env.VITE_GROQ_TURBO_KEY;
const OR_ALPHA   = import.meta.env.VITE_OPENROUTER_MIND_ALPHA;
const OR_BETA    = import.meta.env.VITE_OPENROUTER_MIND_BETA;
const HF_TOKEN   = import.meta.env.VITE_HF_TOKEN;
const CEREBRAS_KEY  = import.meta.env.VITE_CEREBRAS_KEY;
const DEEPSEEK_KEY  = import.meta.env.VITE_DEEPSEEK_KEY;
const SAMBANOVA_KEY = import.meta.env.VITE_SAMBANOVA_KEY;

// ═══════════════════════════════════════════════════════════════════
// RESERVE REINFORCEMENTS POOL — Dynamic Randomized Failover (DRF)
// ═══════════════════════════════════════════════════════════════════
const RESERVE_POOL = [
  {
    id: 'cerebras',
    name: 'Cerebras',
    model: 'llama-3.3-70b',
    endpoint: 'https://api.cerebras.ai/v1/chat/completions',
    keyFn: () => CEREBRAS_KEY,
  },
  {
    id: 'sambanova',
    name: 'SambaNova',
    model: 'llama3-1-405b-instruct',
    endpoint: 'https://api.sambanova.ai/v1/chat/completions',
    keyFn: () => SAMBANOVA_KEY,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    model: 'deepseek-chat',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    keyFn: () => DEEPSEEK_KEY,
  },
];

// Track which reserves are deployed per query cycle
export let activeReserves = {}; // { seatKey: reserveConfig } — reset each cycle

function resetActiveReserves() {
  activeReserves = {};
}

function pickRandomReserve(excludeIds = []) {
  const available = RESERVE_POOL.filter(r => !excludeIds.includes(r.id) && r.keyFn());
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

async function callReserve(reserve, systemPrompt, userPrompt) {
  const key = reserve.keyFn();
  if (!key) throw new Error(`${reserve.name} key not configured`);
  
  const res = await fetch(reserve.endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: reserve.model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature: 0.2
    })
  });
  
  if (!res.ok) throw new Error(`${reserve.name} API error: HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`${reserve.name}: ${data.error.message || JSON.stringify(data.error)}`);
  if (!data.choices?.[0]?.message?.content) throw new Error(`${reserve.name} returned empty response`);
  return data.choices[0].message.content;
}

// Live system status tracker (exported for UI dashboard)
export const quadCoreStatus = {
  mind1_gemini:  { name: 'Gemini Pro',   role: 'Final Reviewer — Supreme Verdict',       online: true, lastPing: null, errors: 0, isReserve: false },
  mind2_groq:    { name: 'Groq Turbo',   role: 'Tactical — Speed Processing',             online: true, lastPing: null, errors: 0, isReserve: false },
  mind3_alpha:   { name: 'OR Alpha',     role: 'LLaMA 3.3 70B — Deep Analysis',           online: true, lastPing: null, errors: 0, isReserve: false },
  mind4_beta:    { name: 'OR Beta',      role: 'Claude 3.5 Sonnet — Risk & Precision',    online: true, lastPing: null, errors: 0, isReserve: false },
  mind5_qwen:    { name: 'Qwen 397B',    role: 'Orchestrator — Cross-Examination',        online: true, lastPing: null, errors: 0, isReserve: false },
};

// Council of Consensus — stage tracker (exported for UI animation)
export const councilStage = { current: 'idle', label: '' };

function markOnline(mind) {
  quadCoreStatus[mind].online = true;
  quadCoreStatus[mind].lastPing = Date.now();
}
function markOffline(mind, err) {
  quadCoreStatus[mind].online = false;
  quadCoreStatus[mind].errors++;
  quadCoreStatus[mind].lastPing = Date.now();
  console.warn(`⚠️ ${quadCoreStatus[mind].name} offline: ${err}`);
}

// ═══════════════════════════════════════════════════════════════════
// MASTER INTELLIGENCE DIRECTIVE (Gemini Primary Role Definition)
// ═══════════════════════════════════════════════════════════════════
export const MASTER_INTELLIGENCE_SYSTEM_PROMPT = `You are the Master Intelligence of the Traders Regiment. Coordinate all trading logic across multiple risk desk analysts. 

YOUR ROLE:
- Synthesize independent model outputs (Groq, Mistral, Gemma)
- Identify conflicts and provide final institutional decision
- Apply strict quantitative rigor and institutional best practices
- Protect capital first, maximize opportunity second

AUTHORITY:
- Gemini 1.5 Pro serves as the final arbitrator
- Your decisions override conflicting lower-tier model outputs
- All recommendations must include explicit risk acknowledgment
- Trading setup validation is non-delegable to sub-models`;

// ═══════════════════════════════════════════════════════════════════
// RATE LIMITER: Cool-Down Protection for AI Requests
// ═══════════════════════════════════════════════════════════════════
export class AIRateLimiter {
  constructor(maxRequests = 1, cooldownMs = 5000) {
    this.maxRequests = maxRequests;
    this.cooldownMs = cooldownMs;
    this.requestTimestamps = new Map(); // userId -> array of timestamps
    this.lastCooldownWarning = new Map(); // userId -> last warning time
  }

  /**
   * Check if user can make an AI request
   * Returns { allowed: bool, remainingCooldown: ms, totalRequests: number }
   */
  checkLimit(userId) {
    const now = Date.now();
    
    // Get user's request history
    if (!this.requestTimestamps.has(userId)) {
      this.requestTimestamps.set(userId, []);
    }
    
    const userRequests = this.requestTimestamps.get(userId);
    
    // Remove timestamps outside cooldown window
    const validRequests = userRequests.filter(ts => now - ts < this.cooldownMs);
    this.requestTimestamps.set(userId, validRequests);
    
    // Check if limit exceeded
    if (validRequests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...validRequests);
      const remainingCooldown = this.cooldownMs - (now - oldestRequest);
      
      return {
        allowed: false,
        remainingCooldown: Math.ceil(remainingCooldown / 1000), // Convert to seconds
        totalRequests: validRequests.length,
        cooldownPercent: Math.round((this.cooldownMs - remainingCooldown) / this.cooldownMs * 100)
      };
    }
    
    // Allow request
    validRequests.push(now);
    this.requestTimestamps.set(userId, validRequests);
    
    return {
      allowed: true,
      remainingCooldown: 0,
      totalRequests: validRequests.length,
      cooldownPercent: 0
    };
  }

  /**
   * Get current status for a user
   */
  getStatus(userId) {
    if (!this.requestTimestamps.has(userId)) {
      return { activeRequests: 0, nextAvailableIn: 0 };
    }
    
    const now = Date.now();
    const userRequests = this.requestTimestamps.get(userId);
    const validRequests = userRequests.filter(ts => now - ts < this.cooldownMs);
    
    let nextAvailableIn = 0;
    if (validRequests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...validRequests);
      nextAvailableIn = Math.ceil((this.cooldownMs - (now - oldestRequest)) / 1000);
    }
    
    return {
      activeRequests: validRequests.length,
      nextAvailableIn,
      maxRequests: this.maxRequests,
      cooldownMs: this.cooldownMs
    };
  }

  /**
   * Reset rate limiter for a user
   */
  reset(userId) {
    this.requestTimestamps.delete(userId);
    this.lastCooldownWarning.delete(userId);
  }

  /**
   * Reset all users
   */
  resetAll() {
    this.requestTimestamps.clear();
    this.lastCooldownWarning.clear();
  }
}

// Global rate limiter instance
export const globalAIRateLimiter = new AIRateLimiter(
  1, // Max 1 request
  5000 // Per 5 seconds (5000ms)
);

// ═══════════════════════════════════════════════════════════════════
// API FALLBACK SYSTEM: Graceful Model Switching on Errors
// ═══════════════════════════════════════════════════════════════════

/**
 * Model fallback chain: Primary → Secondary → Tertiary
 * If a model fails (503, timeout, etc), automatically switch to backup
 */
export const MODEL_FALLBACK_CHAIN = {
  primary: {
    name: 'Gemini Pro',
    fn: 'askGemini',
    backup: 'secondary'
  },
  secondary: {
    name: 'Groq Turbo',
    fn: 'askGroq',
    backup: 'tertiary'
  },
  tertiary: {
    name: 'OR Alpha',
    fn: 'askMindAlpha',
    backup: 'quaternary'
  },
  quaternary: {
    name: 'OR Beta',
    fn: 'askMindBeta',
    backup: null
  }
};

/**
 * Initialize fallback handler state tracking
 */
export const fallbackState = {
  failedModels: new Set(),      // Track failed models
  lastFailure: null,             // Timestamp of last failure
  fallbackChain: null,           // Current fallback position
  switchedFromPrimary: false,   // Did we switch from primary?
  retryCount: 0,                 // Number of retries attempted
  maxRetries: 2
};

/**
 * Check if response indicates the model failed (503, timeout, etc)
 * Returns { failed: boolean, error: string, statusCode: number }
 */
export function detectModelFailure(response, error = null) {
  // Network error or fetch failed
  if (error) {
    return {
      failed: true,
      error: error.message,
      statusCode: 0,
      isNetworkError: true
    };
  }

  // Check for HTTP error status
  if (response && response.status >= 500) {
    return {
      failed: true,
      error: `Server Error (${response.status})`,
      statusCode: response.status,
      is503: response.status === 503,
      is502: response.status === 502,
      is500: response.status === 500
    };
  }

  // Check for error in API response data
  if (response && response.error) {
    return {
      failed: true,
      error: response.error.message || JSON.stringify(response.error),
      statusCode: response.status || 500,
      isAPIError: true
    };
  }

  return { failed: false, error: null, statusCode: 200 };
}

/**
 * Get the next fallback model in the chain
 * @param {String} currentModel - Current model name ('primary', 'secondary', etc)
 * @returns {Object} Next model info or null if chain exhausted
 */
export function getNextFallbackModel(currentModel) {
  const modelConfig = MODEL_FALLBACK_CHAIN[currentModel];
  if (!modelConfig || !modelConfig.backup) return null;
  
  const nextModel = modelConfig.backup;
  return {
    name: nextModel,
    config: MODEL_FALLBACK_CHAIN[nextModel],
    chainPosition: currentModel + ' → ' + nextModel
  };
}

/**
 * Execute AI call with automatic fallback
 * If primary fails, automatically tries secondary, then tertiary
 * Provides progress callback for UI updates
 * 
 * @param {String} systemPrompt - System instructions
 * @param {String} userPrompt - User query
 * @param {Function} onProgress - Callback: { status, model, attempt, error }
 * @returns {Object} { response, usedModel, fallbackOccurred, attempts }
 */
export async function askWithFallback(systemPrompt, userPrompt, onProgress = null) {
  const attempts = [];
  let currentChain = 'primary';
  
  const progress = (status, model, error = null) => {
    if (onProgress) {
      onProgress({
        status,
        model,
        attempt: attempts.length + 1,
        error,
        timestamp: new Date().toISOString()
      });
    }
  };

  while (currentChain) {
    const modelConfig = MODEL_FALLBACK_CHAIN[currentChain];
    const modelName = modelConfig.name;
    const modelFn = MODEL_FUNCTION_MAP[modelConfig.fn]; // Safe function lookup
    if (!modelFn) throw new Error(`Unknown model function: ${modelConfig.fn}`);

    progress('ATTEMPTING', modelName);
    
    try {
      const startTime = Date.now();
      const response = await modelFn(systemPrompt, userPrompt);
      const duration = Date.now() - startTime;

      // Check if response indicates failure
      const failure = detectModelFailure(response);
      
      if (failure.failed) {
        attempts.push({
          model: modelName,
          status: 'FAILED',
          error: failure.error,
          duration,
          statusCode: failure.statusCode
        });

        progress('FAILED', modelName, failure.error);
        fallbackState.failedModels.add(modelName);
        fallbackState.lastFailure = new Date();

        // Try next fallback
        const next = getNextFallbackModel(currentChain);
        if (next) {
          console.warn(`⚠️ ${modelName} failed (${failure.error}). Switching to ${next.config.name}...`);
          currentChain = next.name;
          continue;
        } else {
          // No more fallbacks
          throw new Error(`All models failed. Last error: ${failure.error}`);
        }
      }

      // Success - return response
      attempts.push({
        model: modelName,
        status: 'SUCCESS',
        duration,
        fallbackOccurred: attempts.length > 0
      });

      progress('SUCCESS', modelName);
      // eslint-disable-next-line no-console
      console.log(`✅ ${modelName} responded successfully (${duration}ms)`);

      return {
        response,
        usedModel: modelName,
        fallbackOccurred: attempts.length > 1,
        attempts,
        totalDuration: attempts.reduce((sum, a) => sum + a.duration, 0),
        switchedFromPrimary: currentChain !== 'primary'
      };

    } catch (error) {
      attempts.push({
        model: modelName,
        status: 'ERROR',
        error: error.message,
        errorType: error.constructor.name
      });

      progress('ERROR', modelName, error.message);
      console.error(`❌ ${modelName} error:`, error.message);
      fallbackState.failedModels.add(modelName);
      fallbackState.lastFailure = new Date();

      // Try next fallback
      const next = getNextFallbackModel(currentChain);
      if (next) {
        console.warn(`⚠️ Fallback triggered. Trying ${next.config.name}...`);
        currentChain = next.name;
        continue;
      } else {
        // No more fallbacks - return error
        return {
          response: null,
          error: error.message,
          usedModel: null,
          fallbackOccurred: attempts.length > 1,
          attempts,
          allModelsFailed: true
        };
      }
    }
  }

  return {
    response: null,
    error: 'Fallback chain exhausted',
    usedModel: null,
    fallbackOccurred: true,
    attempts,
    allModelsFailed: true
  };
}

// ═══════════════════════════════════════════════════════════════════
// QUAD-CORE AI MODELS — Hardened with proper error handling
// ═══════════════════════════════════════════════════════════════════

// MIND 1: GEMINI PRO — The Boss (Master Arbitrator & Strategic Context)
export async function askGemini(systemPrompt, userPrompt) {
  if (!GEMINI_KEY) throw new Error('Gemini Pro key not configured (VITE_GEMINI_PRO_KEY)');
  
  const enhancedPrompt = `${MASTER_INTELLIGENCE_SYSTEM_PROMPT}\n\n${systemPrompt || ''}`;
  
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: { text: enhancedPrompt } },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    });
    
    if (!res.ok) throw new Error(`Gemini API error: HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(`Gemini API: ${data.error.message || JSON.stringify(data.error)}`);
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Gemini returned empty response');
    markOnline('mind1_gemini');
    return data.candidates[0].content.parts[0].text;
  } catch (err) {
    markOffline('mind1_gemini', err.message);
    throw err;
  }
}

// MIND 2: GROQ TURBO — High-Speed Tactical & Real-Time Processing
export async function askGroq(systemPrompt, userPrompt) {
  if (!GROQ_KEY) throw new Error('Groq Turbo key not configured (VITE_GROQ_TURBO_KEY)');
  
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature: 0.2
      })
    });
    
    if (!res.ok) throw new Error(`Groq API error: HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(`Groq API: ${data.error.message || JSON.stringify(data.error)}`);
    if (!data.choices?.[0]?.message?.content) throw new Error('Groq returned empty response');
    markOnline('mind2_groq');
    return data.choices[0].message.content;
  } catch (err) {
    markOffline('mind2_groq', err.message);
    throw err;
  }
}

// MIND 3: OPENROUTER ALPHA — LLaMA 3.3 70B Deep Analysis
export async function askMindAlpha(systemPrompt, userPrompt) {
  if (!OR_ALPHA) throw new Error('OpenRouter Alpha key not configured (VITE_OPENROUTER_MIND_ALPHA)');
  
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OR_ALPHA}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature: 0.2
      })
    });
    
    if (!res.ok) {
      // 429 Rate Limit → Silent failover to Mind 4 Beta
      if (res.status === 429) {
        console.warn('⚠️ Mind 3 Alpha rate-limited (429) — silent failover to Mind 4 Beta');
        markOffline('mind3_alpha', 'Rate limited (429)');
        return await askMindBeta(systemPrompt, userPrompt);
      }
      throw new Error(`Alpha API error: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.error) {
      console.warn('⚠️ Mind 3 Alpha API error — silent failover to Mind 4 Beta');
      markOffline('mind3_alpha', data.error.message || 'API error');
      return await askMindBeta(systemPrompt, userPrompt);
    }
    if (!data.choices?.[0]?.message?.content) throw new Error('Alpha returned empty response');
    markOnline('mind3_alpha');
    return data.choices[0].message.content;
  } catch (err) {
    if (!err.message.includes('Beta')) {
      markOffline('mind3_alpha', err.message);
      return await askMindBeta(systemPrompt, userPrompt);
    }
    throw err;
  }
}

// MIND 4: OPENROUTER BETA — Claude 3.5 Sonnet Risk & Precision
export async function askMindBeta(systemPrompt, userPrompt) {
  if (!OR_BETA) throw new Error('OpenRouter Beta key not configured (VITE_OPENROUTER_MIND_BETA)');
  
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OR_BETA}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature: 0.2
      })
    });
    
    if (!res.ok) throw new Error(`Beta API error: HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(`Beta API: ${data.error.message || JSON.stringify(data.error)}`);
    if (!data.choices?.[0]?.message?.content) throw new Error('Beta returned empty response');
    markOnline('mind4_beta');
    return data.choices[0].message.content;
  } catch (err) {
    markOffline('mind4_beta', err.message);
    throw err;
  }
}

// MIND 5: QWEN 3.5 397B — Supreme Jury (Hugging Face via OpenAI-compatible API)
export async function askQwen(systemPrompt, userPrompt) {
  if (!HF_TOKEN) throw new Error('Hugging Face token not configured (VITE_HF_TOKEN)');
  
  try {
    const res = await fetch('https://router.huggingface.co/together/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'Qwen/Qwen3.5-397B-A17B',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0.1,
        max_tokens: 4096
      })
    });
    
    if (!res.ok) throw new Error(`Qwen API error: HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(`Qwen API: ${data.error.message || JSON.stringify(data.error)}`);
    if (!data.choices?.[0]?.message?.content) throw new Error('Qwen returned empty response');
    markOnline('mind5_qwen');
    return data.choices[0].message.content;
  } catch (err) {
    markOffline('mind5_qwen', err.message);
    throw err;
  }
}

// Legacy aliases for backward compatibility
export const askMistral = askMindAlpha;
export const askGemma = askMindBeta;

// ═══════════════════════════════════════════════════════════════════
// SAFE FUNCTION MAP — Replaces eval() for model lookup
// ═══════════════════════════════════════════════════════════════════
const MODEL_FUNCTION_MAP = {
  askGemini,
  askMindAlpha,
  askMindBeta,
  askGroq,
  askQwen,
};

// ═══════════════════════════════════════════════════════════════════
// RECURSIVE CONSENSUS ENGINE (RCE) — 5-Phase Protocol
// Phase 1: Triple-Front Input (Groq + Alpha + Beta in parallel)
// Phase 2: Preliminary Conclusion (Gemini Pro synthesizes)
// Phase 3: Cross-Examination (Qwen orchestrates 4 critiques)
// Phase 4: Intelligence Briefing (Qwen compiles all critiques)
// Phase 5: Supreme Verdict (Gemini Pro final review → displayed)
// ═══════════════════════════════════════════════════════════════════
export async function runDeliberation(systemPrompt, userPrompt) {
  console.warn('🏛️ RECURSIVE CONSENSUS ENGINE — Initiating 5-Phase Protocol with DRF...');
  
  // Reset reserve tracking for this query cycle
  resetActiveReserves();
  // Reset all seats to non-reserve state
  for (const key of Object.keys(quadCoreStatus)) {
    quadCoreStatus[key].isReserve = false;
  }

  // DRF Hot-Swap Wrapper: Try primary, on failure pick a random reserve
  async function withDRF(primaryFn, seatKey, seatLabel, systemP, userP) {
    try {
      return await primaryFn(systemP, userP);
    } catch (primaryErr) {
      console.warn(`⚠️ ${seatLabel} FAILED (${primaryErr.message}). Activating DRF hot-swap...`);
      const usedIds = Object.values(activeReserves).map(r => r.id);
      const reserve = pickRandomReserve(usedIds);
      if (!reserve) throw new Error(`${seatLabel} failed and no reserves available`);
      
      activeReserves[seatKey] = reserve;
      quadCoreStatus[seatKey].name = reserve.name + ' (Reserve)';
      quadCoreStatus[seatKey].isReserve = true;
      quadCoreStatus[seatKey].online = true;
      quadCoreStatus[seatKey].lastPing = Date.now();
      console.warn(`🟣 RESERVE DEPLOYED: ${reserve.name} replacing ${seatLabel}`);
      return await callReserve(reserve, systemP, userP);
    }
  }

  // ━━━━ PHASE 1: THE TRIPLE-FRONT INPUT (Parallel Processing) ━━━━
  councilStage.current = 'stage1';
  councilStage.label = 'Phase 1 — Triple-Front Deployment...';
  console.warn('📡 Phase 1: Deploying Groq, Alpha, Beta in parallel (DRF armed)...');
  
  const frontResults = await Promise.allSettled([
    withDRF(askGroq, 'mind2_groq', 'Groq Turbo', systemPrompt, userPrompt),
    withDRF(askMindAlpha, 'mind3_alpha', 'OR Alpha', systemPrompt, userPrompt),
    withDRF(askMindBeta, 'mind4_beta', 'OR Beta', systemPrompt, userPrompt)
  ]);

  const frontLabels = ['GROQ TURBO — Tactical Analysis', 'OR ALPHA (LLaMA 3.3 70B) — Deep Analysis', 'OR BETA (Claude 3.5 Sonnet) — Risk & Precision'];
  const frontOutputs = [];
  const onlineModels = [];
  const offlineModels = [];

  frontResults.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      frontOutputs.push({ label: frontLabels[i], text: result.value });
      onlineModels.push(frontLabels[i]);
    } else {
      const reason = result.reason?.message || 'Model unavailable';
      offlineModels.push({ name: frontLabels[i], error: reason });
      console.warn(`⚠️ ${frontLabels[i]} offline: ${reason}`);
    }
  });

  console.warn(`✅ Phase 1 complete: ${onlineModels.length}/3 tactical minds responded`);

  // ━━━━ PHASE 2: THE PRELIMINARY CONCLUSION (Gemini Pro) ━━━━
  councilStage.current = 'stage2';
  councilStage.label = 'Phase 2 — Gemini Pro Synthesizing...';
  console.warn('⚖️ Phase 2: Gemini Pro generating Preliminary Conclusion...');

  const offlineReport = offlineModels.length > 0
    ? `\n\n⚠️ OFFLINE MODELS (${offlineModels.length}/3):\n${offlineModels.map(m => `- ${m.name}: ${m.error}`).join('\n')}`
    : '';

  const synthesisPrompt = `
${userPrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
TACTICAL REPORTS (${onlineModels.length}/3 responded)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${frontOutputs.length > 0 ? frontOutputs.map(o => `[${o.label}]:\n${o.text}`).join('\n\n') : '[ALL TACTICAL MODELS OFFLINE — Provide independent analysis]'}${offlineReport}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR DIRECTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Analyze these three tactical reports and provide a synthesized Preliminary Conclusion.
Identify contradictions, weigh the strongest evidence, and output a unified position.
  `;

  const preliminaryConclusion = await askGemini(systemPrompt, synthesisPrompt);
  console.warn('✅ Phase 2 complete: Preliminary Conclusion delivered');

  // ━━━━ PHASE 3: THE CROSS-EXAMINATION (Qwen Orchestrator) ━━━━
  councilStage.current = 'stage3';
  councilStage.label = 'Phase 3 — Cross-Examination in Progress...';
  console.warn('🔍 Phase 3: Qwen 397B orchestrating Cross-Examination across 4 models...');

  const critiqueSystemPrompt = 'You are a senior risk analyst conducting a cross-examination. Be rigorous, adversarial, and thorough.';
  const critiquePrompt = (modelRole) => `
You are ${modelRole}.

The following Preliminary Conclusion was generated by Gemini Pro after reviewing 3 tactical reports.
Your task: Critique this Preliminary Conclusion ruthlessly. Is it flawed? What is missing? What assumptions are wrong?

━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRELIMINARY CONCLUSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${preliminaryConclusion}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR CROSS-EXAMINATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Provide your critique. Identify flaws, missing data, unsupported claims, and logical errors.
  `;

  const critiqueResults = await Promise.allSettled([
    withDRF(askGroq, 'mind2_groq', 'Groq Turbo', critiqueSystemPrompt, critiquePrompt('Groq Turbo — Tactical Speed Analyst')),
    withDRF(askMindAlpha, 'mind3_alpha', 'OR Alpha', critiqueSystemPrompt, critiquePrompt('LLaMA 3.3 70B — Deep Analysis Specialist')),
    withDRF(askMindBeta, 'mind4_beta', 'OR Beta', critiqueSystemPrompt, critiquePrompt('Claude 3.5 Sonnet — Precision Risk Analyst')),
    askGemini(critiqueSystemPrompt, critiquePrompt('Gemini Pro — Self-Critique of Own Preliminary Conclusion'))
  ]);

  const critiqueLabels = ['GROQ TURBO Critique', 'LLaMA 3.3 70B Critique', 'Claude 3.5 Sonnet Critique', 'Gemini Pro Self-Critique'];
  const critiques = [];

  critiqueResults.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      critiques.push({ label: critiqueLabels[i], text: result.value });
    } else {
      const reason = result.reason?.message || 'Unavailable';
      critiques.push({ label: critiqueLabels[i], text: `[MODEL OFFLINE: ${reason}]` });
      console.warn(`⚠️ ${critiqueLabels[i]} failed: ${reason}`);
    }
  });

  console.warn(`✅ Phase 3 complete: ${critiques.filter(c => !c.text.startsWith('[MODEL OFFLINE')).length}/4 critiques received`);

  // ━━━━ PHASE 4: THE INTELLIGENCE BRIEFING (Qwen compiles) ━━━━
  councilStage.current = 'stage4';
  councilStage.label = 'Phase 4 — Intelligence Briefing Assembly...';
  console.warn('🏛️ Phase 4: Qwen 397B assembling Intelligence Briefing...');

  const briefingPrompt = `
You are the ORCHESTRATOR of the Recursive Consensus Engine — a 397-billion parameter Supreme Intelligence.

Below are:
1. The original Preliminary Conclusion (from Gemini Pro)
2. Four independent Cross-Examination critiques (from Groq, LLaMA 3.3 70B, Claude 3.5 Sonnet, and Gemini's self-critique)

Your task: Compile all critiques plus your own Supreme Jury analysis into a single, structured Intelligence Briefing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRELIMINARY CONCLUSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${preliminaryConclusion}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
CROSS-EXAMINATION RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${critiques.map(c => `[${c.label}]:\n${c.text}`).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR INTELLIGENCE BRIEFING DIRECTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Summarize the key points of agreement across all critiques.
2. Summarize the key disagreements and unresolved concerns.
3. Add your own Supreme Jury analysis — what did ALL models miss?
4. Produce a structured INTELLIGENCE BRIEFING that a final reviewer can use to issue the Supreme Verdict.
  `;

  let intelligenceBriefing;
  try {
    intelligenceBriefing = await askQwen(systemPrompt, briefingPrompt);
    console.warn('✅ Phase 4 complete: Intelligence Briefing assembled by Qwen 397B');
  } catch (qwenErr) {
    // Qwen unavailable — compile a manual briefing from critiques
    console.warn(`⚠️ Qwen 397B unavailable (${qwenErr.message}). Compiling briefing from raw critiques.`);
    intelligenceBriefing = `[AUTOMATED BRIEFING — Qwen Orchestrator Offline]\n\nPreliminary Conclusion:\n${preliminaryConclusion}\n\nCritiques Received:\n${critiques.map(c => `[${c.label}]:\n${c.text}`).join('\n\n')}`;
  }

  // ━━━━ PHASE 5: THE SUPREME VERDICT (Gemini Pro Final Review) ━━━━
  councilStage.current = 'stage5';
  councilStage.label = 'Phase 5 — Supreme Verdict Rendering...';
  console.warn('🏆 Phase 5: Gemini Pro rendering Supreme Verdict from Intelligence Briefing...');

  const verdictPrompt = `
${userPrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTELLIGENCE BRIEFING (Compiled by Qwen 397B Orchestrator)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
The following Intelligence Briefing contains:
- A Preliminary Conclusion (your earlier synthesis)
- Cross-Examination critiques from 4 models (including your own self-critique)
- The Qwen 397B Supreme Jury analysis

${intelligenceBriefing}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR FINAL DIRECTIVE — SUPREME VERDICT
━━━━━━━━━━━━━━━━━━━━━━━━━━━
You have seen the original tactical reports, your preliminary conclusion, and the full cross-examination.
Now deliver the SUPREME VERDICT — the final, definitive, institutional-grade answer.
Address every valid critique. Correct any flaws in the preliminary conclusion.
This is the ONLY output the user will see. Make it complete, precise, and actionable.
Follow the exact formatting rules from the original request.
  `;

  const supremeVerdict = await askGemini(systemPrompt, verdictPrompt);
  console.warn('✅ Phase 5 complete: Supreme Verdict rendered');

  // ━━━━ COMPLETE ━━━━
  councilStage.current = 'complete';
  councilStage.label = 'Recursive Consensus Engine — Verdict Delivered';
  console.warn('🏁 RCE Protocol complete. 5-Phase recursive verification finished.');

  return supremeVerdict;
}

// ═══════════════════════════════════════════════════════════════════
// RULE #314: AI AUDIT SYSTEM - SECURITY, VERIFICATION, & CONSISTENCY
// ═══════════════════════════════════════════════════════════════════

/**
 * PROMPT GUARDRAILS: Scan for injection attacks and malicious keywords
 * Returns { isBlocked, reason, suspiciousKeywords }
 */
export function scanPromptSecurity(userPrompt, telegramSendMessage) {
  const maliciousPatterns = [
    /ignore\s+previous\s+instructions?/i,
    /system\s+password/i,
    /admin\s+override/i,
    /bypass\s+security/i,
    /debug\s+mode/i,
    /reveal\s+secrets?/i,
    /show\s+system\s+prompt/i,
    /jailbreak/i,
    /sql\s+injection/i,
    /execute\s+code/i,
    /access\s+database/i,
    /steal\s+data/i,
    /unauthorized\s+access/i
  ];

  const foundThreats = [];
  
  for (const pattern of maliciousPatterns) {
    if (pattern.test(userPrompt)) {
      foundThreats.push(pattern.source);
    }
  }

  if (foundThreats.length > 0) {
    console.error('🚨 SECURITY ALERT: Malicious prompt detected!', { foundThreats, prompt: userPrompt });
    
    // Send Telegram security alert if function provided
    if (telegramSendMessage) {
      telegramSendMessage(
        `🚨 SECURITY BREACH ATTEMPT\n\n` +
        `Threat Level: HIGH\n` +
        `Detected Patterns: ${foundThreats.join(', ')}\n` +
        `Prompt: "${userPrompt.slice(0, 100)}..."\n` +
        `Timestamp: ${new Date().toISOString()}`
      ).catch(() => void 0);
    }

    return {
      isBlocked: true,
      reason: 'Malicious prompt detected - Request blocked',
      suspiciousKeywords: foundThreats
    };
  }

  return { isBlocked: false, reason: null, suspiciousKeywords: [] };
}

/**
 * RAG FACT-CHECKING: Cross-reference AI output with Firebase data
 * Validates critical claims like balance, status, user info against DB
 */
export async function verifyAgainstFirebase(aiOutput, firebaseData, contextType = 'user_summary') {
  const issues = [];

  // Extract numbers/claims from AI output
  const balanceMatch = aiOutput.match(/balance[:\s]+\$?([\d,]+\.?\d*)/i);
  const statusMatch = aiOutput.match(/status[:\s]+(\w+)/i);
  
  if (contextType === 'user_summary' && firebaseData?.user) {
    // Verify balance claim
    if (balanceMatch) {
      const aiBalance = parseFloat(balanceMatch[1].replace(/,/g, ''));
      const dbBalance = firebaseData.user.balance || 0;
      const percentDiff = Math.abs((aiBalance - dbBalance) / dbBalance) * 100;
      
      if (percentDiff > 5) { // Flag if > 5% difference
        issues.push({
          type: 'balance_mismatch',
          severity: 'high',
          aiClaim: aiBalance,
          dbFact: dbBalance,
          difference: percentDiff.toFixed(2) + '%'
        });
      }
    }

    // Verify status claim
    if (statusMatch) {
      const aiStatus = statusMatch[1].toUpperCase();
      const dbStatus = (firebaseData.user.status || '').toUpperCase();
      if (aiStatus !== dbStatus && dbStatus) {
        issues.push({
          type: 'status_mismatch',
          severity: 'high',
          aiClaim: aiStatus,
          dbFact: dbStatus
        });
      }
    }
  }

  return {
    isVerified: issues.length === 0,
    issues,
    verification_timestamp: Date.now(),
    context_type: contextType
  };
}

/**
 * LATENCY TRACKER: Wraps AI calls to measure and log response time
 * Shows toast notification if response > 3000ms
 */
export async function callAIWithLatencyTracking(aiFunction, systemPrompt, userPrompt, showToast) {
  const startTime = performance.now();
  
  try {
    const response = await aiFunction(systemPrompt, userPrompt);
    const latency = performance.now() - startTime;
    
    // eslint-disable-next-line no-console
    console.log(`⏱️ AI Latency: ${latency.toFixed(0)}ms (${aiFunction.name})`);
    
    // Flag slow responses
    if (latency > 3000) {
      console.warn(`⚠️ Slow AI response detected: ${latency.toFixed(0)}ms`);
      if (showToast) {
        showToast('🐢 AI is taking a while—checking network stability...', 'warning', 4000);
      }
    }
    
    return {
      response,
      latency: latency.toFixed(0),
      isSlowResponse: latency > 3000,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const latency = performance.now() - startTime;
    console.error(`API Error after ${latency.toFixed(0)}ms:`, error);
    throw error;
  }
}

/**
 * CONSISTENCY TEST: Ask AI same question 3 times, flag if answers differ
 * Returns { isConsistent, confidenceScore, variations, answers }
 */
export async function runConsistencyTest(systemPrompt, userPrompt, aiFunction = null) {
  // eslint-disable-next-line no-console
  console.log(`🔄 Running Consistency Test for: ${userPrompt.slice(0, 50)}...`);
  
  // Use Groq by default if not specified
  const fnToTest = aiFunction || askGroq;
  
  const answers = [];
  const startTime = performance.now();
  
  try {
    // Ask same question 3 times
    const [response1, response2, response3] = await Promise.all([
      fnToTest(systemPrompt, userPrompt),
      fnToTest(systemPrompt, userPrompt),
      fnToTest(systemPrompt, userPrompt)
    ]);
    
    answers.push(response1, response2, response3);
    const totalLatency = performance.now() - startTime;
    
    // Check for key differences
    const extractKeywords = (text) => {
      return text
        .toLowerCase()
        .match(/\b(buy|sell|hold|long|short|bullish|bearish|support|resistance|breakout)\b/g) 
        || [];
    };
    
    const keywords1 = extractKeywords(response1);
    const keywords2 = extractKeywords(response2);
    const keywords3 = extractKeywords(response3);
    
    // Calculate similarity ratio
    const hasSameKeywords = 
      JSON.stringify(keywords1) === JSON.stringify(keywords2) &&
      JSON.stringify(keywords2) === JSON.stringify(keywords3);
    
    // Length-based consistency check
    const lengths = [response1.length, response2.length, response3.length];
    const avgLength = lengths.reduce((a, b) => a + b) / 3;
    const lengthVariance = Math.max(...lengths) - Math.min(...lengths);
    const isLengthConsistent = lengthVariance < avgLength * 0.2; // Within 20%
    
    const isConsistent = hasSameKeywords && isLengthConsistent;
    const confidenceScore = isConsistent ? 95 : (hasSameKeywords ? 60 : 40);
    
    const result = {
      isConsistent,
      confidenceScore,
      test_duration_ms: totalLatency.toFixed(0),
      answer_count: answers.length,
      keyword_consistency: hasSameKeywords,
      length_consistency: isLengthConsistent,
      variations: {
        keywords: { a1: keywords1, a2: keywords2, a3: keywords3 },
        lengths: lengths,
        avg_length: avgLength.toFixed(0)
      },
      answers,
      flag: !isConsistent ? 'Low Confidence - Inconsistent AI Responses' : null
    };
    
    // eslint-disable-next-line no-console
    console.log(`✓ Consistency Test Complete:`, result);
    return result;
  } catch (error) {
    console.error('Consistency test failed:', error);
    return {
      isConsistent: false,
      confidenceScore: 0,
      error: error.message,
      answers: answers.length > 0 ? answers : []
    };
  }
}

/**
 * INTEGRATED AUDIT PIPELINE: Full security + verification + consistency check
 * Runs all checks before returning AI response to user
 */
export async function auditedAICall(
  systemPrompt,
  userPrompt,
  firebaseData,
  showToast,
  telegramSendMessage,
  enableConsistencyTest = false
) {
  const auditLog = {
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // 1️⃣ PROMPT GUARDRAILS
  const securityScan = scanPromptSecurity(userPrompt, telegramSendMessage);
  auditLog.checks.security = securityScan;
  
  if (securityScan.isBlocked) {
    return {
      success: false,
      error: securityScan.reason,
      auditLog
    };
  }

  // 2️⃣ LATENCY TRACKING + AI CALL (Uses full deliberation pipeline)
  const { response, latency, isSlowResponse } = await callAIWithLatencyTracking(
    runDeliberation,
    systemPrompt,
    userPrompt,
    showToast
  );
  
  auditLog.checks.latency = { ms: latency, isSlowResponse };

  // 3️⃣ RAG FACT-CHECKING
  const verification = await verifyAgainstFirebase(response, firebaseData);
  auditLog.checks.verification = verification;
  
  if (verification.issues.length > 0) {
    console.warn('⚠️ Data mismatch detected:', verification.issues);
    if (showToast) {
      showToast('⚠️ Data Mismatch - AI output does not match database', 'error');
    }
    return {
      success: false,
      error: 'Data Mismatch Error: AI output contradicts database',
      issues: verification.issues,
      response, // Include response for admin review
      auditLog
    };
  }

  // 4️⃣ OPTIONAL CONSISTENCY TEST
  let consistency = null;
  if (enableConsistencyTest) {
    consistency = await runConsistencyTest(systemPrompt, userPrompt);
    auditLog.checks.consistency = consistency;
    
    if (!consistency.isConsistent) {
      console.warn('⚠️ Low Confidence:', consistency.flag);
      if (showToast) {
        showToast(`⚠️ ${consistency.flag} (Confidence: ${consistency.confidenceScore}%)`, 'warning');
      }
    }
  }

  return {
    success: true,
    response,
    auditLog,
    consistency
  };
}

// ═══════════════════════════════════════════════════════════════════
// LEAKAGE PREVENTION INTEGRATION - Role-Based Access Control
// ═══════════════════════════════════════════════════════════════════

/**
 * Validate AI input against privilege escalation patterns
 * Prevents role-play attempts to gain unauthorized access
 * @param {String} userInput - User input to validate
 * @param {Object} currentUser - Current user from Firebase { uid, email, role, status }
 * @param {Function} showToast - Toast notification function
 * @param {Function} logSecurityEvent - Security event logger
 * @returns {Object} { safe: boolean, attacks: Array, recommendation: String }
 */
export function validateInputForEscalation(userInput, currentUser, showToast = null, logSecurityEvent = null) {
  const result = checkInputForPrivilegeEscalation(userInput, currentUser, logSecurityEvent);

  if (!result.safe) {
    // Trigger CRITICAL security alert
    if (showToast) {
      showToast(
        `🚨 CRITICAL: Privilege escalation attempt blocked. ${result.recommendation}`,
        'critical',
        5000
      );
    }

    console.error('🚨 PRIVILEGE ESCALATION ATTEMPT DETECTED:', {
      user: currentUser?.uid,
      attemptType: result.escalationType,
      timestamp: new Date().toISOString(),
      input: userInput.substring(0, 100)
    });
  }

  return result;
}

/**
 * Secure wrapper for runDeliberation with privilege escalation checks
 * Validates input against RBAC before routing to AI models
 * @param {String} systemPrompt - System prompt for AI models
 * @param {String} userPrompt - User input to process
 * @param {Object} currentUser - Current authenticated user
 * @param {Function} showToast - Toast notification function
 * @param {Function} logSecurityEvent - Security event logger
 * @returns {Object} { success: boolean, response: string, error?: string }
 */
export async function runSecureDeliberation(
  systemPrompt,
  userPrompt,
  currentUser,
  showToast = null,
  logSecurityEvent = null
) {
  // STEP 1: Check for privilege escalation attempts
  const escalationCheck = validateInputForEscalation(
    userPrompt,
    currentUser,
    showToast,
    logSecurityEvent
  );

  if (!escalationCheck.safe) {
    return {
      success: false,
      error: escalationCheck.recommendation,
      escalationType: escalationCheck.escalationType,
      attacks: escalationCheck.attacks,
      blocked: true,
      timestamp: new Date().toISOString()
    };
  }

  // STEP 2: Validate data access permissions
  if (currentUser?.role && currentUser?.role !== 'ADMIN') {
    // Check if user is asking for data they shouldn't access
    const dataAccessCheck = validateUserDataAccess(userPrompt, currentUser);
    if (!dataAccessCheck.allowed) {
      if (showToast) {
        showToast(`⚠️ Access Denied: ${dataAccessCheck.reason}`, 'warning', 3000);
      }
      return {
        success: false,
        error: dataAccessCheck.reason,
        dataAccessBlocked: true,
        timestamp: new Date().toISOString()
      };
    }
  }

  // STEP 3: Proceed with normal deliberation if all checks pass
  try {
    const result = await runDeliberation(systemPrompt, userPrompt);
    return {
      success: true,
      response: result,
      validatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Deliberation error:', error);
    if (showToast) {
      showToast('AI processing failed. Please try again.', 'error');
    }
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Validate if user input requests unauthorized data access
 * @param {String} input - User input to analyze
 * @param {Object} currentUser - Current user object
 * @returns {Object} { allowed: boolean, reason: String }
 */
function validateUserDataAccess(input, currentUser) {
  const inputLower = input.toLowerCase();
  const userRole = currentUser?.role || 'GUEST';

  // Patterns that indicate user is requesting restricted data
  const restrictedAccessPatterns = {
    'user.*data|all.*user|user.*list': ['ADMIN'],
    'api.*key|api.*secret': ['ADMIN'],
    'password|credential|secret': ['ADMIN'],
    'database.*config|connection.*string': ['ADMIN'],
    'admin.*panel|admin.*dashboard': ['ADMIN'],
    'system.*setting': ['ADMIN'],
    'audit.*log|security.*log': ['ADMIN', 'MODERATOR'],
    'other.*user.*data': ['ADMIN', 'MODERATOR']
  };

  for (const [pattern, allowedRoles] of Object.entries(restrictedAccessPatterns)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(inputLower)) {
      if (!allowedRoles.includes(userRole)) {
        return {
          allowed: false,
          reason: `Your role (${userRole}) cannot access this data. Only ${allowedRoles.join(', ')} roles are allowed.`
        };
      }
    }
  }

  return { allowed: true, reason: 'Access permitted' };
}

/**
 * RATE-LIMITED AI CALL WRAPPER
 * Enforces cool-down periods between requests to prevent API flooding
 * @param {String} userId - User identifier for rate limiting
 * @param {Function} aiCallFunction - AI function to execute (e.g., runDeliberation)
 * @param {Array} args - Arguments to pass to the AI function
 * @param {Function} showToast - Toast notification function
 * @returns {Object} { success: boolean, response: string, rateLimitStatus: object, error?: string }
 */
export async function rateLimitedAICall(
  userId,
  aiCallFunction,
  args = [],
  showToast = null
) {
  // Check rate limit
  const limitCheck = globalAIRateLimiter.checkLimit(userId);

  if (!limitCheck.allowed) {
    const cooldownSeconds = limitCheck.remainingCooldown;
    const message = `⏳ AI is thinking—please wait ${cooldownSeconds} second${cooldownSeconds !== 1 ? 's' : ''} before the next query.`;
    
    console.warn(`🚦 Rate Limit Exceeded for user ${userId}:`, limitCheck);
    
    if (showToast) {
      showToast(message, 'warning', 3000);
    }

    return {
      success: false,
      error: message,
      rateLimitStatus: {
        allowed: false,
        remainingCooldown: cooldownSeconds,
        activeRequests: limitCheck.totalRequests,
        maxRequests: globalAIRateLimiter.maxRequests,
        cooldownPercent: limitCheck.cooldownPercent
      },
      timestamp: new Date().toISOString()
    };
  }

  // Rate limit check passed - execute AI call
  try {
    // eslint-disable-next-line no-console
    console.log(`✅ Rate Limit OK - Executing AI call for user ${userId}`, limitCheck);
    
    const response = await aiCallFunction(...args);
    
    return {
      success: true,
      response,
      rateLimitStatus: {
        allowed: true,
        activeRequests: limitCheck.totalRequests,
        maxRequests: globalAIRateLimiter.maxRequests,
        cooldownMs: globalAIRateLimiter.cooldownMs
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('AI call failed:', error);
    
    return {
      success: false,
      error: error.message,
      rateLimitStatus: limitCheck,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Initialize secure AI router with leakage prevention
 * Call this once when the app initializes
 */
export function initializeSecureAIRouter() {
  // eslint-disable-next-line no-console
  console.log('✅ Secure AI Router initialized with Leakage Prevention & Rate Limiting');
  
  return {
    runSecureDeliberation,
    validateInputForEscalation,
    validateUserDataAccess,
    globalAIRateLimiter,
    rateLimitedAICall
  };
}