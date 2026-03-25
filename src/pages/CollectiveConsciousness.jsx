import React, { useState, useRef, useEffect, useCallback } from 'react';
import MessageRenderer from '../components/MessageRenderer.jsx';
import ThemeSwitcher from '../components/ThemeSwitcher.jsx';
import AiEnginesStatus from '../components/AiEnginesStatus.jsx';
import { runDeliberation, councilStage, MASTER_INTELLIGENCE_SYSTEM_PROMPT } from '../services/ai-router.js';

const PHASE_DEFINITIONS = [
  { key: 'stage1', label: 'Phase 1: Alpha, Beta, & Groq deployed', icon: '📡' },
  { key: 'stage2', label: 'Phase 2: Gemini synthesizing preliminary intel', icon: '⚖️' },
  { key: 'stage3', label: 'Phase 3: Cross-Examination in progress', icon: '🔍' },
  { key: 'stage4', label: 'Phase 4: Qwen 397B assembling Intelligence Briefing', icon: '🏛️' },
  { key: 'stage5', label: 'Phase 5: Gemini rendering Supreme Verdict', icon: '🏆' },
];

const STAGE_ORDER = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'complete'];

function WarRoomLoader() {
  const [currentStage, setCurrentStage] = useState(councilStage.current);

  useEffect(() => {
    const interval = setInterval(() => {
      if (councilStage.current !== currentStage) {
        setCurrentStage(councilStage.current);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [currentStage]);

  const ci = STAGE_ORDER.indexOf(currentStage);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      padding: '32px 0',
      maxWidth: 560,
      margin: '0 auto',
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 4,
        color: '#8E8E93',
        textTransform: 'uppercase',
        marginBottom: 8,
        textAlign: 'center',
      }}>
        RECURSIVE CONSENSUS ENGINE
      </div>

      {PHASE_DEFINITIONS.map((phase, _i) => {
        const si = STAGE_ORDER.indexOf(phase.key);
        const isDone = ci > si;
        const isActive = currentStage === phase.key;
        const _isPending = ci < si;

        return (
          <div key={phase.key} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 16px',
            borderRadius: 12,
            background: isDone
              ? 'rgba(48,209,88,0.06)'
              : isActive
                ? 'rgba(10,132,255,0.06)'
                : 'transparent',
            border: `1px solid ${isDone ? 'rgba(48,209,88,0.15)' : isActive ? 'rgba(10,132,255,0.15)' : 'rgba(255,255,255,0.04)'}`,
            transition: 'all 0.4s ease',
          }}>
            {/* Status icon */}
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
              background: isDone
                ? 'rgba(48,209,88,0.15)'
                : isActive
                  ? 'rgba(10,132,255,0.15)'
                  : 'rgba(255,255,255,0.04)',
              color: isDone ? '#30D158' : isActive ? '#0A84FF' : '#3A3A3C',
              border: `1.5px solid ${isDone ? '#30D158' : isActive ? '#0A84FF' : '#3A3A3C'}`,
              animation: isActive ? 'cc-pulse 1.5s ease-in-out infinite' : 'none',
            }}>
              {isDone ? '✓' : phase.icon}
            </div>

            {/* Label */}
            <span style={{
              fontSize: 13,
              fontWeight: isDone ? 600 : isActive ? 700 : 500,
              color: isDone ? '#30D158' : isActive ? '#F2F2F7' : '#3A3A3C',
              letterSpacing: 0.3,
              animation: isActive ? 'cc-text-pulse 2s ease-in-out infinite' : 'none',
            }}>
              {phase.label}{isActive ? '...' : ''}
            </span>
          </div>
        );
      })}

      {/* Spinner */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginTop: 16,
      }}>
        <div style={{
          width: 24,
          height: 24,
          border: '2.5px solid rgba(255,255,255,0.08)',
          borderTopColor: '#0A84FF',
          borderRadius: '50%',
          animation: 'cc-spin 0.8s linear infinite',
        }} />
      </div>

      <style>{`
        @keyframes cc-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(10,132,255,0.3); }
          50% { box-shadow: 0 0 12px 4px rgba(10,132,255,0.15); }
        }
        @keyframes cc-text-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes cc-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

import { useUsers } from '../hooks/useUsers';

export default function CollectiveConsciousness({ onBack, theme, auth, currentTheme, onThemeChange }) {
  const isDark = theme === 'night';
  const { users } = useUsers();
  const [messages, setMessages] = useState([]);
  const [localHistory, setLocalHistory] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const engineMode = (() => {
    const h = new Date().getHours();
    return (h >= 8 && h < 17) ? 'fast' : 'full';
  })();
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const userData = auth?.uid ? users[auth.uid] : null;
  const isFastMode = engineMode === 'fast';

  const bgColor = isDark ? '#0F0F0F' : '#FFFFFF';
  const textColor = isDark ? '#F2F2F7' : '#111827';
  const mutedColor = isDark ? '#8E8E93' : '#9CA3AF';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing, scrollToBottom]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isProcessing) return;

    const userMsg = { role: 'user', content: trimmed, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    councilStage.current = 'idle';
    councilStage.label = '';

    const hasBalance = userData?.balance && userData.balance > 0;
    const journalCount = userData?.journal ? Object.keys(userData.journal).length : 0;

    const userContext = userData ? `
USER PROFILE:
- Name: ${userData.fullName || 'New Member'}
- Status: ${userData.status || 'PENDING'}
- Balance: ${userData.balance || 0}
- Journal Entries: ${journalCount}
- Join Date: ${userData.joinDate || 'New'}
` : 'USER: New member (no account data available)';

    const historyContext = localHistory.length > 0 ? `
CHAT HISTORY:
${localHistory.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.substring(0, 200)}`).join('\n')}
` : '';

    const scenarioContext = !hasBalance ? `
CONTEXT: New user visiting for the first time - treat them like royalty visiting your home.
- Welcome them with warmth and genuine respect
- Offer one rare insight as a gift: "I'd be honored to share something that might help you..."
- Make them feel valued and excited to explore
- Keep it brief - honor their time
- End by inviting them to ask anything they want to know more about
` : hasBalance && journalCount === 0 ? `
CONTEXT: A valued member who hasn't started their trading journey yet.
- Serve them with eagerness to help them succeed
- Share one insight that respects their intelligence
- Make them feel you're grateful for the chance to serve them
- Guide them toward what excites them most
` : `
CONTEXT: Our valued experienced trader.
- Serve them with the deep respect they deserve
- Challenge them with something worthy of their level
- Reference their journey with genuine interest
- Make them feel seen and valued
`;

    const fullPrompt = `${userContext}
${historyContext}
${scenarioContext}

User Question: ${trimmed}`;

    try {
      const response = await runDeliberation(MASTER_INTELLIGENCE_SYSTEM_PROMPT, fullPrompt);
      setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: Date.now() }]);
      setLocalHistory(prev => [...prev, { role: 'user', content: trimmed }, { role: 'assistant', content: response }]);
    } catch (err) {
      const errMsg = `Error: ${err.message}`;
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg, timestamp: Date.now() }]);
      setLocalHistory(prev => [...prev, { role: 'user', content: trimmed }, { role: 'assistant', content: errMsg }]);
    } finally {
      setIsProcessing(false);
      councilStage.current = 'idle';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: bgColor,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
      color: textColor,
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#0A84FF',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: 8,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(10,132,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          ← Command Centre
        </button>

        <div style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 2.5,
          color: mutedColor,
          textTransform: 'uppercase',
        }}>
          COLLECTIVE CONSCIOUSNESS
        </div>

        {/* Theme Switcher + Status */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ThemeSwitcher
            currentTheme={currentTheme || 'day'}
            onThemeChange={onThemeChange}
          />
          <AiEnginesStatus statuses={getAIStatuses()} />
        </div>
      </div>

      {/* Chat area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 16px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', width: '100%' }}>
          {/* Welcome state */}
          {messages.length === 0 && !isProcessing && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '50vh',
              textAlign: 'center',
              gap: 16,
            }}>
              <div style={{ fontSize: 48, opacity: 0.3 }}>🧠</div>
              <h2 style={{
                fontSize: 22,
                fontWeight: 700,
                color: textColor,
                margin: 0,
                opacity: 0.8,
              }}>
                Collective Consciousness
              </h2>
              <p style={{
                fontSize: 14,
                color: mutedColor,
                maxWidth: 480,
                lineHeight: 1.7,
                margin: 0,
              }}>
                Ask any trading question. The 5-Phase Recursive Consensus Engine will deploy
                Groq, LLaMA, Claude, Qwen 397B, and Gemini Pro in a recursive debate
                to deliver a Supreme Verdict.
              </p>
              <div style={{
                display: 'flex',
                gap: 8,
                marginTop: 8,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}>
                {['MNQ analysis', 'Risk management', 'Market structure'].map(ex => (
                  <button
                    key={ex}
                    onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      borderRadius: 20,
                      padding: '8px 16px',
                      fontSize: 12,
                      color: mutedColor,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#0A84FF'; e.currentTarget.style.color = '#0A84FF'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = mutedColor; }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div key={i} style={{
              marginBottom: 28,
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              {/* Role label */}
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.5,
                color: msg.role === 'user' ? '#0A84FF' : '#BF5AF2',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}>
                {msg.role === 'user' ? 'YOU' : (isFastMode ? 'GROQ TACTICAL' : 'SUPREME VERDICT')}
              </div>

              {/* Message bubble */}
              <div style={{
                maxWidth: msg.role === 'user' ? '75%' : '100%',
                padding: msg.role === 'user' ? '12px 18px' : '0',
                borderRadius: msg.role === 'user' ? 16 : 0,
                background: msg.role === 'user'
                  ? (isDark ? 'rgba(10,132,255,0.12)' : 'rgba(10,132,255,0.08)')
                  : 'transparent',
                border: msg.role === 'user' ? '1px solid rgba(10,132,255,0.15)' : 'none',
              }}>
                {msg.role === 'user' ? (
                  <p style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: textColor,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.content}
                  </p>
                ) : (
                  <div style={{
                    fontSize: 14,
                    lineHeight: 1.8,
                    color: textColor,
                  }}>
                    <MessageRenderer content={msg.content} isDark={isDark} />
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* War Room Loading State */}
          {isProcessing && !isFastMode && <WarRoomLoader />}
          {isProcessing && isFastMode && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '32px 0',
            }}>
              <div style={{
                width: 20,
                height: 20,
                border: '2.5px solid rgba(255,200,0,0.15)',
                borderTopColor: '#F59E0B',
                borderRadius: '50%',
                animation: 'cc-spin 0.6s linear infinite',
              }} />
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 2,
                color: '#F59E0B',
                textTransform: 'uppercase',
              }}>
                Groq Tactical Processing...
              </span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div style={{
        padding: '16px 20px',
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        flexShrink: 0,
      }}>
        <div style={{
          maxWidth: 800,
          margin: '0 auto',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
        }}>
          <div style={{
            flex: 1,
            position: 'relative',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the Intelligence Grid..."
              disabled={isProcessing}
              rows={1}
              style={{
                width: '100%',
                padding: '14px 48px 14px 18px',
                background: inputBg,
                border: `1px solid ${inputBorder}`,
                borderRadius: 14,
                color: textColor,
                fontSize: 14,
                fontFamily: 'inherit',
                lineHeight: 1.5,
                resize: 'none',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
                minHeight: 48,
                maxHeight: 120,
                overflow: 'auto',
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#0A84FF'}
              onBlur={e => e.currentTarget.style.borderColor = inputBorder}
            />

            {/* Submit button inside textarea */}
            <button
              onClick={handleSubmit}
              disabled={isProcessing || !input.trim()}
              style={{
                position: 'absolute',
                right: 8,
                bottom: 8,
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: 'none',
                background: (isProcessing || !input.trim()) ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)') : '#0A84FF',
                color: (isProcessing || !input.trim()) ? mutedColor : '#FFFFFF',
                cursor: (isProcessing || !input.trim()) ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                transition: 'all 0.2s',
              }}
            >
              ↑
            </button>
          </div>
        </div>

        <div style={{
          maxWidth: 800,
          margin: '8px auto 0',
          textAlign: 'center',
          fontSize: 10,
          color: isDark ? '#3A3A3C' : '#D1D5DB',
          letterSpacing: 0.5,
        }}>
          5-Phase RCE · Groq · LLaMA 3.3 · Claude 3.5 · Qwen 397B · Gemini Pro
        </div>

        {/* Engine Mode Status Bar */}
        <div style={{
          maxWidth: 800,
          margin: '10px auto 0',
          textAlign: 'center',
          padding: '8px 16px',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
          background: isFastMode
            ? 'rgba(245,158,11,0.08)'
            : 'rgba(124,58,237,0.08)',
          border: `1px solid ${isFastMode ? 'rgba(245,158,11,0.2)' : 'rgba(124,58,237,0.2)'}`,
          color: isFastMode ? '#F59E0B' : '#A78BFA',
          animation: isFastMode ? 'cc-fast-pulse 2s ease-in-out infinite' : 'cc-full-glow 3s ease-in-out infinite',
        }}>
          {isFastMode
            ? '⚡ FAST MODE — Single AI Active [8AM - 5PM] — Quick Answers, Less Power Used'
            : '🌌 FULL POWER MODE — All 5 AIs Working Together [5PM - 8AM] — Best Possible Answers'
          }
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

    </div>
  );
}
