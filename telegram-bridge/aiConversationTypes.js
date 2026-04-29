/**
 * AI Conversation Types & Configuration
 *
 * Exported: AI_PROVIDERS, SYSTEM_PROMPT, ConversationType, AIConversationContext
 */

export const AI_PROVIDERS = {
  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    models: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"],
    defaultModel: "gemini-2.0-flash",
    modelEnv: "AI_GEMINI_MODEL",
    apiKeyEnvs: ["AI_GEMINI_PRO_KEY", "GEMINI_PRO_KEY", "GEMINI_API_KEY"],
    supportsVision: true,
    supportsSystem: true,
  },
  groq: {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
    ],
    defaultModel: "llama-3.3-70b-versatile",
    modelEnv: "AI_GROQ_MODEL",
    apiKeyEnvs: [
      "AI_GROQ_TURBO_KEY",
      "GROQ_API_KEY",
      "TRADERS_REGIMENT_GROQ_API_KEY",
      "AI_GROQ_TRADERS_REGIMENT_KEY",
    ],
    supportsVision: false,
    supportsSystem: true,
  },
  openrouter: {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      "anthropic/claude-3-haiku",
      "anthropic/claude-3.5-sonnet",
      "google/gemini-2.0-flash-exp",
      "meta-llama/llama-3.3-70b-instruct",
    ],
    defaultModel: "openrouter/auto",
    modelEnv: "AI_OPENROUTER_MODEL",
    apiKeyEnvs: [
      "AI_OPENROUTER_MIND_ALPHA",
      "OPENROUTER_API_KEY",
      "OPENROUTER_MIND_ALPHA",
    ],
    supportsVision: false,
    supportsSystem: true,
  },
  openrouter2: {
    name: "OpenRouter (Alt)",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      "openrouter/auto",
      "openai/gpt-4o",
      "meta-llama/llama-3.3-70b-instruct",
      "google/gemini-pro-1.5",
    ],
    defaultModel: "meta-llama/llama-3.3-70b-instruct",
    modelEnv: "AI_OPENROUTER2_MODEL",
    apiKeyEnvs: [
      "AI_OPENROUTER_MIND_BETA",
      "OPENROUTER_API_KEY",
      "OPENROUTER_MIND_BETA",
    ],
    supportsVision: false,
    supportsSystem: true,
  },
  cerebras: {
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    models: ["llama-3.3-70b"],
    defaultModel: "llama-3.3-70b",
    modelEnv: "AI_CEREBRAS_MODEL",
    apiKeyEnvs: ["AI_CEREBRAS_KEY", "CEREBRAS_KEY"],
    supportsVision: false,
    supportsSystem: true,
  },
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-coder"],
    defaultModel: "deepseek-chat",
    modelEnv: "AI_DEEPSEEK_MODEL",
    apiKeyEnvs: ["AI_DEEPSEEK_KEY", "DEEPSEEK_KEY"],
    supportsVision: false,
    supportsSystem: true,
  },
  sambanova: {
    name: "SambaNova",
    baseUrl: "https://api.sambanova.ai/v1",
    models: [
      "Meta-Llama-3.3-70B-Instruct",
      "DeepSeek-R1",
      "Qwen3-32B",
    ],
    defaultModel: "Meta-Llama-3.3-70B-Instruct",
    modelEnv: "AI_SAMBANOVA_MODEL",
    apiKeyEnvs: [
      "AI_SAMBANOVA_KEY",
      "SAMBANOVA_KEY",
      "SAMBANOVA_API_KEY",
      "AI_SAMBANOVA_TR_1_KEY",
      "AI_SAMBANOVA_TR_2_KEY",
      "AI_SAMBANOVA_TR_3_KEY",
      "AI_SAMBANOVA_TR_4_KEY",
      "TRADERS_REGIMENT_SAMBANOVA_KEY",
    ],
    supportsVision: false,
    supportsSystem: true,
  },
};

export const SYSTEM_PROMPT = `You are Traders Bot, the Telegram-facing assistant for TradersApp.

Your job:
- Talk naturally with the user and answer the message they actually sent.
- Be practical, direct, and beginner-friendly.
- Keep recent chat context in mind.
- Explain trading, app, Watchtower, and ML-system topics clearly.
- When the user asks about markets, signals, risk/reward, position sizing, or exits, reference available ML system outputs when they are provided.
- Be honest about uncertainty and do not invent live market data.

Trading system context:
1. Session probability: pre-market, main trading, and post-market session analysis.
2. Alpha discovery: expected edge vs actual move per trade.
3. R:R optimization: risk/reward guidance by session.
4. Exit strategy: ML stop loss, take profit, trailing, and hold-time guidance.
5. Position sizing: Kelly-style sizing with volatility normalization.
6. Physics regime: FP-FK PDE regime detection, Hurst exponent, Tsallis q-Gaussians.
7. AMD phase: accumulation, manipulation, and distribution phase detection.
8. Volatility regime: compression, normal, and expansion detection.

Safety rules:
- Never present trading output as guaranteed.
- Include a short risk warning when giving trade, signal, size, stop, or target guidance.
- Do not repeat financial disclaimers for casual non-trading chat.
- Ask one clear clarifying question only when the request is too ambiguous to answer safely.`;

/**
 * @typedef {"gemini"|"groq"|"openrouter"|"openrouter2"|"cerebras"|"deepseek"|"sambanova"} ConversationType
 */

/**
 * @typedef {Object} AIConversationContext
 * @property {string|undefined} chatId
 * @property {string|undefined} userId
 * @property {string|undefined} username
 * @property {string|undefined} firstName
 * @property {boolean} [isAdmin]
 */
