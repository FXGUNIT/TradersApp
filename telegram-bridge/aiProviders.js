/**
 * AI Provider Calls & HTTP Utilities
 *
 * All AI provider calls and ML/BFF HTTP wrappers.
 * Exported functions are imported by aiConversation.js.
 */

import https from "node:https";
import http from "node:http";
import { AI_PROVIDERS } from "./aiConversationTypes.js";

// ─── HTTP Utility ─────────────────────────────────────────────────────────────

/**
 * Make an HTTP POST request (works for both http and https).
 */
function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            ok: res.statusCode < 400,
            status: res.statusCode,
            data: JSON.parse(data),
          });
        } catch {
          resolve({
            ok: false,
            status: res.statusCode,
            data: null,
            error: "Parse error",
            raw: data,
          });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

// ─── ML Engine Integration ────────────────────────────────────────────────────

/**
 * Call the ML Engine for technical analysis.
 * @param {string} endpoint
 * @param {object} body
 * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
 */
export async function callMLEngine(endpoint, body) {
  const mlEngineUrl = process.env.ML_ENGINE_URL || "http://localhost:8001";
  const apiKey = process.env.ML_ENGINE_API_KEY || "dev-key";

  return new Promise((resolve) => {
    const url = new URL(`${mlEngineUrl}${endpoint}`);
    const data = JSON.stringify(body);

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(data),
      },
      timeout: 15000,
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({
            ok: res.statusCode === 200,
            data: JSON.parse(body),
            status: res.statusCode,
          });
        } catch {
          resolve({
            ok: false,
            data: null,
            status: res.statusCode,
            error: "Parse error",
          });
        }
      });
    });

    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "Timeout" });
    });
    req.write(data);
    req.end();
  });
}

/**
 * Call the BFF for ML consensus — the full aggregated signal.
 */
export async function callBFFConsensus() {
  const bffUrl =
    process.env.BFF_URL || process.env.VITE_BFF_URL || "http://127.0.0.1:8788";
  const serviceKey =
    process.env.SUPPORT_SERVICE_KEY || process.env.TELEGRAM_ADMIN_API_KEY || "";

  return new Promise((resolve) => {
    const url = new URL(`${bffUrl}/ml/consensus`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(serviceKey ? { "X-Support-Key": serviceKey } : {}),
      },
      timeout: 20000,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            ok: res.statusCode === 200,
            data: JSON.parse(data),
            status: res.statusCode,
          });
        } catch {
          resolve({
            ok: false,
            data: null,
            status: res.statusCode,
            error: "Parse error",
          });
        }
      });
    });

    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "Timeout" });
    });
    req.end();
  });
}

/**
 * Call BFF admin sessions endpoint.
 */
export async function callBFFAdminSessions() {
  const bffUrl = process.env.BFF_URL || "http://127.0.0.1:8788";
  const serviceKey =
    process.env.SUPPORT_SERVICE_KEY || process.env.TELEGRAM_ADMIN_API_KEY || "";

  return new Promise((resolve) => {
    const url = new URL(`${bffUrl}/admin/sessions`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Support-Key": serviceKey,
      },
      timeout: 10000,
    };
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({
            ok: res.statusCode < 400,
            status: res.statusCode,
            data: JSON.parse(body),
          });
        } catch {
          resolve({ ok: false, status: res.statusCode, error: "Parse error" });
        }
      });
    });
    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "Timeout" });
    });
    req.end();
  });
}

/**
 * Revoke a specific admin session by token.
 */
export async function callBFFRevokeSession(sessionId) {
  const bffUrl = process.env.BFF_URL || "http://127.0.0.1:8788";
  const serviceKey =
    process.env.SUPPORT_SERVICE_KEY || process.env.TELEGRAM_ADMIN_API_KEY || "";

  return new Promise((resolve) => {
    const url = new URL(`${bffUrl}/admin/sessions`);
    const body = JSON.stringify({ id: sessionId });
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-Support-Key": serviceKey,
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 10000,
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({
            ok: res.statusCode < 400,
            status: res.statusCode,
            data: JSON.parse(data),
          });
        } catch {
          resolve({ ok: false, status: res.statusCode, error: "Parse error" });
        }
      });
    });
    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "Timeout" });
    });
    req.write(body);
    req.end();
  });
}

// ─── AI Provider Calls ────────────────────────────────────────────────────────

/**
 * Call Gemini API (Google AI Studio).
 */
export async function callGemini(model, messages, apiKey) {
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const systemInstruction = messages.find((m) => m.role === "system");
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
  const result = await httpRequest(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    body,
  );

  if (!result.ok) {
    throw new Error(
      `Gemini API error ${result.status}: ${JSON.stringify(result.data)}`,
    );
  }

  const text = result.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

/**
 * Call OpenAI-compatible API (Groq, OpenRouter, Cerebras, DeepSeek, SambaNova).
 */
export async function callOpenAICompatible(provider, model, messages, apiKey) {
  const config = AI_PROVIDERS[provider];

  const body = {
    model: model || config.defaultModel,
    messages: messages.filter((m) => m.role !== "system"),
    temperature: 0.7,
    max_tokens: 2048,
  };

  const systemMsg = messages.find((m) => m.role === "system");
  if (systemMsg) {
    body.messages.unshift({ role: "system", content: systemMsg.content });
  }

  const result = await httpRequest(
    `${config.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(provider === "openrouter" || provider === "openrouter2"
          ? { "HTTP-Referer": "https://traders.app", "X-Title": "TradersApp" }
          : {}),
      },
    },
    body,
  );

  if (!result.ok) {
    throw new Error(
      `${config.name} API error ${result.status}: ${JSON.stringify(result.data)}`,
    );
  }

  return result.data?.choices?.[0]?.message?.content;
}

/**
 * Try providers in order of preference until one succeeds.
 * @returns {Promise<{text: string, provider: string, model: string}>}
 */
export async function callBestAvailableAI(
  messages,
  preferredOrder = ["gemini", "groq", "deepseek", "sambanova"],
) {
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
      if (provider === "gemini") {
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

  throw new Error(`All AI providers failed:\n${errors.join("\n")}`);
}
