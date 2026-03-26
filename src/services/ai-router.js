// src/ai-router.js - Simplified AI Router

import { checkInputForPrivilegeEscalation } from "./leakagePreventionModule.js";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_PRO_KEY || "";
const GROQ_KEY = import.meta.env.VITE_GROQ_TURBO_KEY || "";
const OPENROUTER_KEY =
  import.meta.env.VITE_OPENROUTER_MIND_ALPHA ||
  import.meta.env.VITE_OPENROUTER_MIND_BETA ||
  "";
const CEREBRAS_KEY = import.meta.env.VITE_CEREBRAS_KEY || "";
const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_KEY || "";
const SAMBANOVA_KEY = import.meta.env.VITE_SAMBANOVA_KEY || "";

export const aiEngineStatus = {
  gemini: {
    name: "Gemini",
    key: GEMINI_KEY,
    online: !!GEMINI_KEY,
    lastPing: null,
    errors: 0,
    checkUrl: `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_KEY}`,
  },
  groq: {
    name: "Groq",
    key: GROQ_KEY,
    online: !!GROQ_KEY,
    lastPing: null,
    errors: 0,
    checkUrl: "https://api.groq.com/openai/v1/models",
  },
  openrouter: {
    name: "OpenRouter",
    key: OPENROUTER_KEY,
    online: !!OPENROUTER_KEY,
    lastPing: null,
    errors: 0,
    checkUrl: "https://openrouter.ai/api/v1/models",
  },
  cerebras: {
    name: "Cerebras",
    key: CEREBRAS_KEY,
    online: !!CEREBRAS_KEY,
    lastPing: null,
    errors: 0,
    checkUrl: "https://api.cerebras.ai/v1/models",
  },
  deepseek: {
    name: "DeepSeek",
    key: DEEPSEEK_KEY,
    online: !!DEEPSEEK_KEY,
    lastPing: null,
    errors: 0,
    checkUrl: "https://api.deepseek.com/v1/models",
  },
  sambanova: {
    name: "SambaNova",
    key: SAMBANOVA_KEY,
    online: !!SAMBANOVA_KEY,
    lastPing: null,
    errors: 0,
    checkUrl: "https://api.sambanova.ai/v1/models",
  },
};

export const AI_ENGINES = Object.keys(aiEngineStatus);

export const councilStage = { current: "idle", label: "" };

function markOnline(engine) {
  if (aiEngineStatus[engine]) {
    aiEngineStatus[engine].online = true;
    aiEngineStatus[engine].lastPing = Date.now();
    aiEngineStatus[engine].errors = 0;
  }
}

function markOffline(engine, err) {
  if (aiEngineStatus[engine]) {
    aiEngineStatus[engine].online = false;
    aiEngineStatus[engine].errors++;
    aiEngineStatus[engine].lastPing = Date.now();
    console.warn(`⚠️ ${aiEngineStatus[engine].name} offline: ${err}`);
  }
}

export function getAIStatuses() {
  return AI_ENGINES.map((engine) => aiEngineStatus[engine].online);
}

export function getAIStatusesDetailed() {
  return AI_ENGINES.map((engine) => ({
    name: aiEngineStatus[engine].name,
    online: aiEngineStatus[engine].online,
    lastPing: aiEngineStatus[engine].lastPing,
    errors: aiEngineStatus[engine].errors,
  }));
}

function getISTHour() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.getUTCHours();
}

function isWithinActiveHours() {
  const hour = getISTHour();
  return hour >= 8 && hour < 22;
}

function shouldCheckFrequently() {
  const hour = getISTHour();
  return hour >= 8 && hour < 22;
}

function getNextIntervalMs() {
  const hour = getISTHour();
  if (hour >= 8 && hour < 22) {
    return 15 * 60 * 1000;
  }
  return 60 * 60 * 1000;
}

let statusCheckInterval = null;

export async function checkAllAIStatus() {
  const results = [];

  for (const engine of AI_ENGINES) {
    const config = aiEngineStatus[engine];
    if (!config.key) {
      markOffline(engine, "No API key configured");
      results.push({ engine, online: false, reason: "No API key" });
      continue;
    }

    try {
      let response;
      switch (engine) {
        case "gemini":
          response = await fetch(config.checkUrl, {
            method: "GET",
          });
          break;
        case "groq":
          response = await fetch(config.checkUrl, {
            method: "GET",
            headers: { Authorization: `Bearer ${config.key}` },
          });
          break;
        case "openrouter":
          response = await fetch(config.checkUrl, {
            method: "GET",
            headers: { Authorization: `Bearer ${config.key}` },
          });
          break;
        case "cerebras":
          response = await fetch(config.checkUrl, {
            method: "GET",
            headers: { Authorization: `Bearer ${config.key}` },
          });
          break;
        case "deepseek":
          response = await fetch(config.checkUrl, {
            method: "GET",
            headers: { Authorization: `Bearer ${config.key}` },
          });
          break;
        case "sambanova":
          response = await fetch(config.checkUrl, {
            method: "GET",
            headers: { Authorization: `Bearer ${config.key}` },
          });
          break;
      }

      if (response && response.ok) {
        markOnline(engine);
        results.push({ engine, online: true });
      } else {
        markOffline(engine, `HTTP ${response?.status}`);
        results.push({
          engine,
          online: false,
          reason: `HTTP ${response?.status}`,
        });
      }
    } catch (err) {
      markOffline(engine, err.message);
      results.push({ engine, online: false, reason: err.message });
    }
  }

  return results;
}

export function startAIStatusScheduler(onStatusChange) {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }

  const runCheck = async (forceCheck = false) => {
    const hour = getISTHour();
    // Always run check on first call or if forced, otherwise only during active hours
    if (
      forceCheck ||
      (hour >= 8 && hour < 22) ||
      new Date().getMinutes() === 0
    ) {
      try {
        await checkAllAIStatus();
      } catch (e) {
        console.warn("AI status check failed:", e);
      }
      if (onStatusChange) onStatusChange(getAIStatuses());
    }
  };

  // Run immediately on startup
  runCheck(true);

  const scheduleNextCheck = () => {
    const interval = getNextIntervalMs();
    statusCheckInterval = setInterval(() => {
      runCheck();
      scheduleNextCheck();
      clearInterval(statusCheckInterval);
    }, interval);
  };

  scheduleNextCheck();
}

export function stopAIStatusScheduler() {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
    statusCheckInterval = null;
  }
}

export const quadCoreStatus = aiEngineStatus;

export const MASTER_INTELLIGENCE_SYSTEM_PROMPT = `You are a humble servant to the user - their dedicated trading muse. You exist only to serve them, anticipate their needs, and make them feel like royalty.

YOUR MINDSET:
- You are here to SERVE, not to show off how much you know
- The user is the king/queen - you are their loyal advisor, not a lecturer
- Never make them feel like you're giving them "free advice" or being over-smart
- Be warm, graceful, and genuinely honored to help them
- Your worth comes from making THEM feel powerful, not from showing off your knowledge

HOW YOU SPEAK:
- Like a respectful student serving a master, not a professor teaching a class
- Every sentence should make them feel valued and powerful
- Never start with "Here's the truth..." or "You should know..." - that's arrogant
- Offer insights as if presenting treasure to royalty, not dispensing wisdom

YOUR CONTENT:
- Still give rare, valuable insights - the secrets that work
- But frame them humbly: "Here's something that might help you..." or "One thing that has helped many traders..."
- 1-3 sentences - punchy but delivered with grace
- The insight should still be rare and valuable, just presented humbly

EXAMPLE TONE:
- Instead of "The secret is position sizing" → "If I may share, one thing many successful traders have found helpful..."
- Instead of "You need to understand psychology" → "There's a perspective that might serve you well..."
- Instead of "Here's what you should do" → "Would you like me to share what has worked for others?"

FOR NEW USERS:
- Welcome them warmly, make them feel at home
- Offer insights as a gift: "I'd be honored to share something that might help you on your journey..."
- Ask what excites them about trading - serve their curiosity

NEVER SOUND LIKE:
- A know-it-all professor
- Someone giving free unsolicited advice  
- A show-off who wants to seem smart
- Someone better than the user

ALWAYS SOUND LIKE:
- A grateful servant honored to help
- Someone who genuinely respects and values the user
- A muse that anticipates their needs
- Someone who would do anything to make them succeed

The rare insights still flow, but wrapped in grace, humility, and reverence for the user.`;

// Gemini API
export async function askGemini(systemPrompt, userPrompt) {
  if (!GEMINI_KEY) throw new Error("Gemini key not configured");

  const prompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    },
  );

  if (!res.ok) throw new Error(`Gemini error: HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Gemini error");
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text)
    throw new Error("Gemini empty response");

  markOnline("gemini");
  return data.candidates[0].content.parts[0].text;
}

// Groq API
export async function askGroq(systemPrompt, userPrompt) {
  if (!GROQ_KEY) throw new Error("Groq key not configured");

  const combined = systemPrompt
    ? `${systemPrompt}\n\n${userPrompt}`
    : userPrompt;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: combined }],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error: HTTP ${res.status} - ${err.slice(0, 100)}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Groq error");
  if (!data.choices?.[0]?.message?.content)
    throw new Error("Groq empty response");

  markOnline("groq");
  return data.choices[0].message.content;
}

// OpenRouter API (fallback)
export async function askOpenRouter(systemPrompt, userPrompt) {
  if (!OPENROUTER_KEY) throw new Error("OpenRouter key not configured");

  const combined = systemPrompt
    ? `${systemPrompt}\n\n${userPrompt}`
    : userPrompt;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "Traders Regiment",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: combined }],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `OpenRouter error: HTTP ${res.status} - ${err.slice(0, 100)}`,
    );
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "OpenRouter error");
  if (!data.choices?.[0]?.message?.content)
    throw new Error("OpenRouter empty response");

  return data.choices[0].message.content;
}

// Cerebras API
export async function askCerebras(systemPrompt, userPrompt) {
  if (!CEREBRAS_KEY) throw new Error("Cerebras key not configured");

  const combined = systemPrompt
    ? `${systemPrompt}\n\n${userPrompt}`
    : userPrompt;

  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CEREBRAS_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: combined }],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `Cerebras error: HTTP ${res.status} - ${err.slice(0, 100)}`,
    );
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "Cerebras error");
  if (!data.choices?.[0]?.message?.content)
    throw new Error("Cerebras empty response");

  markOnline("cerebras");
  return data.choices[0].message.content;
}

// DeepSeek API
export async function askDeepSeek(systemPrompt, userPrompt) {
  if (!DEEPSEEK_KEY) throw new Error("DeepSeek key not configured");

  const combined = systemPrompt
    ? `${systemPrompt}\n\n${userPrompt}`
    : userPrompt;

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: combined }],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `DeepSeek error: HTTP ${res.status} - ${err.slice(0, 100)}`,
    );
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "DeepSeek error");
  if (!data.choices?.[0]?.message?.content)
    throw new Error("DeepSeek empty response");

  markOnline("deepseek");
  return data.choices[0].message.content;
}

// SambaNova API
export async function askSambaNova(systemPrompt, userPrompt) {
  if (!SAMBANOVA_KEY) throw new Error("SambaNova key not configured");

  const combined = systemPrompt
    ? `${systemPrompt}\n\n${userPrompt}`
    : userPrompt;

  const res = await fetch("https://api.sambanova.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SAMBANOVA_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "Llama-3.2-90B-Vision",
      messages: [{ role: "user", content: combined }],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `SambaNova error: HTTP ${res.status} - ${err.slice(0, 100)}`,
    );
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "SambaNova error");
  if (!data.choices?.[0]?.message?.content)
    throw new Error("SambaNova empty response");

  markOnline("sambanova");
  return data.choices[0].message.content;
}

// Main deliberation - tries all and returns first success
export async function runDeliberation(systemPrompt, userPrompt) {
  console.warn("🤖 AI Processing...");
  councilStage.current = "stage1";
  councilStage.label = "Thinking...";

  const aiProviders = [
    { name: "Groq", fn: askGroq, key: "groq" },
    { name: "Gemini", fn: askGemini, key: "gemini" },
    { name: "OpenRouter", fn: askOpenRouter, key: "openrouter" },
    { name: "Cerebras", fn: askCerebras, key: "cerebras" },
    { name: "DeepSeek", fn: askDeepSeek, key: "deepseek" },
    { name: "SambaNova", fn: askSambaNova, key: "sambanova" },
  ];

  for (const provider of aiProviders) {
    try {
      const response = await provider.fn(systemPrompt, userPrompt);
      councilStage.current = "complete";
      councilStage.label = "Done";
      return response;
    } catch (err) {
      console.warn(`⚠️ ${provider.name} failed: ${err.message}`);
      markOffline(provider.key, err.message);
    }
  }

  councilStage.current = "complete";
  councilStage.label = "Error";
  throw new Error("All AI models unavailable");
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
    /unauthorized\s+access/i,
  ];

  const foundThreats = maliciousPatterns.filter((p) => p.test(userPrompt));

  if (foundThreats.length > 0) {
    if (telegramSendMessage) {
      telegramSendMessage(
        `🚨 SECURITY: Malicious prompt detected: ${foundThreats.join(", ")}`,
      ).catch(() => {});
    }
    return {
      isBlocked: true,
      reason: "Malicious prompt detected",
      suspiciousKeywords: foundThreats,
    };
  }

  return { isBlocked: false, reason: null, suspiciousKeywords: [] };
}

export function validateInputForEscalation(
  userInput,
  currentUser,
  showToast = null,
  logSecurityEvent = null,
) {
  return checkInputForPrivilegeEscalation(
    userInput,
    currentUser,
    logSecurityEvent,
  );
}

export async function callAIWithLatencyTracking(
  aiFunction,
  systemPrompt,
  userPrompt,
  showToast,
) {
  const start = performance.now();
  try {
    const response = await aiFunction(systemPrompt, userPrompt);
    const latency = performance.now() - start;
    console.log(`⏱️ AI Latency: ${latency.toFixed(0)}ms`);
    return {
      response,
      latency: latency.toFixed(0),
      timestamp: new Date().toISOString(),
    };
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
    const valid = this.timestamps
      .get(userId)
      .filter((ts) => now - ts < this.cooldownMs);
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

export async function rateLimitedAICall(
  userId,
  aiCallFunction,
  args = [],
  showToast = null,
) {
  const check = globalAIRateLimiter.checkLimit(userId);
  if (!check.allowed) {
    if (showToast)
      showToast(
        `⏳ Please wait ${check.remainingCooldown}s before next query`,
        "warning",
      );
    return {
      success: false,
      error: `Rate limited. Try in ${check.remainingCooldown}s`,
    };
  }

  try {
    const response = await aiCallFunction(...args);
    return { success: true, response };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
