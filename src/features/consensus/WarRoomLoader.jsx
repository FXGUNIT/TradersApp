/**
 * WarRoomLoader — Recursive consensus deliberation phase display
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React, { useState, useEffect } from 'react';
import { Radio, Scale, Search, Landmark, Trophy, Brain } from 'lucide-react';

const AURA_COLORS = {
  info: 'var(--aura-status-info, #0A84FF)',
  success: 'var(--aura-status-success, #30D158)',
  warning: 'var(--aura-status-warning, #F59E0B)',
  muted: 'var(--text-secondary, #8E8E93)',
  borderSubtle: 'var(--border-subtle, rgba(255,255,255,0.06))',
};

const PHASE_DEFINITIONS = [
  { key: 'stage1', label: 'Phase 1: Alpha, Beta, & Groq deployed',    Icon: Radio,    iconColor: AURA_COLORS.info },
  { key: 'stage2', label: 'Phase 2: Gemini synthesizing preliminary intel', Icon: Scale,   iconColor: AURA_COLORS.success },
  { key: 'stage3', label: 'Phase 3: Cross-Examination in progress',   Icon: Search,    iconColor: '#BF5AF2' },
  { key: 'stage4', label: 'Phase 4: Qwen 397B assembling Intelligence Briefing', Icon: Landmark, iconColor: AURA_COLORS.warning },
  { key: 'stage5', label: 'Phase 5: Gemini rendering Supreme Verdict', Icon: Trophy,   iconColor: AURA_COLORS.info },
];

const STAGE_ORDER = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'complete'];

export const WarRoomLoader = React.memo(function WarRoomLoader({ councilStage = { current: 'stage1' } }) {
  const [currentStage, setCurrentStage] = useState(councilStage.current);

  useEffect(() => {
    const interval = setInterval(() => {
      const latest = councilStage.current;
      if (latest !== currentStage) {
        setCurrentStage(latest);
      }
    }, 200);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally stable — reads councilStage ref directly

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
        color: AURA_COLORS.muted,
        textTransform: 'uppercase',
        marginBottom: 8,
        textAlign: 'center',
      }}>
        RECURSIVE CONSENSUS ENGINE
      </div>

      {PHASE_DEFINITIONS.map((phase) => {
        const si = STAGE_ORDER.indexOf(phase.key);
        const isDone = ci > si;
        const isActive = currentStage === phase.key;

        return (
          <div key={phase.key} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 16px',
            borderRadius: 12,
            background: isDone
              ? 'var(--aura-status-success, rgba(48,209,88,0.06))'
              : isActive
                ? 'var(--aura-status-info, rgba(10,132,255,0.06))'
                : 'transparent',
            border: `1px solid ${isDone ? 'var(--aura-status-success, rgba(48,209,88,0.15))' : isActive ? 'var(--aura-status-info, rgba(10,132,255,0.15))' : AURA_COLORS.borderSubtle}`,
            transition: 'all 0.4s ease',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, flexShrink: 0,
              background: isDone
                ? 'var(--aura-status-success, rgba(48,209,88,0.15))'
                : isActive
                  ? 'var(--aura-status-info, rgba(10,132,255,0.15))'
                  : AURA_COLORS.borderSubtle,
              color: isDone ? AURA_COLORS.success : isActive ? AURA_COLORS.info : 'var(--text-tertiary, #3A3A3C)',
              border: `1.5px solid ${isDone ? AURA_COLORS.success : isActive ? AURA_COLORS.info : 'var(--text-tertiary, #3A3A3C)'}`,
              animation: isActive ? 'cc-pulse 1.5s ease-in-out infinite' : 'none',
            }}>
              {isDone ? '✓' : (() => { const PhaseIcon = phase.Icon; return <PhaseIcon size={14} color={phase.iconColor} />; })()}
            </div>

            <span style={{
              fontSize: 13,
              fontWeight: isDone ? 600 : isActive ? 700 : 500,
              color: isDone ? AURA_COLORS.success : isActive ? 'var(--text-primary, #F2F2F7)' : 'var(--text-tertiary, #3A3A3C)',
              letterSpacing: 0.3,
              animation: isActive ? 'cc-text-pulse 2s ease-in-out infinite' : 'none',
            }}>
              {phase.label}{isActive ? '...' : ''}
            </span>
          </div>
        );
      })}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        <div style={{
          width: 24, height: 24,
          border: '2.5px solid var(--border-subtle, rgba(255,255,255,0.08))',
          borderTopColor: AURA_COLORS.info,
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
});
