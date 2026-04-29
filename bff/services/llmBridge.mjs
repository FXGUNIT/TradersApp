// bff/services/llmBridge.mjs
// Shared LLM invocation for Groq/SambaNova/OpenAI-compatible endpoints.

function getGroqConfig() {
  const key =
    process.env.AI_GROQ_TURBO_KEY ||
    process.env.GROQ_TURBO_KEY ||
    process.env.OPENAI_API_KEY ||
    "";
  return {
    key: "groq",
    name: "Groq",
    secret: key,
    model: "llama-3.3-70b-versatile",
    apiUrl: "https://api.groq.com/openai/v1/chat/completions",
  };
}

function getSambaNovaConfig() {
  const key =
    process.env.AI_SAMBANOVA_KEY ||
    process.env.SAMBANOVA_KEY ||
    "";
  if (!key) return null;
  return {
    key: "sambanova",
    name: "SambaNova",
    secret: key,
    model: "Llama-4-Maverick-17B-128E-Instruct-FP8",
    apiUrl: "https://api.sambanova.ai/v1/chat/completions",
  };
}

async function invokeOpenAiCompatible({ secret, apiUrl, model, prompt, extraHeaders = {} }) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`LLM request failed (${response.status}): ${body.slice(0, 200)}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("LLM returned an empty response.");
  return text;
}

/**
 * Send a prompt to the configured LLM.
 * Tries Groq first, falls back to SambaNova.
 */
export async function invokeLlm(prompt, { systemPrompt } = {}) {
  const combined = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  // Try Groq first
  const groq = getGroqConfig();
  if (groq.secret) {
    try {
      return await invokeOpenAiCompatible({
        secret: groq.secret,
        apiUrl: groq.apiUrl,
        model: groq.model,
        prompt: combined,
      });
    } catch (e) {
      console.warn(`[llmBridge] Groq failed: ${e.message}`);
    }
  }

  // Fall back to SambaNova
  const sambanova = getSambaNovaConfig();
  if (sambanova) {
    return await invokeOpenAiCompatible({
      secret: sambanova.secret,
      apiUrl: sambanova.apiUrl,
      model: sambanova.model,
      prompt: combined,
    });
  }

  throw new Error("No LLM provider configured (set AI_GROQ_TURBO_KEY or AI_SAMBANOVA_KEY)");
}

export default { invokeLlm };
