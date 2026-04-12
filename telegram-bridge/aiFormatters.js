/**
 * AI Response Formatters for Telegram
 *
 * Pure formatting functions — no side effects, no external calls.
 * All Telegram Markdown rendering lives here.
 */

// ─── Consensus Formatting ─────────────────────────────────────────────────────

/**
 * Format the full BFF consensus response as a compact Telegram message.
 * @param {object} data - BFF consensus response shape
 * @returns {string} Markdown-formatted Telegram message
 */
export function formatConsensusForTelegram(data) {
  const signal = data.consensus?.signal || data.signal || "N/A";
  const confidence = data.consensus?.confidence || data.confidence || 0;
  const alpha = data.consensus?.alpha?.score || data.alpha?.score || 0;
  const regime =
    data.consensus?.physics_regime?.regime ||
    data.regime ||
    data.physics_regime?.regime ||
    "N/A";
  const exitPlan = data.consensus?.exit_plan || data.exit_plan || {};
  const rrr = data.consensus?.rrr?.recommended || data.rrr?.recommended || 0;
  const session =
    data.consensus?.session_probability?.main ||
    data.session_probability?.main ||
    {};

  const signalIcon =
    signal === "LONG" ? "🟢" : signal === "SHORT" ? "🔴" : "⚪";
  const confidenceBar =
    "▓".repeat(Math.round(confidence * 10)) +
    "░".repeat(10 - Math.round(confidence * 10));

  const lines = [
    `${signalIcon} *${signal}* | ${confidenceBar} ${(confidence * 100).toFixed(0)}%`,
    "",
    `📊 Alpha: *${typeof alpha === "number" ? alpha.toFixed(1) : alpha}* ticks`,
    `🔬 Regime: *${regime}*`,
    `⚡ R:R: *1:${rrr}*`,
    `📈 Session: P(up)=${session.P_up ? (session.P_up * 100).toFixed(0) + "%" : "N/A"} | Best: ${session.best_entry || "N/A"}`,
    "",
    `🎯 SL: *${exitPlan.stop_loss_ticks || "?"}* ticks`,
    `📌 TP1: *${exitPlan.tp1_ticks || "?"}* ticks (close ${exitPlan.tp1_pct ? (exitPlan.tp1_pct * 100).toFixed(0) + "%" : "?"})`,
    `📌 TP2: *${exitPlan.tp2_ticks || "?"}* ticks (close ${exitPlan.tp2_pct ? (exitPlan.tp2_pct * 100).toFixed(0) + "%" : "?"})`,
  ];

  // Add news alert if present
  if (data.breaking_news?.length > 0) {
    const highImpact = data.breaking_news.filter((n) => n.impact === "HIGH");
    if (highImpact.length > 0) {
      lines.push("");
      lines.push(`🚨 *${highImpact.length} HIGH IMPACT* news item(s)`);
      for (const news of highImpact.slice(0, 2)) {
        lines.push(
          `  • ${news.title?.slice(0, 60)}${news.title?.length > 60 ? "..." : ""}`,
        );
      }
    }
  }

  // Add timing recommendation
  if (data.consensus?.timing) {
    const timing = data.consensus.timing;
    lines.push("");
    if (timing.enter_now) {
      lines.push("✅ *Enter NOW* — candle close entry recommended");
    } else {
      lines.push(
        `⏳ *Wait* — best window: ${timing.best_entry_window || "N/A"} (${timing.minutes_to_best_window || "?"} min)`,
      );
    }
    if (timing.news?.trade_allowed === false) {
      lines.push(
        `⚠️ High-impact event in ${timing.news.timeUntil_min || "?"} min — reduce size`,
      );
    }
  }

  // Add model votes summary
  if (data.consensus?.votes) {
    const votes = data.consensus.votes;
    const longVotes = Object.values(votes).filter(
      (v) => v.signal === "LONG",
    ).length;
    const shortVotes = Object.values(votes).filter(
      (v) => v.signal === "SHORT",
    ).length;
    const neutralVotes = Object.values(votes).filter(
      (v) => v.signal === "NEUTRAL",
    ).length;
    lines.push("");
    lines.push(
      `🗳️ Votes: ${longVotes} LONG | ${shortVotes} SHORT | ${neutralVotes} NEUTRAL`,
    );
  }

  lines.push("");
  lines.push(
    "_This is not financial advice. Futures trading involves substantial risk of loss._",
  );

  return lines.join("\n");
}

// ─── ML Response Formatting ───────────────────────────────────────────────────

/**
 * Format an ML Engine result for Telegram based on the detected intent.
 * @param {{data: object}} result - ML Engine response {data: {...}}
 * @param {string} intent - Detected intent key
 * @returns {string} Markdown-formatted Telegram message
 */
export function formatMLResponse(result, intent) {
  const { data } = result;
  if (!data) return "ML Engine returned an empty response.";

  switch (intent) {
    case "regime":
      return `📊 *Physics Regime Analysis*

*Regime:* ${data.regime || "N/A"}
*Confidence:* ${data.confidence ? (data.confidence * 100).toFixed(1) + "%" : "N/A"}

*Tsallis q:* ${data.fp_fk?.q_parameter?.toFixed(4) || "N/A"} ${data.fp_fk?.q_parameter > 1 ? "(fat tails)" : "(thin tails)"}
*FK Wave Speed:* ${data.fp_fk?.fk_wave_speed?.toFixed(4) || "N/A"}
*Criticality κ:* ${data.fp_fk?.criticality_index?.toFixed(4) || "N/A"}

*Hurst H:* ${data.anomalous_diffusion?.hurst_H?.toFixed(4) || "N/A"} ${data.anomalous_diffusion?.diffusion_type || ""}
*Multifractality:* ${data.anomalous_diffusion?.multifractality?.toFixed(4) || "N/A"}

*Deleverage:* ${data.deleverage_signal ? "⚠️ YES - reduce risk" : "✅ Normal"}
*Position Adj:* ${data.position_adjustment ? data.position_adjustment.toFixed(2) + "x" : "N/A"}
*Stop Multiplier:* ${data.stop_multiplier?.toFixed(2) || "N/A"}x

${data.physics_explanation || ""}`;

    case "alpha":
      return `📈 *Alpha Analysis*

*Alpha Score:* ${data.alpha?.score || data.alpha_score || "N/A"}
*Confidence:* ${data.alpha?.confidence ? (data.alpha.confidence * 100).toFixed(1) + "%" : "N/A"}

${
  data.alpha?.alpha_by_session
    ? Object.entries(data.alpha.alpha_by_session)
        .map(
          ([session, info]) =>
            `*${session}:* ${info.alpha?.toFixed(2) || "N/A"} ticks (${info.confidence ? (info.confidence * 100).toFixed(0) + "%" : "N/A"} confidence)`,
        )
        .join("\n")
    : ""
}

*Current Time Alpha:* ${data.alpha?.current_time_alpha || "N/A"}
*Stability:* ${data.alpha?.stability ? (data.alpha.stability * 100).toFixed(1) + "%" : "N/A"}
*Best Window:* ${data.alpha?.best_alpha_window || "N/A"}`;

    case "session":
      return `📊 *Session Probability*

${
  data.session_probability
    ? Object.entries(data.session_probability)
        .map(
          ([session, info]) =>
            `*${session}:* P(up) = ${(info.P_up * 100).toFixed(0)}% | Alpha: ${info.alpha?.toFixed(1) || "N/A"} ticks | Best: ${info.best_entry || "N/A"}`,
        )
        .join("\n")
    : "Session data unavailable."
}`;

    case "exit_strategy":
      return `🎯 *Exit Strategy (ML-Determined)*

*Strategy:* ${data.exit_plan?.strategy || data.exitPlan?.strategy || "ML-DETERMINED"}
*Stop Loss:* ${data.exit_plan?.stop_loss_ticks || data.exitPlan?.stopLossTicks || "N/A"} ticks

*TP1:* ${((data.exit_plan?.tp1_pct || data.exitPlan?.tp1Pct || 0) * 100).toFixed(0)}% @ ${data.exit_plan?.tp1_ticks || data.exitPlan?.tp1Ticks || "N/A"}t
*TP2:* ${((data.exit_plan?.tp2_pct || data.exitPlan?.tp2Pct || 0) * 100).toFixed(0)}% @ ${data.exit_plan?.tp2_ticks || data.exitPlan?.tp2Ticks || "N/A"}t
*Keep open:* ${((data.exit_plan?.tp3_pct || data.exitPlan?.tp3Pct || 0) * 100).toFixed(0)}%

*Trail:* ${data.exit_plan?.trailing_distance_ticks || data.exitPlan?.trailingDistanceTicks || "N/A"}t (activate @ ${data.exit_plan?.trail_activate_at_ticks || data.exitPlan?.trailActivateAtTicks || "N/A"}t profit)
*Max Hold:* ${data.exit_plan?.max_hold_minutes || data.exitPlan?.maxHoldMinutes || "N/A"} min
*Move SL to BE:* ${data.exit_plan?.move_sl_to_be_at || data.exitPlan?.moveSlToBeAt || "N/A"}t profit

${data.exit_plan?.reason_sl ? `*Why this SL:* ${data.exit_plan.reason_sl}` : ""}
${data.exit_plan?.reason_tp1 ? `*Why TP1:* ${data.exit_plan.reason_tp1}` : ""}`;

    case "position_sizing":
      return `💰 *Position Sizing (ML-Determined)*

*Contracts:* ${data.position_sizing?.contracts || data.positionSizing?.contracts || "N/A"}
*Risk / Trade:* $${(data.position_sizing?.risk_per_trade_dollars || data.positionSizing?.riskPerTradeDollars || 0).toFixed(0)}
*Risk %:* ${((data.position_sizing?.risk_pct_of_account || data.positionSizing?.riskPctOfAccount || 0) * 100).toFixed(2)}%
*Kelly Fraction:* ${((data.position_sizing?.kelly_fraction || data.positionSizing?.kellyFraction || 0) * 100).toFixed(0)}%
*ML Adj:* ${data.position_sizing?.ml_adjustment_pct || data.positionSizing?.mlAdjustmentPct || "N/A"}

*Max Wait:* ${data.position_sizing?.max_wait_minutes || data.positionSizing?.maxWaitMinutes || "N/A"} min
*Drawdown Throttle:* ${data.position_sizing?.drawdown_throttled || data.positionSizing?.drawdownThrottled ? "⚠️ ACTIVE — size halved" : "✅ Normal"}

${data.position_sizing?.reasoning || data.positionSizing?.reasoning || ""}`;

    case "rrr":
      return `📊 *RRR Optimization*

*Recommended R:R:* 1:${data.rrr?.recommended || data.rrr?.recommended_rr || "N/A"}
*Min Acceptable:* 1:${data.rrr?.min_acceptable || "N/A"}
*Confidence:* ${data.rrr?.confidence ? (data.rrr.confidence * 100).toFixed(0) + "%" : "N/A"}

${data.rrr?.reason || data.rrr?.why_this_rr || ""}
${
  data.rrr?.session_specific
    ? "\n*By Session:*\n" +
      Object.entries(data.rrr.session_specific)
        .map(
          ([s, info]) => `  ${s}: 1:${info.rr || "N/A"} — ${info.reason || ""}`,
        )
        .join("\n")
    : ""
}`;

    case "ml_analysis":
      return `📊 *ML Signal*

*Signal:* ${data.consensus?.signal || data.signal || "N/A"}
*Confidence:* ${data.consensus?.confidence ? (data.consensus.confidence * 100).toFixed(1) + "%" : data.confidence ? (data.confidence * 100).toFixed(1) + "%" : "N/A"}

*Alpha:* ${data.consensus?.alpha?.score || data.alpha?.score || "N/A"} ticks
*Session:* ${data.consensus?.session_probability?.main?.P_up ? "Main P(up) = " + (data.consensus.session_probability.main.P_up * 100).toFixed(0) + "%" : "N/A"}
*Regime:* ${data.consensus?.physics_regime?.regime || data.regime || "N/A"}
*Stop (ticks):* ${data.consensus?.exit_plan?.stop_loss_ticks || data.exit_plan?.stop_loss_ticks || "N/A"}
*TP1 (ticks):* ${data.consensus?.exit_plan?.tp1_ticks || data.exit_plan?.tp1_ticks || "N/A"}`;

    default:
      return `📊 *ML Signal*

*Signal:* ${data.signal || data.consensus?.signal || "N/A"}
*Confidence:* ${data.confidence ? (data.confidence * 100).toFixed(1) + "%" : data.consensus?.confidence ? (data.consensus.confidence * 100).toFixed(1) + "%" : "N/A"}

*Alpha:* ${data.alpha?.score || data.alpha_score || "N/A"} ticks
*Session:* ${data.session_probability?.main?.P_up ? "Main P(up) = " + (data.session_probability.main.P_up * 100).toFixed(0) + "%" : "N/A"}
*Regime:* ${data.physics_regime?.regime || data.regime || "N/A"}
*Stop (ticks):* ${data.exit_plan?.stop_loss_ticks || "N/A"}
*TP1 (ticks):* ${data.exit_plan?.tp1_ticks || "N/A"}`;
  }
}
