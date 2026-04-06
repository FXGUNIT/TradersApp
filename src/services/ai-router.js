import { checkInputForPrivilegeEscalation } from "./leakagePreventionModule.js";
import { hasBff } from "./gateways/base.js";

const AI_ENGINE_DEFINITIONS = [
  { key: "gemini", name: "Gemini" },
  { key: "groq", name: "Groq" },
  { key: "openrouter", name: "OpenRouter" },
  { key: "cerebras", name: "Cerebras" },
  { key: "deepseek", name: "DeepSeek" },
  { key: "sambanova", name: "SambaNova" },
];

const apiBase = () => {
  const configured = String(import.meta.env.VITE_BFF_URL || "").trim();
  return configured || "/api";
};

const apiUrl = (path) => `${apiBase()}${path}`;

const buildEngineStatus = (definition) => ({
  name: definition.name,
  configured: false,
  online: false,
  status: "unconfigured",
  reason: "Fresh provider key required.",
  lastPing: null,
  errors: 0,
});

export const aiEngineStatus = Object.fromEntries(
  AI_ENGINE_DEFINITIONS.map((definition) => [
    definition.key,
    buildEngineStatus(definition),
  ]),
);

export const AI_ENGINES = AI_ENGINE_DEFINITIONS.map(
  (definition) => definition.key,
);

export const councilStage = { current: "idle", label: "" };

function applyStatusSnapshot(statuses = []) {
  const normalized = Array.isArray(statuses) ? statuses : [];

  AI_ENGINE_DEFINITIONS.forEach((definition) => {
    const match = normalized.find((entry) => {
      const name = String(entry?.name || "").toLowerCase();
      return entry?.key === definition.key || name === definition.name.toLowerCase();
    });

    const current = aiEngineStatus[definition.key];
    if (!match) {
      aiEngineStatus[definition.key] = {
        ...current,
        name: definition.name,
        configured: false,
        online: false,
        status: "unconfigured",
        reason: "Fresh provider key required.",
        lastPing: Date.now(),
      };
      return;
    }

    aiEngineStatus[definition.key] = {
      ...current,
      name: match.name || definition.name,
      configured: Boolean(match.configured),
      online: Boolean(match.online),
      status: match.status || (match.online ? "online" : "offline"),
      reason: match.reason || "",
      lastPing: match.lastPing || Date.now(),
      errors: Number(match.errors || 0),
    };
  });
}

function markOnline(engine, reason = "Provider key loaded and ready.") {
  if (!aiEngineStatus[engine]) {
    return;
  }

  aiEngineStatus[engine] = {
    ...aiEngineStatus[engine],
    configured: true,
    online: true,
    status: "online",
    reason,
    lastPing: Date.now(),
    errors: 0,
  };
}

function markUnconfigured(engine, reason = "Fresh provider key required.") {
  if (!aiEngineStatus[engine]) {
    return;
  }

  aiEngineStatus[engine] = {
    ...aiEngineStatus[engine],
    configured: false,
    online: false,
    status: "unconfigured",
    reason,
    lastPing: Date.now(),
  };
}

function markOffline(engine, reason = "Provider unavailable.") {
  if (!aiEngineStatus[engine]) {
    return;
  }

  aiEngineStatus[engine] = {
    ...aiEngineStatus[engine],
    configured: true,
    online: false,
    status: "offline",
    reason,
    lastPing: Date.now(),
    errors: Number(aiEngineStatus[engine].errors || 0) + 1,
  };
}

function syncFailureState(engine, err) {
  const message = String(err || "");
  if (message.toLowerCase().includes("not configured")) {
    markUnconfigured(engine, message);
    return;
  }
  markOffline(engine, message || "Provider unavailable.");
}

async function callBffJson(path, payload) {
  if (!hasBff()) {
    throw new Error("BFF unavailable.");
  }

  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.error || data?.message || `BFF request failed (${response.status})`,
    );
  }

  return data;
}

async function callProvider(provider, systemPrompt, userPrompt) {
  const data = await callBffJson("/ai/provider-chat", {
    provider,
    systemPrompt,
    userPrompt,
  });

  if (Array.isArray(data?.statuses)) {
    applyStatusSnapshot(data.statuses);
  }

  if (data?.provider) {
    markOnline(data.provider);
  }

  return data?.response || "";
}

export function getAIStatuses() {
  return AI_ENGINES.map((engine) => aiEngineStatus[engine].online);
}

export function getAIStatusesDetailed() {
  return AI_ENGINES.map((engine) => ({
    name: aiEngineStatus[engine].name,
    online: aiEngineStatus[engine].online,
    configured: aiEngineStatus[engine].configured,
    status: aiEngineStatus[engine].status,
    reason: aiEngineStatus[engine].reason,
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

function getNextIntervalMs() {
  const hour = getISTHour();
  if (hour >= 8 && hour < 22) {
    return 15 * 60 * 1000;
  }
  return 60 * 60 * 1000;
}

let statusCheckInterval = null;

export async function checkAllAIStatus() {
  if (!hasBff()) {
    AI_ENGINES.forEach((engine) =>
      syncFailureState(engine, "BFF unavailable."),
    );
    return getAIStatusesDetailed();
  }

  const response = await fetch(apiUrl("/ai/status"), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.error || data?.message || `AI status failed (${response.status})`,
    );
  }

  applyStatusSnapshot(data?.engines || []);
  return getAIStatusesDetailed();
}

export function startAIStatusScheduler(onStatusChange) {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }

  const runCheck = async (forceCheck = false) => {
    const hour = getISTHour();
    if (
      forceCheck ||
      (hour >= 8 && hour < 22) ||
      new Date().getMinutes() === 0
    ) {
      try {
        await checkAllAIStatus();
      } catch (error) {
        AI_ENGINES.forEach((engine) =>
          syncFailureState(engine, error?.message || "BFF unavailable."),
        );
      }
      if (onStatusChange) {
        onStatusChange(getAIStatusesDetailed());
      }
    }
  };

  void runCheck(true);

  const scheduleNextCheck = () => {
    const interval = getNextIntervalMs();
    statusCheckInterval = setInterval(() => {
      void runCheck();
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
- Instead of "The secret is position sizing" -> "If I may share, one thing many successful traders have found helpful..."
- Instead of "You need to understand psychology" -> "There's a perspective that might serve you well..."
- Instead of "Here's what you should do" -> "Would you like me to share what has worked for others?"

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

export async function askGemini(systemPrompt, userPrompt) {
  return callProvider("gemini", systemPrompt, userPrompt);
}

export async function askGroq(systemPrompt, userPrompt) {
  return callProvider("groq", systemPrompt, userPrompt);
}

export async function askOpenRouter(systemPrompt, userPrompt) {
  return callProvider("openrouter", systemPrompt, userPrompt);
}

export async function askCerebras(systemPrompt, userPrompt) {
  return callProvider("cerebras", systemPrompt, userPrompt);
}

export async function askDeepSeek(systemPrompt, userPrompt) {
  return callProvider("deepseek", systemPrompt, userPrompt);
}

export async function askSambaNova(systemPrompt, userPrompt) {
  return callProvider("sambanova", systemPrompt, userPrompt);
}

export async function runDeliberation(systemPrompt, userPrompt) {
  councilStage.current = "stage1";
  councilStage.label = "Thinking...";

  try {
    const data = await callBffJson("/ai/deliberate", {
      systemPrompt,
      userPrompt,
    });

    if (Array.isArray(data?.statuses)) {
      applyStatusSnapshot(data.statuses);
    }

    if (data?.provider) {
      markOnline(data.provider);
    }

    councilStage.current = "complete";
    councilStage.label = "Done";
    return data?.response || "";
  } catch (error) {
    councilStage.current = "complete";
    councilStage.label = "Error";
    throw error;
  }
}

export async function askGeminiWithFallback(systemPrompt, userPrompt) {
  return runDeliberation(systemPrompt, userPrompt);
}

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

  const foundThreats = maliciousPatterns.filter((pattern) =>
    pattern.test(userPrompt),
  );

  if (foundThreats.length > 0) {
    if (telegramSendMessage) {
      telegramSendMessage(
        `SECURITY: Malicious prompt detected: ${foundThreats.join(", ")}`,
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
  const response = await aiFunction(systemPrompt, userPrompt);
  const latency = performance.now() - start;
  return {
    response,
    latency: latency.toFixed(0),
    timestamp: new Date().toISOString(),
  };
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
    if (showToast) {
      showToast(
        `Please wait ${check.remainingCooldown}s before next query`,
        "warning",
      );
    }
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
