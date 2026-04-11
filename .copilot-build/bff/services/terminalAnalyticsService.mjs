export function createTerminalAnalyticsService({
  fetchImpl = fetch,
  getProviderConfig,
  safeErrorMessage,
}) {
  async function invokeTerminalAnalyticsChat(payload = {}) {
    const config = getProviderConfig("deepseek");
    if (!config?.secret) {
      throw new Error("DeepSeek key not configured");
    }

    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    if (!messages.length) {
      throw new Error("DeepSeek messages are required.");
    }

    const response = await fetchImpl(config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: payload.model || config.model,
        max_tokens: Number(payload.maxTokens || payload.max_tokens || 2048),
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(
        await safeErrorMessage(response, "DeepSeek request failed"),
      );
    }

    return response.json();
  }

  return {
    invokeTerminalAnalyticsChat,
  };
}

export default {
  createTerminalAnalyticsService,
};
