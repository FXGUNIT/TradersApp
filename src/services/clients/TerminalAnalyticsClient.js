import { postTerminalAnalytics } from "../gateways/terminalAnalyticsGateway.js";

function stripMarkdownJsonFences(text = "") {
  return String(text).replace(/```json|```/g, "").trim();
}

export async function callTerminalAi({
  messages,
  maxTokens = 2048,
  model = "deepseek-chat",
}) {
  return postTerminalAnalytics("chat", {
    model,
    maxTokens,
    messages,
  });
}

export function extractChoiceText(response, fallback = "") {
  return response?.choices?.[0]?.message?.content || fallback;
}

export function parseJsonChoice(response, fallback = {}) {
  try {
    return JSON.parse(stripMarkdownJsonFences(extractChoiceText(response, "{}")));
  } catch {
    return fallback;
  }
}

export async function parseFirmRulesWithAi({ prompt, sourceText, maxTokens = 1200 }) {
  return postTerminalAnalytics("tc-parse", {
    model: "deepseek-chat",
    maxTokens,
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: `Parse these T&C:\n\n${String(sourceText || "").slice(0, 12000)}`,
      },
    ],
  });
}

export async function extractIndicatorsWithAi({
  prompt,
  screenshots = [],
  maxTokens = 800,
}) {
  const content = screenshots.map((shot) => ({
    type: "image",
    source: { type: "base64", media_type: shot.type, data: shot.b64 },
  }));

  content.push({
    type: "text",
    text: "Extract all trading indicator values. Return ONLY JSON.",
  });

  return postTerminalAnalytics("screenshot-extract", {
    model: "deepseek-chat",
    maxTokens,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content },
    ],
  });
}

export async function runPremarketAnalysisWithAi({
  prompt,
  parsed,
  istStr,
  p1NewsChart,
  p1PremarketChart,
  p1KeyLevelsChart,
  messages,
  maxTokens = 4000,
}) {
  if (Array.isArray(messages) && messages.length > 0) {
    return postTerminalAnalytics("premarket-analysis", {
      model: "deepseek-chat",
      maxTokens,
      messages,
    });
  }

  const textMsg = `Run full Premarket Analysis. Today: ${parsed?.days?.[parsed.days.length - 1]?.date} | ${istStr}
Trading Hours ATR(14): ${parsed?.tradingHoursAtr14} pts

Screenshots: ${p1NewsChart ? "yes calendar" : "no calendar"} | ${p1PremarketChart ? "yes premarket chart" : "no chart"} | ${p1KeyLevelsChart ? "yes key levels" : "no levels"}
Apply ALL sections including SECTION AMD.`;

  const content = [];
  if (p1NewsChart) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: p1NewsChart.type, data: p1NewsChart.b64 },
    });
  }
  if (p1PremarketChart) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: p1PremarketChart.type,
        data: p1PremarketChart.b64,
      },
    });
  }
  if (p1KeyLevelsChart) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: p1KeyLevelsChart.type,
        data: p1KeyLevelsChart.b64,
      },
    });
  }
  content.push({ type: "text", text: textMsg });

  return postTerminalAnalytics("premarket-analysis", {
    model: "deepseek-chat",
    maxTokens,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: JSON.stringify(content) },
    ],
  });
}

export async function runTradePlanWithAi({
  prompt,
  p1Out,
  displayedAmdPhase,
  liveAmdPhase,
  tradeForm,
  ptVal,
  atrVal,
  maxRiskUSD,
  extractedVals,
  sd1Target,
  sd2Target,
  volatilityRegime,
  firmRules,
  curBal,
  hwmVal,
  mpChart,
  vwapChart,
  screenshots = [],
  messages,
  maxTokens = 4000,
}) {
  if (Array.isArray(messages) && messages.length > 0) {
    return postTerminalAnalytics("trade-plan", {
      model: "deepseek-chat",
      maxTokens,
      messages,
    });
  }

  const textContent = `PRE-ENTRY ANALYSIS + TRADE PLAN
=== PART 1 AMD CONTEXT ===
${p1Out ? p1Out.slice(0, 2500) + (p1Out.length > 2500 ? "\n[truncated]" : "") : "No morning analysis."}
Current AMD Phase (Part 1): ${displayedAmdPhase}
Live AMD Phase (Terminal): ${liveAmdPhase}

=== LIVE TRADE ===
Time (IST): ${tradeForm.timeIST || "?"} | Instrument: ${tradeForm.instrument} ($${ptVal}/pt)
Direction: ${tradeForm.direction} | Type: ${tradeForm.tradeType} | RRR: ${tradeForm.rrr}
Entry: ${tradeForm.entryPrice} | ATR: ${atrVal || "?"} | Max Risk: $${maxRiskUSD || 0}
ADX: ${extractedVals.adx || "?"} | CI: ${extractedVals.ci || "?"} | VWAP: ${extractedVals.vwap || "?"}
VWAP SD1: ${sd1Target?.toFixed(2) || "?"} | SD2: ${sd2Target?.toFixed(2) || "?"}
Volatility Regime: ${volatilityRegime}
Notes: ${tradeForm.notes || "none"}

=== FIRM COMPLIANCE ===
Max Daily Loss: $${firmRules.maxDailyLoss || "?"} | Max Drawdown: $${firmRules.maxDrawdown || "?"}
Current Balance: $${curBal || "?"} | HWM: $${hwmVal || "?"}`;

  const content = [];
  if (mpChart) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: mpChart.type, data: mpChart.b64 },
    });
  }
  if (vwapChart) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: vwapChart.type, data: vwapChart.b64 },
    });
  }

  screenshots.forEach((shot) => {
    content.push({
      type: "image",
      source: { type: "base64", media_type: shot.type, data: shot.b64 },
    });
  });
  content.push({ type: "text", text: textContent });

  return postTerminalAnalytics("trade-plan", {
    model: "deepseek-chat",
    maxTokens,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: JSON.stringify(content) },
    ],
  });
}

export default {
  callTerminalAi,
  extractChoiceText,
  extractIndicatorsWithAi,
  parseFirmRulesWithAi,
  parseJsonChoice,
  runPremarketAnalysisWithAi,
  runTradePlanWithAi,
};
