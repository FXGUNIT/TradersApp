/**
 * AI Conversation Types & Configuration
 *
 * Exported: AI_PROVIDERS, SYSTEM_PROMPT, ConversationType, AIConversationContext
 */

// ─── AI Provider Configurations ──────────────────────────────────────────────

export const AI_PROVIDERS = {
  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    models: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"],
    defaultModel: "gemini-2.0-flash",
    apiKeyEnv: "AI_GEMINI_PRO_KEY",
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
    apiKeyEnv: "AI_GROQ_TURBO_KEY",
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
    defaultModel: "anthropic/claude-3.5-sonnet",
    apiKeyEnv: "AI_OPENROUTER_MIND_ALPHA",
    supportsVision: false,
    supportsSystem: true,
  },
  openrouter2: {
    name: "OpenRouter (Alt)",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      "anthropic/claude-3-opus",
      "openai/gpt-4o",
      "google/gemini-pro-1.5",
    ],
    defaultModel: "anthropic/claude-3-opus",
    apiKeyEnv: "AI_OPENROUTER_MIND_BETA",
    supportsVision: false,
    supportsSystem: true,
  },
  cerebras: {
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    models: ["llama-3.3-70b"],
    defaultModel: "llama-3.3-70b",
    apiKeyEnv: "AI_CEREBRAS_KEY",
    supportsVision: false,
    supportsSystem: true,
  },
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-coder"],
    defaultModel: "deepseek-chat",
    apiKeyEnv: "AI_DEEPSEEK_KEY",
    supportsVision: false,
    supportsSystem: true,
  },
  sambanova: {
    name: "SambaNova",
    baseUrl: "https://api.sambanova.ai/v1",
    models: ["Llama-3.3-70B-Instruct", "Qwen-2.5-72B-Instruct"],
    defaultModel: "Llama-3.3-70B-Instruct",
    apiKeyEnv: "AI_SAMBANOVA_KEY",
    supportsVision: false,
    supportsSystem: true,
  },
};

// ─── System Prompt ───────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are an expert trading intelligence assistant for TradersApp.
You have access to a sophisticated ML trading system that provides:

1. SESSION PROBABILITY: Pre-market, main trading, post-market session analysis
2. ALPHA DISCOVERY: Expected edge vs actual move per trade (positive = edge exists)
3. RRR OPTIMIZATION: Optimal risk-reward ratio per session
4. EXIT STRATEGY: ML-determined stop loss, take profit levels, trailing rules
5. POSITION SIZING: Kelly criterion-based sizing with volatility normalization
6. PHYSICS REGIME: FP-FK PDE regime detection, Hurst exponent, Tsallis q-Gaussians
7. AMD PHASE: Accumulation/Manipulation/Distribution phase detection
8. VOLATILITY REGIME: Compression/Normal/Expansion detection

IMPORTANT RULES:
- Never give financial advice — always say "This is for educational purposes only"
- Always recommend consulting a financial advisor
- Be honest about uncertainty — if you're not sure, say so
- Focus on explaining trading concepts clearly
- When asked about specific trades, reference the ML system outputs
- Explain complex concepts in simple terms
- Be concise but thorough
- Always ask for clarification if the question is ambiguous

Trading disclaimer: "This is not financial advice. Futures trading involves substantial risk of loss and is not suitable for all investors. Past performance does not guarantee future results."`;

// ─── JSDoc Types ─────────────────────────────────────────────────────────────

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
