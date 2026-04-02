/**
 * AI Conversation Service for Telegram Bridge
 * Handles AI-powered trading conversation via multiple providers.
 * Integrates with ML Engine for technical analysis.
 *
 * Architecture:
 *   Telegram User → Bot Webhook → index.js → aiConversation.js
 *   aiConversation.js → [Gemini|Groq|OpenRouter|Cerebras|DeepSeek|SambaNova]
 *   aiConversation.js → ML Engine (for technical questions)
 *   Response → Telegram User
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');

// ─── AI Provider Configurations ──────────────────────────────────────────────

const AI_PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro'],
    defaultModel: 'gemini-2.0-flash',
    apiKeyEnv: 'AI_GEMINI_PRO_KEY',
    supportsVision: true,
    supportsSystem: true,
  },
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    defaultModel: 'llama-3.3-70b-versatile',
    apiKeyEnv: 'AI_GROQ_TURBO_KEY',
    supportsVision: false,
    supportsSystem: true,
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['anthropic/claude-3-haiku', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash-exp', 'meta-llama/llama-3.3-70b-instruct'],
    defaultModel: 'anthropic/claude-3.5-sonnet',
    apiKeyEnv: 'AI_OPENROUTER_MIND_ALPHA',
    supportsVision: false,
    supportsSystem: true,
  },
  openrouter2: {
    name: 'OpenRouter (Alt)',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['anthropic/claude-3-opus', 'openai/gpt-4o', 'google/gemini-pro-1.5'],
    defaultModel: 'anthropic/claude-3-opus',
    apiKeyEnv: 'AI_OPENROUTER_MIND_BETA',
    supportsVision: false,
    supportsSystem: true,
  },
  cerebras: {
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    models: ['llama-3.3-70b'],
    defaultModel: 'llama-3.3-70b',
    apiKeyEnv: 'AI_CEREBRAS_KEY',
    supportsVision: false,
    supportsSystem: true,
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder'],
    defaultModel: 'deepseek-chat',
    apiKeyEnv: 'AI_DEEPSEEK_KEY',
    supportsVision: false,
    supportsSystem: true,
  },
  sambanova: {
    name: 'SambaNova',
    baseUrl: 'https://api.sambanova.ai/v1',
    models: ['Llama-3.3-70B-Instruct', 'Qwen-2.5-72B-Instruct'],
    defaultModel: 'Llama-3.3-70B-Instruct',
    apiKeyEnv: 'AI_SAMBANOVA_KEY',
    supportsVision: false,
    supportsSystem: true,
  },
};

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert trading intelligence assistant for TradersApp.
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

// ─── Conversation Memory ──────────────────────────────────────────────────────

/**
 * In-memory session store: chatId → [{role, content, timestamp}]
 * Max 20 messages per session to limit memory.
 */
const sessionStore = new Map();

const MAX_SESSION_MESSAGES = 20;

function addToSession(chatId, role, content) {
  if (!sessionStore.has(chatId)) {
    sessionStore.set(chatId, []);
  }
  const session = sessionStore.get(chatId);
  session.push({ role, content, timestamp: Date.now() });
  // Keep only last MAX_SESSION_MESSAGES
  while (session.length > MAX_SESSION_MESSAGES) {
    session.shift();
  }
}

function getSessionMessages(chatId) {
  return sessionStore.get(chatId) || [];
}

function clearSession(chatId) {
  sessionStore.delete(chatId);
}

// ─── Intent Detection ─────────────────────────────────────────────────────────

/**
 * Detect what type of request the user is making.
 * Returns: { intent, params }
 */
function detectIntent(text) {
  const lower = text.toLowerCase();

  if (lower.includes('/reset') || lower.includes('/clear')) {
    return { intent: 'reset', params: {} };
  }
  if (lower.includes('/help') || lower.includes('/start')) {
    return { intent: 'help', params: {} };
  }
  if (lower.includes('/signal') || lower.includes('/predict') || lower.includes('/analysis')) {
    return { intent: 'ml_analysis', params: {} };
  }
  if (lower.includes('/alpha') || lower.includes('/edge')) {
    return { intent: 'alpha', params: {} };
  }
  if (lower.includes('/regime') || lower.includes('/market regime') || lower.includes('/regime detection')) {
    return { intent: 'regime', params: {} };
  }
  if (lower.includes('/rrr') || lower.includes('/risk reward') || lower.includes('optimal r:r')) {
    return { intent: 'rrr', params: {} };
  }
  if (lower.includes('/session') || lower.includes('pre-market') || lower.includes('main trading')) {
    return { intent: 'session', params: {} };
  }
  if (lower.includes('/exit') || lower.includes('stop loss') || lower.includes('take profit')) {
    return { intent: 'exit_strategy', params: {} };
  }
  if (lower.includes('/position') || lower.includes('position size') || lower.includes('kelly')) {
    return { intent: 'position_sizing', params: {} };
  }
  if (lower.includes('/pbo') || lower.includes('backtest') || lower.includes('backtesting')) {
    return { intent: 'pbo', params: {} };
  }
  if (lower.match(/^(what|how|why|when|should i|is it|can i|tell me|explain|define|describe)/i)) {
    return { intent: 'education', params: {} };
  }

  return { intent: 'general', params: {} };
}

// ─── ML Engine Integration ───────────────────────────────────────────────────

/**
 * Call the ML Engine for technical analysis.
 * Falls back gracefully if ML Engine is unavailable.
 */
async function callMLEngine(endpoint, body) {
  const mlEngineUrl = process.env.ML_ENGINE_URL || 'http://localhost:8001';
  const apiKey = process.env.ML_ENGINE_API_KEY || 'dev-key';

  return new Promise((resolve) => {
    const url = new URL(`${mlEngineUrl}${endpoint}`);
    const data = JSON.stringify(body);

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 15000,
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode === 200, data: JSON.parse(body), status: res.statusCode });
        } catch {
          resolve({ ok: false, data: null, status: res.statusCode, error: 'Parse error' });
        }
      });
    });

    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
    req.write(data);
    req.end();
  });
}

/**
 * Call the BFF for ML consensus — the full aggregated signal.
 * This is the primary signal source for the /signal command.
 */
async function callBFFConsensus() {
  const bffUrl = process.env.BFF_URL || process.env.VITE_BFF_URL || 'http://127.0.0.1:8788';
  const serviceKey = process.env.SUPPORT_SERVICE_KEY || process.env.TELEGRAM_ADMIN_API_KEY || '';

  return new Promise((resolve) => {
    const url = new URL(`${bffUrl}/ml/consensus`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(serviceKey ? { 'X-Support-Key': serviceKey } : {}),
      },
      timeout: 20000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode === 200, data: JSON.parse(data), status: res.statusCode });
        } catch {
          resolve({ ok: false, data: null, status: res.statusCode, error: 'Parse error' });
        }
      });
    });

    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
    req.end();
  });
}

// ─── AI Provider Calls ───────────────────────────────────────────────────────

/**
 * Make an HTTP POST request (works for both http and https).
 */
function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode < 400, status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ ok: false, status: res.statusCode, data: null, error: 'Parse error', raw: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

/**
 * Call Gemini API (Google AI Studio).
 */
async function callGemini(model, messages, apiKey) {
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const systemInstruction = messages.find(m => m.role === 'system');
  const body = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
      topP: 0.9,
    },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
  }

  const url = `${AI_PROVIDERS.gemini.baseUrl}/${model}:generateContent?key=${apiKey}`;
  const result = await httpRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, body);

  if (!result.ok) {
    throw new Error(`Gemini API error ${result.status}: ${JSON.stringify(result.data)}`);
  }

  const text = result.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return text;
}

/**
 * Call OpenAI-compatible API (Groq, OpenRouter, Cerebras, DeepSeek, SambaNova).
 */
async function callOpenAICompatible(provider, model, messages, apiKey) {
  const config = AI_PROVIDERS[provider];

  const body = {
    model: model || config.defaultModel,
    messages: messages.filter(m => m.role !== 'system'),
    temperature: 0.7,
    max_tokens: 2048,
  };

  const systemMsg = messages.find(m => m.role === 'system');
  if (systemMsg) {
    body.messages.unshift({ role: 'system', content: systemMsg.content });
  }

  const result = await httpRequest(
    `${config.baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(provider === 'openrouter' || provider === 'openrouter2'
          ? { 'HTTP-Referer': 'https://traders.app', 'X-Title': 'TradersApp' }
          : {}),
      },
    },
    body,
  );

  if (!result.ok) {
    throw new Error(`${config.name} API error ${result.status}: ${JSON.stringify(result.data)}`);
  }

  return result.data?.choices?.[0]?.message?.content;
}

// ─── Provider Selection ───────────────────────────────────────────────────────

/**
 * Try providers in order of preference until one succeeds.
 * Returns { text, provider, model }
 */
async function callBestAvailableAI(messages, preferredOrder = ['gemini', 'groq', 'deepseek', 'sambanova']) {
  const errors = [];

  for (const provider of preferredOrder) {
    const config = AI_PROVIDERS[provider];
    if (!config) continue;

    const apiKey = process.env[config.apiKeyEnv];
    if (!apiKey) {
      errors.push(`${config.name}: no API key (${config.apiKeyEnv})`);
      continue;
    }

    try {
      let text;
      if (provider === 'gemini') {
        text = await callGemini(config.defaultModel, messages, apiKey);
      } else {
        text = await callOpenAICompatible(provider, null, messages, apiKey);
      }
      return { text, provider: config.name, model: config.defaultModel };
    } catch (e) {
      errors.push(`${config.name}: ${e.message}`);
      console.error(`AI provider ${provider} failed:`, e.message);
    }
  }

  throw new Error(`All AI providers failed:\n${errors.join('\n')}`);
}

// ─── Response Formatting ─────────────────────────────────────────────────────

function formatConsensusForTelegram(data) {
  // Format the full BFF consensus response as a compact Telegram message
  const signal = data.consensus?.signal || data.signal || 'N/A';
  const confidence = data.consensus?.confidence || data.confidence || 0;
  const alpha = data.consensus?.alpha?.score || data.alpha?.score || 0;
  const regime = data.consensus?.physics_regime?.regime || data.regime || data.physics_regime?.regime || 'N/A';
  const exitPlan = data.consensus?.exit_plan || data.exit_plan || {};
  const rrr = data.consensus?.rrr?.recommended || data.rrr?.recommended || 0;
  const session = data.consensus?.session_probability?.main || data.session_probability?.main || {};

  const signalIcon = signal === 'LONG' ? '🟢' : signal === 'SHORT' ? '🔴' : '⚪';
  const confidenceBar = '▓'.repeat(Math.round(confidence * 10)) + '░'.repeat(10 - Math.round(confidence * 10));

  const lines = [
    `${signalIcon} *${signal}* | ${confidenceBar} ${(confidence * 100).toFixed(0)}%`,
    '',
    `📊 Alpha: *${typeof alpha === 'number' ? alpha.toFixed(1) : alpha}* ticks`,
    `🔬 Regime: *${regime}*`,
    `⚡ R:R: *1:${rrr}*`,
    `📈 Session: P(up)=${session.P_up ? (session.P_up * 100).toFixed(0) + '%' : 'N/A'} | Best: ${session.best_entry || 'N/A'}`,
    '',
    `🎯 SL: *${exitPlan.stop_loss_ticks || '?'}* ticks`,
    `📌 TP1: *${exitPlan.tp1_ticks || '?'}* ticks (close ${exitPlan.tp1_pct ? (exitPlan.tp1_pct * 100).toFixed(0) + '%' : '?'})`,
    `📌 TP2: *${exitPlan.tp2_ticks || '?'}* ticks (close ${exitPlan.tp2_pct ? (exitPlan.tp2_pct * 100).toFixed(0) + '%' : '?'})`,
  ];

  // Add news alert if present
  if (data.breaking_news?.length > 0) {
    const highImpact = data.breaking_news.filter(n => n.impact === 'HIGH');
    if (highImpact.length > 0) {
      lines.push('');
      lines.push(`🚨 *${highImpact.length} HIGH IMPACT* news item(s)`);
      for (const news of highImpact.slice(0, 2)) {
        lines.push(`  • ${news.title?.slice(0, 60)}${news.title?.length > 60 ? '...' : ''}`);
      }
    }
  }

  // Add timing recommendation
  if (data.consensus?.timing) {
    const timing = data.consensus.timing;
    lines.push('');
    if (timing.enter_now) {
      lines.push('✅ *Enter NOW* — candle close entry recommended');
    } else {
      lines.push(`⏳ *Wait* — best window: ${timing.best_entry_window || 'N/A'} (${timing.minutes_to_best_window || '?'} min)`);
    }
    if (timing.news?.trade_allowed === false) {
      lines.push(`⚠️ High-impact event in ${timing.news.timeUntil_min || '?'} min — reduce size`);
    }
  }

  // Add model votes summary
  if (data.consensus?.votes) {
    const votes = data.consensus.votes;
    const longVotes = Object.values(votes).filter(v => v.signal === 'LONG').length;
    const shortVotes = Object.values(votes).filter(v => v.signal === 'SHORT').length;
    const neutralVotes = Object.values(votes).filter(v => v.signal === 'NEUTRAL').length;
    lines.push('');
    lines.push(`🗳️ Votes: ${longVotes} LONG | ${shortVotes} SHORT | ${neutralVotes} NEUTRAL`);
  }

  lines.push('');
  lines.push('_This is not financial advice. Futures trading involves substantial risk of loss._');

  return lines.join('\n');
}

function formatMLResponse(result, intent) {
  const { data } = result;
  if (!data) return 'ML Engine returned an empty response.';

  switch (intent) {
    case 'regime':
      return `📊 *Physics Regime Analysis*

*Regime:* ${data.regime || 'N/A'}
*Confidence:* ${data.confidence ? (data.confidence * 100).toFixed(1) + '%' : 'N/A'}

*Tsallis q:* ${data.fp_fk?.q_parameter?.toFixed(4) || 'N/A'} ${data.fp_fk?.q_parameter > 1 ? '(fat tails)' : '(thin tails)'}
*FK Wave Speed:* ${data.fp_fk?.fk_wave_speed?.toFixed(4) || 'N/A'}
*Criticality κ:* ${data.fp_fk?.criticality_index?.toFixed(4) || 'N/A'}

*Hurst H:* ${data.anomalous_diffusion?.hurst_H?.toFixed(4) || 'N/A'} ${data.anomalous_diffusion?.diffusion_type || ''}
*Multifractality:* ${data.anomalous_diffusion?.multifractality?.toFixed(4) || 'N/A'}

*Deleverage:* ${data.deleverage_signal ? '⚠️ YES - reduce risk' : '✅ Normal'}
*Position Adj:* ${data.position_adjustment ? data.position_adjustment.toFixed(2) + 'x' : 'N/A'}
*Stop Multiplier:* ${data.stop_multiplier?.toFixed(2) || 'N/A'}x

${data.physics_explanation || ''}`;

    case 'alpha':
      return `📈 *Alpha Analysis*

*Alpha Score:* ${data.alpha?.score || data.alpha_score || 'N/A'}
*Confidence:* ${data.alpha?.confidence ? (data.alpha.confidence * 100).toFixed(1) + '%' : 'N/A'}

${data.alpha?.alpha_by_session ? Object.entries(data.alpha.alpha_by_session)
  .map(([session, info]) => `*${session}:* ${info.alpha?.toFixed(2) || 'N/A'} ticks (${info.confidence ? (info.confidence*100).toFixed(0)+'%' : 'N/A'} confidence)`)
  .join('\n') : ''}

*Current Time Alpha:* ${data.alpha?.current_time_alpha || 'N/A'}
*Stability:* ${data.alpha?.stability ? (data.alpha.stability * 100).toFixed(1) + '%' : 'N/A'}
*Best Window:* ${data.alpha?.best_alpha_window || 'N/A'}`;

    case 'session':
      return `📊 *Session Probability*

${data.session_probability ? Object.entries(data.session_probability)
  .map(([session, info]) => `*${session}:* P(up) = ${(info.P_up * 100).toFixed(0)}% | Alpha: ${info.alpha?.toFixed(1) || 'N/A'} ticks | Best: ${info.best_entry || 'N/A'}`)
  .join('\n') : 'Session data unavailable.'}`;

    case 'exit_strategy':
      return `🎯 *Exit Strategy (ML-Determined)*

*Strategy:* ${data.exit_plan?.strategy || data.exitPlan?.strategy || 'ML-DETERMINED'}
*Stop Loss:* ${data.exit_plan?.stop_loss_ticks || data.exitPlan?.stopLossTicks || 'N/A'} ticks

*TP1:* ${((data.exit_plan?.tp1_pct || data.exitPlan?.tp1Pct || 0) * 100).toFixed(0)}% @ ${data.exit_plan?.tp1_ticks || data.exitPlan?.tp1Ticks || 'N/A'}t
*TP2:* ${((data.exit_plan?.tp2_pct || data.exitPlan?.tp2Pct || 0) * 100).toFixed(0)}% @ ${data.exit_plan?.tp2_ticks || data.exitPlan?.tp2Ticks || 'N/A'}t
*Keep open:* ${((data.exit_plan?.tp3_pct || data.exitPlan?.tp3Pct || 0) * 100).toFixed(0)}%

*Trail:* ${data.exit_plan?.trailing_distance_ticks || data.exitPlan?.trailingDistanceTicks || 'N/A'}t (activate @ ${data.exit_plan?.trail_activate_at_ticks || data.exitPlan?.trailActivateAtTicks || 'N/A'}t profit)
*Max Hold:* ${data.exit_plan?.max_hold_minutes || data.exitPlan?.maxHoldMinutes || 'N/A'} min
*Move SL to BE:* ${data.exit_plan?.move_sl_to_be_at || data.exitPlan?.moveSlToBeAt || 'N/A'}t profit

${data.exit_plan?.reason_sl ? `*Why this SL:* ${data.exit_plan.reason_sl}` : ''}
${data.exit_plan?.reason_tp1 ? `*Why TP1:* ${data.exit_plan.reason_tp1}` : ''}`;

    case 'position_sizing':
      return `💰 *Position Sizing (ML-Determined)*

*Contracts:* ${data.position_sizing?.contracts || data.positionSizing?.contracts || 'N/A'}
*Risk / Trade:* $${((data.position_sizing?.risk_per_trade_dollars || data.positionSizing?.riskPerTradeDollars || 0)).toFixed(0)}
*Risk %:* ${((data.position_sizing?.risk_pct_of_account || data.positionSizing?.riskPctOfAccount || 0) * 100).toFixed(2)}%
*Kelly Fraction:* ${((data.position_sizing?.kelly_fraction || data.positionSizing?.kellyFraction || 0) * 100).toFixed(0)}%
*ML Adj:* ${data.position_sizing?.ml_adjustment_pct || data.positionSizing?.mlAdjustmentPct || 'N/A'}

*Max Wait:* ${data.position_sizing?.max_wait_minutes || data.positionSizing?.maxWaitMinutes || 'N/A'} min
*Drawdown Throttle:* ${data.position_sizing?.drawdown_throttled || data.positionSizing?.drawdownThrottled ? '⚠️ ACTIVE — size halved' : '✅ Normal'}

${data.position_sizing?.reasoning || data.positionSizing?.reasoning || ''}`;

    case 'rrr':
      return `📊 *RRR Optimization*

*Recommended R:R:* 1:${data.rrr?.recommended || data.rrr?.recommended_rr || 'N/A'}
*Min Acceptable:* 1:${data.rrr?.min_acceptable || 'N/A'}
*Confidence:* ${data.rrr?.confidence ? (data.rrr.confidence * 100).toFixed(0) + '%' : 'N/A'}

${data.rrr?.reason || data.rrr?.why_this_rr || ''}
${data.rrr?.session_specific ? '\n*By Session:*\n' + Object.entries(data.rrr.session_specific)
  .map(([s, info]) => `  ${s}: 1:${info.rr || 'N/A'} — ${info.reason || ''}`)
  .join('\n') : ''}`;

    case 'ml_analysis':
      // Fall through to default — will be handled by BFF consensus in processConversation
      return `📊 *ML Signal*

*Signal:* ${data.consensus?.signal || data.signal || 'N/A'}
*Confidence:* ${data.consensus?.confidence ? (data.consensus.confidence * 100).toFixed(1) + '%' : (data.confidence ? (data.confidence * 100).toFixed(1) + '%' : 'N/A')}

*Alpha:* ${data.consensus?.alpha?.score || data.alpha?.score || 'N/A'} ticks
*Session:* ${data.consensus?.session_probability?.main?.P_up ? 'Main P(up) = ' + (data.consensus.session_probability.main.P_up * 100).toFixed(0) + '%' : 'N/A'}
*Regime:* ${data.consensus?.physics_regime?.regime || data.regime || 'N/A'}
*Stop (ticks):* ${data.consensus?.exit_plan?.stop_loss_ticks || data.exit_plan?.stop_loss_ticks || 'N/A'}
*TP1 (ticks):* ${data.consensus?.exit_plan?.tp1_ticks || data.exit_plan?.tp1_ticks || 'N/A'}`;

    default:
      return `📊 *ML Signal*

*Signal:* ${data.signal || data.consensus?.signal || 'N/A'}
*Confidence:* ${data.confidence ? (data.confidence * 100).toFixed(1) + '%' : data.consensus?.confidence ? (data.consensus.confidence * 100).toFixed(1) + '%' : 'N/A'}

*Alpha:* ${data.alpha?.score || data.alpha_score || 'N/A'} ticks
*Session:* ${data.session_probability?.main?.P_up ? 'Main P(up) = ' + (data.session_probability.main.P_up * 100).toFixed(0) + '%' : 'N/A'}
*Regime:* ${data.physics_regime?.regime || data.regime || 'N/A'}
*Stop (ticks):* ${data.exit_plan?.stop_loss_ticks || 'N/A'}
*TP1 (ticks):* ${data.exit_plan?.tp1_ticks || 'N/A'}`;
  }
}

// ─── Main Conversation Handler ─────────────────────────────────────────────

/**
 * Main entry point: process a Telegram message and return the response text.
 *
 * @param {string} text - User's message
 * @param {object} context - Additional context (userId, chatId, etc.)
 * @returns {string} Response text
 */
async function processConversation(text, context = {}) {
  const { chatId, userId } = context;

  // Detect intent
  const { intent } = detectIntent(text);

  // Handle special commands
  if (intent === 'reset') {
    if (chatId) clearSession(chatId);
    return 'Conversation history cleared. How can I help you?';
  }

  if (intent === 'help') {
    return `*TradersApp AI Bot — Commands*

/start — Welcome message
/reset — Clear conversation history
/signal — Get ML signal analysis
/regime — Get physics regime analysis
/alpha — Get alpha score analysis
/rrr — Get optimal R:R analysis
/session — Get session probabilities
/exit — Get exit strategy
/position — Get position sizing advice
/pbo — Learn about backtest overfitting

Or just ask any trading question in natural language!`;
  }

  // Add user message to session
  if (chatId) {
    addToSession(chatId, 'user', text);
  }

  // Build messages array
  const messages = (chatId ? getSessionMessages(chatId) : [])
    .concat([{ role: 'user', content: text }]);

  // ── ML-specific intents: call ML Engine first ──────────────────────────
  if (['ml_analysis', 'alpha', 'regime', 'rrr', 'session', 'exit_strategy', 'position_sizing', 'pbo'].includes(intent)) {
    try {
      // /signal → use full BFF consensus for richest data
      if (intent === 'ml_analysis') {
        const consensusResult = await callBFFConsensus();
        if (consensusResult.ok && consensusResult.data) {
          const formatted = formatConsensusForTelegram(consensusResult.data);
          // Also get AI commentary
          const aiMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...(chatId ? getSessionMessages(chatId) : []),
            {
              role: 'user',
              content: `The ML system returned this analysis:\n${formatted}\n\nPlease give a brief trading insight or warning based on this data. Keep it under 3 sentences.`,
            },
          ];
          const aiResult = await callBestAvailableAI(aiMessages);
          if (chatId) addToSession(chatId, 'assistant', aiResult.text);
          return `${formatted}\n\n*AI Insight:* ${aiResult.text}\n\n*Model used:* ${aiResult.model} via ${aiResult.provider}`;
        } else {
          // Fallback: try direct ML Engine
          const mlResult = await callMLEngine('/predict', {});
          if (mlResult.ok && mlResult.data) {
            const mlText = formatMLResponse(mlResult, 'ml_analysis');
            if (chatId) addToSession(chatId, 'assistant', mlText);
            return `${mlText}\n\n*Note: BFF unavailable, using direct ML Engine.*`;
          }
          throw new Error('Both BFF and ML Engine are unavailable');
        }
      }

      let endpoint = '/predict';
      let mlBody = {};

      if (intent === 'regime') {
        endpoint = '/regime';
      } else if (intent === 'pbo') {
        // PBO info request — explain methodology
        messages.unshift({ role: 'system', content: SYSTEM_PROMPT });
        const result = await callBestAvailableAI(messages);
        if (chatId) addToSession(chatId, 'assistant', result.text);
        return `${result.text}\n\n*Model used:* ${result.model} via ${result.provider}`;
      }

      const mlResult = await callMLEngine(endpoint, mlBody);

      if (mlResult.ok && mlResult.data) {
        const mlText = formatMLResponse(mlResult, intent);

        // Also get AI commentary on the ML result
        const aiMessages = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...(chatId ? getSessionMessages(chatId) : []),
          {
            role: 'user',
            content: `The ML system returned this analysis:\n${mlText}\n\nPlease explain what this means in simple terms for a trader.`,
          },
        ];

        const aiResult = await callBestAvailableAI(aiMessages);
        if (chatId) addToSession(chatId, 'assistant', aiResult.text);
        return `${aiResult.text}\n\n*Model used:* ${aiResult.model} via ${aiResult.provider}`;
      } else {
        console.error('ML Engine call failed:', mlResult.error);
        // Fall through to general AI response
      }
    } catch (e) {
      console.error('ML integration error:', e.message);
      // Fall through to general AI response
    }
  }

  // ── General conversation ─────────────────────────────────────────────────
  messages.unshift({ role: 'system', content: SYSTEM_PROMPT });

  try {
    const result = await callBestAvailableAI(messages);
    if (chatId) addToSession(chatId, 'assistant', result.text);
    return `${result.text}\n\n*Model used:* ${result.model} via ${result.provider}`;
  } catch (e) {
    console.error('All AI providers failed:', e.message);
    return `I'm having trouble connecting to my AI services right now. Please try again in a moment.\n\nIf this persists, try:\n• /reset to clear the conversation\n• /help for available commands\n\nError: ${e.message}`;
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  processConversation,
  detectIntent,
  clearSession,
  AI_PROVIDERS,
};
