// src/ai-router.js - Simplified AI Router

import { checkInputForPrivilegeEscalation } from './leakagePreventionModule.js';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_PRO_KEY;
const GROQ_KEY = import.meta.env.VITE_GROQ_TURBO_KEY;

export const quadCoreStatus = {
  mind1_gemini: { name: 'Gemini', role: 'Primary AI', online: true, lastPing: null, errors: 0, isReserve: false },
  mind2_groq: { name: 'Groq', role: 'Secondary AI', online: true, lastPing: null, errors: 0, isReserve: false },
};

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

export const MASTER_INTELLIGENCE_SYSTEM_PROMPT = `You are a helpful AI assistant for Traders Regiment. Answer questions directly and helpfully.`;

// Gemini API
export async function askGemini(systemPrompt, userPrompt) {
  if (!GEMINI_KEY) throw new Error('Gemini key not configured');
  
  const prompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
  
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 }
    })
  });
  
  if (!res.ok) throw new Error(`Gemini error: HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Gemini error');
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Gemini empty response');
  
  markOnline('mind1_gemini');
  return data.candidates[0].content.parts[0].text;
}

// Groq API
export async function askGroq(systemPrompt, userPrompt) {
  if (!GROQ_KEY) throw new Error('Groq key not configured');
  
  const combined = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
  
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: combined }],
      temperature: 0.3,
      max_tokens: 2048
    })
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error: HTTP ${res.status} - ${err.slice(0, 100)}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Groq error');
  if (!data.choices?.[0]?.message?.content) throw new Error('Groq empty response');
  
  markOnline('mind2_groq');
  return data.choices[0].message.content;
}

// Main deliberation - tries both and returns first success
export async function runDeliberation(systemPrompt, userPrompt) {
  console.warn('🤖 AI Processing...');
  councilStage.current = 'stage1';
  councilStage.label = 'Thinking...';

  // Try Groq first
  try {
    const response = await askGroq(systemPrompt, userPrompt);
    councilStage.current = 'complete';
    councilStage.label = 'Done';
    return response;
  } catch (err) {
    console.warn(`⚠️ Groq failed: ${err.message}`);
    markOffline('mind2_groq', err.message);
  }

  // Try Gemini second
  try {
    const response = await askGemini(systemPrompt, userPrompt);
    councilStage.current = 'complete';
    councilStage.label = 'Done';
    return response;
  } catch (err) {
    console.warn(`⚠️ Gemini failed: ${err.message}`);
    markOffline('mind1_gemini', err.message);
  }

  councilStage.current = 'complete';
  councilStage.label = 'Error';
  throw new Error('All AI models unavailable');
}

// Fallback wrapper
export async function askGeminiWithFallback(systemPrompt, userPrompt) {
  return runDeliberation(systemPrompt, userPrompt);
}

// Security functions
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

  const foundThreats = maliciousPatterns.filter(p => p.test(userPrompt));

  if (foundThreats.length > 0) {
    if (telegramSendMessage) {
      telegramSendMessage(`🚨 SECURITY: Malicious prompt detected: ${foundThreats.join(', ')}`).catch(() => {});
    }
    return { isBlocked: true, reason: 'Malicious prompt detected', suspiciousKeywords: foundThreats };
  }

  return { isBlocked: false, reason: null, suspiciousKeywords: [] };
}

export function validateInputForEscalation(userInput, currentUser, showToast = null, logSecurityEvent = null) {
  return checkInputForPrivilegeEscalation(userInput, currentUser, logSecurityEvent);
}

export async function callAIWithLatencyTracking(aiFunction, systemPrompt, userPrompt, showToast) {
  const start = performance.now();
  try {
    const response = await aiFunction(systemPrompt, userPrompt);
    const latency = performance.now() - start;
    console.log(`⏱️ AI Latency: ${latency.toFixed(0)}ms`);
    return { response, latency: latency.toFixed(0), timestamp: new Date().toISOString() };
  } catch (error) {
    const latency = performance.now() - start;
    throw error;
  }
}

export const AIRateLimiter = class {
  constructor(maxRequests = 1, cooldownMs = 5000) {
    this.maxRequests = maxRequests;
    this.cooldownMs = cooldownMs;
    this.timestamps = new Map();
  }
  
  checkLimit(userId) {
    const now = Date.now();
    if (!this.timestamps.has(userId)) this.timestamps.set(userId, []);
    const valid = this.timestamps.get(userId).filter(ts => now - ts < this.cooldownMs);
    this.timestamps.set(userId, valid);
    
    if (valid.length >= this.maxRequests) {
      const remaining = this.cooldownMs - (now - Math.min(...valid));
      return { allowed: false, remainingCooldown: Math.ceil(remaining / 1000) };
    }
    
    valid.push(now);
    return { allowed: true, remainingCooldown: 0 };
  }
};

export const globalAIRateLimiter = new AIRateLimiter(1, 5000);

export async function rateLimitedAICall(userId, aiCallFunction, args = [], showToast = null) {
  const check = globalAIRateLimiter.checkLimit(userId);
  if (!check.allowed) {
    if (showToast) showToast(`⏳ Please wait ${check.remainingCooldown}s before next query`, 'warning');
    return { success: false, error: `Rate limited. Try in ${check.remainingCooldown}s` };
  }
  
  try {
    const response = await aiCallFunction(...args);
    return { success: true, response };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
