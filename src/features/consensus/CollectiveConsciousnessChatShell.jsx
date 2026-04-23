import React from "react";
import { Brain } from "lucide-react";
import MessageRenderer from "../../components/MessageRenderer.jsx";
import { WarRoomLoader } from "./WarRoomLoader.jsx";

const STARTER_PROMPTS = ["MNQ analysis", "Risk management", "Market structure", "Session bias today"];

export function CollectiveConsciousnessChatShell({
  messages,
  isProcessing,
  isFastMode,
  textColor,
  mutedColor,
  isDark,
  liveUsageState,
  formatRemainingTime,
  upgradeRequestState,
  handleUpgradeRequest,
  hasBffEnabled,
  engineModeLabel,
  configuredEngineCount,
  onlineEngineCount,
  phaseDefinitions,
  getPhaseStatus,
  activePhaseIndex,
  hasConversation,
  councilLabel,
  onPromptSelect,
  chatEndRef,
  input,
  inputBg,
  inputBorder,
  inputRef,
  handleSubmit,
  handleKeyDown,
  auraColors,
}) {
  return (
    <>
      <div className="cc-chat-shell">
        <div className="cc-chat-layout">
          <div className="cc-chat-main">
            <div
              className="cc-usage-card"
              style={{
                borderColor: liveUsageState.isBlocked ? "rgba(245,158,11,0.35)" : auraColors.borderSubtle,
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
              }}
            >
              <div className="cc-usage-card__header">
                <div
                  className="cc-usage-card__badge"
                  style={{
                    color:
                      liveUsageState.currentTier === "premium"
                        ? auraColors.success
                        : liveUsageState.currentTier === "admin"
                          ? auraColors.manipulation
                          : auraColors.info,
                  }}
                >
                  {liveUsageState.currentTier === "premium"
                    ? "Premium Tier"
                    : liveUsageState.currentTier === "admin"
                      ? "Admin Bypass"
                      : "Standard Tier"}
                </div>
                <div className="cc-usage-card__meta" style={{ color: mutedColor }}>
                  {liveUsageState.questionsAllowed === null
                    ? `${liveUsageState.questionCount} questions in the current window`
                    : `${liveUsageState.questionCount}/${liveUsageState.questionsAllowed} questions used`}
                </div>
              </div>
              <div className="cc-usage-card__copy" style={{ color: textColor }}>
                {liveUsageState.resetTimestamp
                  ? `Rolling 24-hour window resets in ${formatRemainingTime(liveUsageState.remainingWaitMs)}.`
                  : "Your first question starts a rolling 24-hour window."}
              </div>
              {liveUsageState.isBlocked ? (
                <div
                  className="cc-usage-card__alert"
                  style={{
                    background:
                      liveUsageState.currentTier === "premium"
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(245,158,11,0.08)",
                    borderColor:
                      liveUsageState.currentTier === "premium"
                        ? auraColors.borderSubtle
                        : "rgba(245,158,11,0.24)",
                  }}
                >
                  <div className="cc-usage-card__copy" style={{ color: textColor }}>
                    {liveUsageState.currentTier === "premium"
                      ? `You've reached the premium cap for this rolling window. You can ask again in ${formatRemainingTime(liveUsageState.remainingWaitMs)}.`
                      : `You've used all 10 standard questions for this rolling window. You can ask again in ${formatRemainingTime(liveUsageState.remainingWaitMs)}.`}
                  </div>
                  {liveUsageState.currentTier === "standard" ? (
                    <>
                      <div className="cc-usage-card__copy" style={{ color: mutedColor }}>
                        Upgrade to the Collective Consciousness plan for Rs 800/month to unlock 50 questions per rolling 24-hour window.
                      </div>
                      <div className="cc-usage-card__actions">
                        <button
                          onClick={handleUpgradeRequest}
                          disabled={!hasBffEnabled || upgradeRequestState.status === "sending"}
                          style={{
                            border: "none",
                            borderRadius: 12,
                            padding: "10px 14px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor:
                              !hasBffEnabled || upgradeRequestState.status === "sending"
                                ? "default"
                                : "pointer",
                            background: auraColors.warning,
                            color: "#111827",
                          }}
                        >
                          Upgrade to Premium - Rs 800/month
                        </button>
                        <button
                          onClick={handleUpgradeRequest}
                          disabled={!hasBffEnabled || upgradeRequestState.status === "sending"}
                          style={{
                            borderRadius: 12,
                            padding: "10px 14px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor:
                              !hasBffEnabled || upgradeRequestState.status === "sending"
                                ? "default"
                                : "pointer",
                            background: "transparent",
                            color: auraColors.info,
                            border: `1px solid ${auraColors.info}`,
                          }}
                        >
                          Contact Sales on Telegram
                        </button>
                      </div>
                      {upgradeRequestState.message ? (
                        <div
                          className="cc-usage-card__meta"
                          style={{
                            color:
                              upgradeRequestState.status === "error"
                                ? "#DC2626"
                                : auraColors.success,
                          }}
                        >
                          {upgradeRequestState.message}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="cc-chat-stream">
              <div className="cc-chat-stream__header">
                <div className="cc-chat-stream__headline">
                  <div className="cc-chat-eyebrow">Council Feed</div>
                  <h2 className="cc-chat-title">Collective Consciousness</h2>
                  <p className="cc-chat-subtitle" style={{ color: mutedColor }}>
                    Multi-model debate, structured cross-examination, and one final trading verdict.
                  </p>
                </div>
                <div
                  className="cc-chat-stream__pill"
                  style={{
                    color: isFastMode ? auraColors.warning : auraColors.manipulation,
                    borderColor: isFastMode ? auraColors.warning : auraColors.manipulation,
                    background: isFastMode ? "rgba(245,158,11,0.08)" : "rgba(124,58,237,0.08)",
                  }}
                >
                  {isFastMode ? "Quick Mode" : "Full Consensus"}
                </div>
              </div>

              {!hasConversation && !isProcessing ? (
                <div className="cc-chat-welcome">
                  <div className="cc-chat-welcome__icon" style={{ color: auraColors.manipulation }}>
                    <Brain size={46} />
                  </div>
                  <h3 className="cc-chat-welcome__title" style={{ color: textColor }}>
                    Ask the desk what matters right now
                  </h3>
                  <p className="cc-chat-welcome__copy" style={{ color: mutedColor }}>
                    Start with session bias, risk structure, or a clean market read. The council will debate first and summarize only after the conflict is resolved.
                  </p>
                  <div className="cc-chip-grid">
                    {STARTER_PROMPTS.map((example) => (
                      <button key={example} type="button" className="cc-chip" onClick={() => onPromptSelect(example)}>
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`cc-message cc-message--${msg.role === "user" ? "user" : "assistant"}`}
                >
                  <div
                    className="cc-message__label"
                    style={{ color: msg.role === "user" ? auraColors.info : auraColors.manipulation }}
                  >
                    {msg.role === "user" ? "YOU" : isFastMode ? "GROQ TACTICAL" : "SUPREME VERDICT"}
                  </div>
                  <div
                    className="cc-message__bubble"
                    style={
                      msg.role === "user"
                        ? {
                            background: "var(--accent-glow, rgba(10,132,255,0.08))",
                            border: `1px solid ${auraColors.info}`,
                            color: textColor,
                          }
                        : undefined
                    }
                  >
                    {msg.role === "user" ? (
                      <p className="cc-message__text" style={{ color: textColor }}>
                        {msg.content}
                      </p>
                    ) : (
                      <div className="cc-message__rendered" style={{ color: textColor }}>
                        <MessageRenderer content={msg.content} isDark={isDark} />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isProcessing && !isFastMode ? <WarRoomLoader /> : null}
              {isProcessing && isFastMode ? (
                <div className="cc-fast-loader">
                  <div
                    className="cc-fast-loader__spinner"
                    style={{ borderTopColor: auraColors.warning }}
                  />
                  <span className="cc-fast-loader__label" style={{ color: auraColors.warning }}>
                    Groq Tactical Processing...
                  </span>
                </div>
              ) : null}

              <div ref={chatEndRef} />
            </div>
          </div>

          <aside className="cc-chat-rail">
            <div className="cc-rail-card cc-rail-card--hero">
              <div className="cc-chat-eyebrow">Intelligence Grid</div>
              <div className="cc-rail-title" style={{ color: textColor }}>
                Council posture
              </div>
              <p className="cc-rail-copy" style={{ color: mutedColor }}>
                {engineModeLabel}
              </p>
              <div className="cc-rail-stats">
                <div className="cc-rail-stat">
                  <span className="cc-rail-stat__value" style={{ color: textColor }}>
                    {onlineEngineCount}
                  </span>
                  <span className="cc-rail-stat__label">online</span>
                </div>
                <div className="cc-rail-stat">
                  <span className="cc-rail-stat__value" style={{ color: textColor }}>
                    {configuredEngineCount}
                  </span>
                  <span className="cc-rail-stat__label">configured</span>
                </div>
                <div className="cc-rail-stat">
                  <span className="cc-rail-stat__value" style={{ color: textColor }}>
                    {hasBffEnabled ? "Live" : "Local"}
                  </span>
                  <span className="cc-rail-stat__label">transport</span>
                </div>
              </div>
            </div>

            <div className="cc-rail-card">
              <div className="cc-chat-eyebrow">Debate Pipeline</div>
              <div className="cc-phase-list">
                {phaseDefinitions.map(({ key, label, Icon, iconColor }, index) => {
                  const phaseStatus = getPhaseStatus(index, activePhaseIndex, isProcessing, hasConversation);
                  return (
                    <div key={key} className={`cc-phase-item is-${phaseStatus}`}>
                      <div className="cc-phase-item__icon" style={{ color: iconColor }}>
                        <Icon size={14} />
                      </div>
                      <div className="cc-phase-item__body">
                        <div className="cc-phase-item__title" style={{ color: textColor }}>
                          {label}
                        </div>
                        <div className="cc-phase-item__meta" style={{ color: mutedColor }}>
                          {phaseStatus === "active"
                            ? councilLabel || "Running now"
                            : phaseStatus === "complete"
                              ? "Completed"
                              : "Queued"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="cc-rail-card">
              <div className="cc-chat-eyebrow">Prompt Starters</div>
              <div className="cc-chip-grid">
                {STARTER_PROMPTS.map((example) => (
                  <button key={example} type="button" className="cc-chip" onClick={() => onPromptSelect(example)}>
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div
        className="cc-composer-shell"
        style={{
          borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
        }}
      >
        <div className="cc-composer">
          <div className="cc-composer__inner">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => onPromptSelect(event.target.value, { replace: true })}
              onKeyDown={handleKeyDown}
              placeholder={
                liveUsageState.isBlocked
                  ? "Collective Consciousness will unlock when your rolling window resets..."
                  : "Ask the Intelligence Grid..."
              }
              disabled={isProcessing || liveUsageState.isBlocked}
              rows={1}
              className="cc-composer__input"
              style={{
                background: inputBg,
                borderColor: inputBorder,
                color: textColor,
              }}
              onFocus={(event) => {
                event.currentTarget.style.borderColor = auraColors.info;
              }}
              onBlur={(event) => {
                event.currentTarget.style.borderColor = inputBorder;
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={isProcessing || liveUsageState.isBlocked || !input.trim()}
              className="cc-composer__submit"
              style={{
                background:
                  isProcessing || liveUsageState.isBlocked || !input.trim()
                    ? "var(--surface-glass, rgba(255,255,255,0.06))"
                    : auraColors.info,
                color:
                  isProcessing || liveUsageState.isBlocked || !input.trim()
                    ? mutedColor
                    : "var(--accent-text, #FFFFFF)",
                cursor:
                  isProcessing || liveUsageState.isBlocked || !input.trim() ? "default" : "pointer",
              }}
            >
              ^
            </button>
          </div>
        </div>

        <div
          className="cc-composer__caption"
          style={{ color: isDark ? "var(--text-tertiary, #3A3A3C)" : auraColors.mutedSoft }}
        >
          Powered by Multi-Model AI Consensus
        </div>

        <div
          className="cc-composer__mode"
          style={{
            background: isFastMode
              ? "var(--aura-status-warning, rgba(245,158,11,0.08))"
              : "var(--aura-amd-manipulation, rgba(124,58,237,0.08))",
            borderColor: isFastMode ? auraColors.warning : auraColors.manipulation,
            color: isFastMode ? auraColors.warning : auraColors.manipulation,
            animation: isFastMode ? "cc-fast-pulse 2s ease-in-out infinite" : "cc-full-glow 3s ease-in-out infinite",
          }}
        >
          {engineModeLabel}
        </div>

        <style>{`
          @keyframes cc-fast-pulse {
            0%, 100% { box-shadow: 0 0 8px rgba(245,158,11,0.15); }
            50% { box-shadow: 0 0 20px rgba(245,158,11,0.3); }
          }
          @keyframes cc-full-glow {
            0%, 100% { box-shadow: 0 0 10px rgba(124,58,237,0.15), 0 0 30px rgba(59,130,246,0.08); }
            50% { box-shadow: 0 0 24px rgba(124,58,237,0.35), 0 0 50px rgba(59,130,246,0.15); }
          }
        `}</style>
      </div>
    </>
  );
}

export default CollectiveConsciousnessChatShell;
