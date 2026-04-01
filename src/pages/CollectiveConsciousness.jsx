import React, { useState, useRef, useEffect, useCallback } from 'react';
import MessageRenderer from '../components/MessageRenderer.jsx';
import ThemeSwitcher from '../components/ThemeSwitcher.jsx';
import AiEnginesStatus from '../components/AiEnginesStatus.jsx';
import { runDeliberation, councilStage, MASTER_INTELLIGENCE_SYSTEM_PROMPT } from '../services/ai-router.js';
import { getISTState } from '../utils/tradingUtils.js';
import {
  Brain,           // 🧠 Collective Consciousness header
  Radio,           // Phase 1: Alpha, Beta, Groq deployed
  Scale,           // Phase 2: Gemini synthesizing
  Search,          // Phase 3: Cross-Examination
  Landmark,        // Phase 4: Qwen assembling briefing
  Trophy,          // Phase 5: Gemini rendering verdict
  // ML Consensus tab icons
  Zap,             // ML signal active
  TrendingUp,      // LONG signal
  TrendingDown,    // SHORT signal
  Minus,           // NEUTRAL signal
  Target,          // RRR
  Shield,          // Exit strategy
  DollarSign,      // Position sizing
  Clock,           // Timing
  BarChart2,       // Model votes
  Activity,        // Alpha score
  CheckCircle,     // Health check
  XCircle,         // Error/offline
  RefreshCw,       // Refresh
  ChevronRight,    // Arrow
  Award,           // Best window
  // Physics regime icons
  Gauge,           // Regime state
  Waves,           // Wave speed
  Flame,           // Criticality / deleverage
  AlertTriangle,   // Deleverage warning
} from 'lucide-react';

const AURA_COLORS = {
  info: 'var(--aura-status-info, #0A84FF)',
  success: 'var(--aura-status-success, #30D158)',
  warning: 'var(--aura-status-warning, #F59E0B)',
  manipulation: 'var(--aura-amd-manipulation, #BF5AF2)',
  muted: 'var(--text-secondary, #8E8E93)',
  mutedSoft: 'var(--text-secondary, #D1D5DB)',
  borderSubtle: 'var(--border-subtle, rgba(255,255,255,0.06))',
};

const PHASE_DEFINITIONS = [
  { key: 'stage1', label: 'Phase 1: Alpha, Beta, & Groq deployed', Icon: Radio,    iconColor: AURA_COLORS.info },
  { key: 'stage2', label: 'Phase 2: Gemini synthesizing preliminary intel', Icon: Scale,   iconColor: AURA_COLORS.success },
  { key: 'stage3', label: 'Phase 3: Cross-Examination in progress', Icon: Search,    iconColor: AURA_COLORS.manipulation },
  { key: 'stage4', label: 'Phase 4: Qwen 397B assembling Intelligence Briefing', Icon: Landmark, iconColor: AURA_COLORS.warning },
  { key: 'stage5', label: 'Phase 5: Gemini rendering Supreme Verdict', Icon: Trophy,   iconColor: AURA_COLORS.info },
];

const STAGE_ORDER = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'complete'];

// ─────────────────────────────────────────────────────────────────────────────
// ML Consensus Tab
// ─────────────────────────────────────────────────────────────────────────────

const BFF_BASE = import.meta.env.VITE_BFF_URL || "http://127.0.0.1:8788";

const SIGNAL_COLORS = {
  LONG: { bg: 'rgba(48,209,88,0.08)', border: 'rgba(48,209,88,0.3)', text: '#30D158', label: 'LONG' },
  SHORT: { bg: 'rgba(255,69,58,0.08)', border: 'rgba(255,69,58,0.3)', text: '#FF453A', label: 'SHORT' },
  NEUTRAL: { bg: 'rgba(100,100,100,0.08)', border: 'rgba(100,100,100,0.2)', text: '#8E8E93', label: 'NEUTRAL' },
};

const SESSION_NAMES = ['Pre-Market', 'Main Trading', 'Post-Market'];
const SESSION_COLORS = ['rgba(255,159,10,0.7)', 'rgba(10,132,255,0.9)', 'rgba(124,58,237,0.9)'];

function SignalBadge({ signal, confidence }) {
  const c = SIGNAL_COLORS[signal] || SIGNAL_COLORS.NEUTRAL;
  const Icon = signal === 'LONG' ? TrendingUp : signal === 'SHORT' ? TrendingDown : Minus;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 16px', borderRadius: 12,
      background: c.bg, border: `1.5px solid ${c.border}`,
    }}>
      <Icon size={18} color={c.text} />
      <span style={{ fontSize: 15, fontWeight: 800, color: c.text, letterSpacing: 1 }}>
        {c.label}
      </span>
      {confidence != null && (
        <span style={{ fontSize: 11, color: c.text, opacity: 0.8, marginLeft: 4 }}>
          {(confidence * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
}

function MetricRow({ icon: Icon, label, value, sub, color = 'var(--text-primary)', muted }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 0',
      borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={13} color={muted ? 'var(--text-tertiary)' : 'var(--text-secondary)'} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
          {label}
        </span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: muted ? 'var(--text-tertiary)' : color }}>
          {value || '—'}
        </div>
        {sub && (
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, accent }) {
  return (
    <div style={{
      background: 'var(--surface-glass, rgba(255,255,255,0.03))',
      border: `1px solid ${accent || 'var(--border-subtle)'}`,
      borderRadius: 14,
      padding: '14px 16px',
      marginBottom: 12,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        marginBottom: 12,
        paddingBottom: 10,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {Icon && <Icon size={14} color={accent || 'var(--text-secondary)'} />}
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: 2,
          color: accent || 'var(--text-secondary)',
          textTransform: 'uppercase',
        }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Physics Regime Section ──────────────────────────────────────────────────

const REGIME_COLORS = {
  COMPRESSION: '#0A84FF',
  NORMAL:      '#30D158',
  EXPANSION:   '#FF9F0A',
  CRISIS:      '#FF453A',
};

function RegimeBadge({ regime }) {
  const color = REGIME_COLORS[regime] || REGIME_COLORS.NORMAL;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px',
      borderRadius: 20,
      background: `${color}22`,
      border: `1px solid ${color}`,
    }}>
      <Gauge size={12} color={color} />
      <span style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: 1 }}>
        {regime || '—'}
      </span>
    </div>
  );
}

function PhysicsRegimeSection({ regime }) {
  const r = regime;
  const regimeColor = REGIME_COLORS[r.regime] || REGIME_COLORS.NORMAL;

  const qColor = r.q_parameter < 0.9
    ? '#BF5AF2'   // sub-Gaussian → compression
    : r.q_parameter > 1.1
      ? '#FF9F0A'  // fat-tail → expansion/crisis
      : '#30D158'; // near-Gaussian → normal

  const deleverageHigh = r.deleverage_signal >= 0.6;
  const deleverageMid  = r.deleverage_signal >= 0.3;

  return (
    <SectionCard title="Physics Regime" icon={Gauge} accent={regimeColor}>
      {/* Regime badge row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gauge size={16} color={regimeColor} />
          <span style={{ fontSize: 18, fontWeight: 900, color: regimeColor }}>
            {r.regime || 'NORMAL'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          Conf: {((r.confidence || 0.5) * 100).toFixed(0)}%
        </div>
      </div>

      {/* Row 1: Tsallis q + Wave speed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
            Tsallis q
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: qColor }}>
            {r.q_parameter != null ? r.q_parameter.toFixed(3) : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {r.q_parameter < 0.9 ? 'Sub-Gaussian' : r.q_parameter > 1.1 ? 'Fat-tailed' : 'Gaussian'}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
            FK Wave Speed
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
            {r.fk_wave_speed != null ? r.fk_wave_speed.toFixed(4) : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {r.front_direction || 'STABLE'}
          </div>
        </div>
      </div>

      {/* Row 2: Hurst + Criticality */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
            Hurst H
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
            {r.hurst_H != null ? r.hurst_H.toFixed(3) : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {r.diffusion_type === 'SUB_DIFFUSION' ? 'Mean-reversion' :
             r.diffusion_type === 'SUPER_DIFFUSION' ? 'Momentum' : 'Normal'}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
            Criticality κ
          </div>
          <div style={{
            fontSize: 18, fontWeight: 800,
            color: (r.criticality_index || 0) > 0.5 ? '#FF453A' :
                   (r.criticality_index || 0) > 0.25 ? '#FF9F0A' : '#30D158',
          }}>
            {r.criticality_index != null ? r.criticality_index.toFixed(4) : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {(r.criticality_index || 0) > 0.5 ? 'Critical — deleverage' : 'Normal'}
          </div>
        </div>
      </div>

      {/* Deleverage warning */}
      {r.deleverage_signal > 0 && (
        <div style={{
          marginTop: 10,
          padding: '8px 12px',
          borderRadius: 10,
          background: deleverageHigh ? 'rgba(255,69,58,0.15)' : deleverageMid ? 'rgba(255,159,10,0.12)' : 'rgba(10,132,255,0.08)',
          border: `1px solid ${deleverageHigh ? '#FF453A' : deleverageMid ? '#FF9F0A' : '#0A84FF'}`,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <AlertTriangle size={13} color={deleverageHigh ? '#FF453A' : '#FF9F0A'} style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: deleverageHigh ? '#FF453A' : '#FF9F0A', marginBottom: 2 }}>
              DELEVERAGE {r.deleverage_signal != null ? `${(r.deleverage_signal * 100).toFixed(0)}%` : ''}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {r.deleverage_reason || 'Monitor regime transition.'}
            </div>
          </div>
        </div>
      )}

      {/* Adjustments row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
        <div style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 1 }}>STOP MULT</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: r.stop_multiplier > 1 ? '#FF9F0A' : '#0A84FF' }}>
            {r.stop_multiplier != null ? `${r.stop_multiplier.toFixed(2)}×` : '—'}
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 1 }}>POS ADJ</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: (r.position_adjustment || 0) < 0 ? '#FF453A' : '#30D158' }}>
            {r.position_adjustment != null ? `${(r.position_adjustment >= 0 ? '+' : '')}${(r.position_adjustment * 100).toFixed(1)}%` : '—'}
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 1 }}>SIG ADJ</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: r.signal_adjustment === 'LONG_FAVORED' ? '#30D158' : r.signal_adjustment === 'SHORT_FAVORED' ? '#FF453A' : 'var(--text-secondary)' }}>
            {r.signal_adjustment === 'LONG_FAVORED' ? 'LONG↑' :
             r.signal_adjustment === 'SHORT_FAVORED' ? 'SHORT↑' : '—'}
          </div>
        </div>
      </div>

      {/* Posteriors bar */}
      {r.posteriors && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            Regime Probabilities
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(r.posteriors).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: REGIME_COLORS[key] || 'var(--text-secondary)', width: 90, flexShrink: 0 }}>
                  {key}
                </span>
                <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                  <div style={{
                    width: `${Math.max(1, Math.round((val || 0) * 100))}%`,
                    height: 6,
                    background: REGIME_COLORS[key] || 'var(--text-secondary)',
                    borderRadius: 3,
                    transition: 'width 0.3s',
                  }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', width: 30, textAlign: 'right' }}>
                  {`${Math.round((val || 0) * 100)}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function VoteItem({ name, signal, confidence, reason }) {
  const c = SIGNAL_COLORS[signal] || SIGNAL_COLORS.NEUTRAL;
  const Icon = signal === 'LONG' ? TrendingUp : signal === 'SHORT' ? TrendingDown : Minus;
  return (
    <div style={{
      padding: '8px 0',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          {name}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon size={12} color={c.text} />
          <span style={{ fontSize: 11, fontWeight: 700, color: c.text }}>
            {signal}
          </span>
          {confidence != null && (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              {(confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      {reason && (
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
          {reason}
        </div>
      )}
    </div>
  );
}

function MlConsensusTab({ theme, normalizedTheme }) {
  const isDark = normalizedTheme === "midnight" || normalizedTheme === "night";
  const [consensus, setConsensus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchConsensus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BFF_BASE}/ml/consensus?session=1`, {
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      setConsensus(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || 'Failed to reach ML Engine');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsensus();
    const interval = setInterval(fetchConsensus, 60_000);
    return () => clearInterval(interval);
  }, [fetchConsensus]);

  const signal = consensus?.signal || 'NEUTRAL';
  const confidence = consensus?.confidence;
  const session = consensus?.session || { name: 'Main Trading', id: 1, session_pct: 0, minutes_into_session: 0 };
  const sc = SIGNAL_COLORS[signal];

  const sinceRefresh = lastRefresh
    ? `${Math.round((Date.now() - lastRefresh.getTime()) / 1000)}s ago`
    : '—';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 0,
      height: '100%', overflow: 'hidden',
    }}>
      {/* ML Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: `1px solid ${AURA_COLORS.borderSubtle}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Activity size={16} color={consensus?.ok !== false ? '#30D158' : '#FF453A'} />
          <span style={{
            fontSize: 11, fontWeight: 800, letterSpacing: 2,
            color: 'var(--text-secondary)', textTransform: 'uppercase',
          }}>
            ML Consensus Signal
          </span>
          {consensus?.ok !== false ? (
            <CheckCircle size={12} color="#30D158" />
          ) : (
            <XCircle size={12} color="#FF453A" />
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            Updated {sinceRefresh}
          </span>
          <button
            onClick={fetchConsensus}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8,
              background: 'var(--accent-glow, rgba(10,132,255,0.1))',
              border: `1px solid ${AURA_COLORS.info}`,
              color: AURA_COLORS.info,
              fontSize: 11, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            <RefreshCw size={11} style={{ animation: loading ? 'cc-spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px' }}>

        {loading && !consensus && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 12 }}>
            <div style={{
              width: 28, height: 28,
              border: '2.5px solid var(--border-subtle)',
              borderTopColor: AURA_COLORS.info,
              borderRadius: '50%',
              animation: 'cc-spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: 1 }}>
              FETCHING ML CONSENSUS...
            </span>
          </div>
        )}

        {error && !consensus && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', gap: 12,
            textAlign: 'center',
          }}>
            <XCircle size={32} color="#FF453A" />
            <div style={{ fontSize: 13, fontWeight: 600, color: '#FF453A' }}>ML Engine Offline</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{error}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 400, lineHeight: 1.6 }}>
              Start the ML Engine with: <code style={{ fontSize: 10 }}>cd ml-engine && python -m uvicorn main:app --port 8001</code>
            </div>
            <button
              onClick={fetchConsensus}
              style={{
                marginTop: 8, padding: '8px 20px', borderRadius: 8,
                background: 'rgba(10,132,255,0.1)', border: `1px solid ${AURA_COLORS.info}`,
                color: AURA_COLORS.info, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {consensus && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* ── Hero Signal Card ── */}
            <div style={{
              padding: '20px 20px 16px',
              borderRadius: 16,
              background: sc.bg,
              border: `1.5px solid ${sc.border}`,
              marginBottom: 14,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3, color: sc.text, opacity: 0.7, marginBottom: 8, textTransform: 'uppercase' }}>
                Collective Consensus
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <SignalBadge signal={signal} confidence={confidence} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: sc.text, lineHeight: 1 }}>
                    {signal === 'LONG' ? '▲' : signal === 'SHORT' ? '▼' : '—'}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: sc.text, opacity: 0.8 }}>
                Confidence: {(confidence * 100 || 0).toFixed(1)}% &nbsp;·&nbsp; {consensus.models_used || 0} models &nbsp;·&nbsp; {consensus.data_trades_analyzed || 0} trades analyzed
              </div>
            </div>

            {/* ── Session Context ── */}
            <SectionCard title="Session" icon={Clock} accent={SESSION_COLORS[session.id] || SESSION_COLORS[1]}>
              <MetricRow
                icon={Clock} label="Current Session"
                value={session.name}
                color={SESSION_COLORS[session.id] || SESSION_COLORS[1]}
              />
              <MetricRow
                icon={Activity} label="Session Progress"
                value={`${((session.session_pct || 0) * 100).toFixed(0)}%`}
                sub={`${session.minutes_into_session || 0} min elapsed`}
              />
              <MetricRow
                icon={Award} label="Best Alpha Window"
                value="10:00–11:30 ET"
                sub="Historical edge: 5–6 ticks avg"
              />
            </SectionCard>

            {/* ── Physics Regime (FP-FK + Tsallis q + Hurst) ── */}
            {consensus.regime && !consensus.regime.error && (
              <PhysicsRegimeSection regime={consensus.regime} />
            )}

            {/* ── Alpha Score ── */}
            {consensus.alpha && (
              <SectionCard title="Alpha Score" icon={Activity} accent="rgba(255,204,0,0.8)">
                <MetricRow
                  icon={Activity} label="Alpha Ticks"
                  value={`${(consensus.alpha.alpha_score || 0).toFixed(1)}`}
                  sub="Edge over random per trade"
                  color={consensus.alpha.alpha_score > 0 ? '#30D158' : '#FF453A'}
                />
                <MetricRow
                  icon={Activity} label="Confidence"
                  value={`${((consensus.alpha.alpha_confidence || 0) * 100).toFixed(0)}%`}
                />
                <MetricRow
                  icon={Activity} label="Stability"
                  value={`${((consensus.alpha.alpha_stability || 0) * 100).toFixed(0)}%`}
                  sub="% rolling windows with +alpha"
                />
                <MetricRow
                  icon={Award} label="Best Window"
                  value={consensus.alpha.best_alpha_window || '—'}
                />
              </SectionCard>
            )}

            {/* ── Expected Move ── */}
            {consensus.expected_move && (
              <SectionCard title="Expected Move" icon={Target} accent="rgba(10,132,255,0.8)">
                <MetricRow
                  icon={Target} label="Conservative"
                  value={`${consensus.expected_move.conservative_ticks || 0} ticks`}
                  sub="25th percentile"
                />
                <MetricRow
                  icon={Target} label="Expected"
                  value={`${consensus.expected_move.expected_ticks || 0} ticks`}
                  sub="50th percentile (median)"
                  color="#30D158"
                />
                <MetricRow
                  icon={Target} label="Aggressive"
                  value={`${consensus.expected_move.aggressive_ticks || 0} ticks`}
                  sub="75th percentile"
                />
                <MetricRow
                  icon={Target} label="Uncertainty Band"
                  value={`±${((consensus.expected_move.uncertainty_band || 0) / 2).toFixed(0)} ticks`}
                  sub="IQR width / 2"
                />
              </SectionCard>
            )}

            {/* ── RRR ── */}
            {consensus.rrr && (
              <SectionCard title="Risk:Reward Ratio" icon={Target} accent="rgba(255,159,10,0.8)">
                <MetricRow
                  icon={Target} label="Recommended R:R"
                  value={`1:${(consensus.rrr.recommended_rr || 2).toFixed(1)}`}
                  color="#FF9F0A"
                />
                <MetricRow
                  icon={Target} label="Expected Win Rate"
                  value={`${((consensus.rrr.expected_win_rate || 0.5) * 100).toFixed(0)}%`}
                />
                <MetricRow
                  icon={Target} label="Profit Factor"
                  value={(consensus.rrr.profit_factor || 1).toFixed(2)}
                />
                <MetricRow
                  icon={Target} label="Confidence"
                  value={`${((consensus.rrr.confidence || 0) * 100).toFixed(0)}%`}
                  sub={`Based on ${consensus.rrr.sample_size || 0} trades`}
                />
                {consensus.rrr.why_this_rr && (
                  <div style={{
                    marginTop: 8, padding: '8px 10px', borderRadius: 8,
                    background: 'rgba(255,159,10,0.06)',
                    border: '1px solid rgba(255,159,10,0.15)',
                    fontSize: 10.5, color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}>
                    {consensus.rrr.why_this_rr}
                  </div>
                )}
              </SectionCard>
            )}

            {/* ── Exit Strategy ── */}
            {consensus.exit_plan && (
              <SectionCard title="Exit Strategy (ML)" icon={Shield} accent="rgba(124,58,237,0.8)">
                <MetricRow
                  icon={Shield} label="Strategy"
                  value={consensus.exit_plan.strategy || 'ML-DETERMINED'}
                  color="rgba(124,58,237,0.9)"
                />
                <MetricRow
                  icon={Shield} label="Stop Loss"
                  value={`${consensus.exit_plan.stop_loss_ticks || 20} ticks`}
                />
                <MetricRow
                  icon={Shield} label="TP1 — Close"
                  value={`${((consensus.exit_plan.tp1_pct || 0) * 100).toFixed(0)}% @ ${consensus.exit_plan.tp1_ticks || 0}t`}
                />
                <MetricRow
                  icon={Shield} label="TP2 — Close"
                  value={`${((consensus.exit_plan.tp2_pct || 0) * 100).toFixed(0)}% @ ${consensus.exit_plan.tp2_ticks || 0}t`}
                />
                <MetricRow
                  icon={Shield} label="Trailing Distance"
                  value={`${consensus.exit_plan.trailing_distance_ticks || 0} ticks`}
                  sub={`activate at ${consensus.exit_plan.trail_activate_at_ticks || 0}t in profit`}
                />
                <MetricRow
                  icon={Clock} label="Max Hold"
                  value={`${consensus.exit_plan.max_hold_minutes || 60} min`}
                />
              </SectionCard>
            )}

            {/* ── Position Sizing ── */}
            {consensus.position_sizing && (
              <SectionCard title="Position Sizing" icon={DollarSign} accent="rgba(48,209,88,0.8)">
                <MetricRow
                  icon={DollarSign} label="Contracts"
                  value={consensus.position_sizing.contracts || 1}
                  color="#30D158"
                />
                <MetricRow
                  icon={DollarSign} label="Risk / Trade"
                  value={`$${(consensus.position_sizing.risk_per_trade_dollars || 0).toFixed(0)}`}
                  sub={`${((consensus.position_sizing.risk_pct_of_account || 0) * 100).toFixed(2)}% of account`}
                />
                <MetricRow
                  icon={DollarSign} label="Kelly Fraction"
                  value={`${((consensus.position_sizing.kelly_fraction || 0) * 100).toFixed(0)}%`}
                  sub="Half-Kelly applied"
                />
                <MetricRow
                  icon={Clock} label="Max Wait"
                  value={`${consensus.position_sizing.max_wait_minutes || 30} min`}
                  sub={consensus.position_sizing.drawdown_throttled ? 'Drawdown throttle: SIZE HALVED' : 'Normal sizing'}
                  color={consensus.position_sizing.drawdown_throttled ? '#FF453A' : undefined}
                />
              </SectionCard>
            )}

            {/* ── Timing ── */}
            {consensus.timing && (
              <SectionCard title="Entry Timing" icon={Clock} accent="rgba(10,132,255,0.8)">
                <MetricRow
                  icon={Clock} label="Enter Now"
                  value={consensus.timing.enter_now ? 'YES' : 'WAIT'}
                  color={consensus.timing.enter_now ? '#30D158' : '#FF453A'}
                />
                <MetricRow
                  icon={Activity} label="P(Profitable Now)"
                  value={`${((consensus.timing.P_profitable_entry_now || 0.5) * 100).toFixed(0)}%`}
                />
                <MetricRow
                  icon={Award} label="Best Window"
                  value={consensus.timing.best_entry_window || '—'}
                />
                {consensus.timing.candle_close_entry !== false && (
                  <MetricRow
                    icon={Clock} label="Wait for Candle Close"
                    value="ALWAYS"
                    sub="Never enter mid-candle"
                    muted
                  />
                )}
              </SectionCard>
            )}

            {/* ── Model Votes ── */}
            {consensus.votes && Object.keys(consensus.votes).length > 0 && (
              <SectionCard title={`Model Votes (${Object.keys(consensus.votes).length})`} icon={BarChart2} accent="rgba(255,255,255,0.4)">
                {Object.entries(consensus.votes).map(([name, vote]) => (
                  <VoteItem
                    key={name}
                    name={name}
                    signal={vote.signal}
                    confidence={vote.confidence}
                    reason={vote.reason}
                  />
                ))}
              </SectionCard>
            )}

            {/* ── News Warning ── */}
            {consensus.news && (
              <SectionCard title="News & Events" icon={Activity} accent="rgba(255,69,58,0.8)">
                <MetricRow
                  icon={Activity} label="Next Event"
                  value={consensus.news.next_event?.title || '—'}
                  sub={consensus.news.next_event ? `in ${consensus.news.next_event.timeUntil_min || 0} min` : ''}
                  color={consensus.news.trade_allowed === false ? '#FF453A' : undefined}
                />
                <MetricRow
                  icon={Activity} label="Trading Allowed"
                  value={consensus.news.trade_allowed !== false ? 'YES' : 'REDUCE SIZE'}
                  color={consensus.news.trade_allowed !== false ? '#30D158' : '#FF453A'}
                />
                {consensus.news.warning && (
                  <div style={{
                    marginTop: 8, padding: '8px 10px', borderRadius: 8,
                    background: 'rgba(255,69,58,0.06)',
                    border: '1px solid rgba(255,69,58,0.2)',
                    fontSize: 10.5, color: '#FF453A', lineHeight: 1.5,
                  }}>
                    {consensus.news.warning}
                  </div>
                )}
              </SectionCard>
            )}

            {/* ── Footer ── */}
            <div style={{
              textAlign: 'center', paddingTop: 8,
              fontSize: 9.5, color: 'var(--text-tertiary)', letterSpacing: 0.5,
            }}>
              ML Engine {consensus?.ok !== false ? 'online' : 'offline'} &nbsp;·&nbsp;
              v{consensus?.model_freshness || '?'} &nbsp;·&nbsp;
              {consensus?.models_used || 0} models &nbsp;·&nbsp;
              {consensus?.data_trades_analyzed || 0} trades
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

function WarRoomLoader() {
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
              ? 'var(--aura-status-success, rgba(48,209,88,0.06))'
              : isActive
                ? 'var(--aura-status-info, rgba(10,132,255,0.06))'
                : 'transparent',
            border: `1px solid ${isDone ? 'var(--aura-status-success, rgba(48,209,88,0.15))' : isActive ? 'var(--aura-status-info, rgba(10,132,255,0.15))' : AURA_COLORS.borderSubtle}`,
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

            {/* Label */}
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

      {/* Spinner */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginTop: 16,
      }}>
        <div style={{
          width: 24,
          height: 24,
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
}

import { useUsers } from '../hooks/useUsers';

export default function CollectiveConsciousness({ onBack, theme, auth, currentTheme, onThemeChange, aiStatuses = [] }) {
  const normalizedTheme = currentTheme || theme || "lumiere";
  const isDark = normalizedTheme === "midnight" || normalizedTheme === "night";
  const { users } = useUsers();
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'ml'
  const [messages, setMessages] = useState([]);
  const [localHistory, setLocalHistory] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const engineMode = (() => {
    const h = getISTState().h;
    return (h >= 8 && h < 17) ? 'fast' : 'full';
  })();
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const userData = auth?.uid ? users[auth.uid] : null;
  const isFastMode = engineMode === 'fast';
  const normalizedEngineStatuses = Array.isArray(aiStatuses) ? aiStatuses : [];
  const configuredEngineCount = normalizedEngineStatuses.filter(
    (engine) => engine?.configured || engine?.status === "online" || engine?.status === "offline",
  ).length;
  const onlineEngineCount = normalizedEngineStatuses.filter(
    (engine) => engine?.status === "online" || engine?.online,
  ).length;
  const engineModeLabel =
    configuredEngineCount === 0
      ? 'Council offline — contact your administrator'
      : isFastMode
        ? `Quick Mode — ${onlineEngineCount} AI ${onlineEngineCount === 1 ? 'engine' : 'engines'} active (8AM-5PM IST)`
        : `Full Consensus — All ${onlineEngineCount} engines deployed (5PM-8AM IST)`;

  const bgColor = "var(--surface-elevated, #FFFFFF)";
  const textColor = "var(--text-primary, #111827)";
  const mutedColor = "var(--text-secondary, #9CA3AF)";
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
        padding: '10px 20px',
        borderBottom: `1px solid ${AURA_COLORS.borderSubtle}`,
        flexShrink: 0,
        gap: 12,
      }}>
        <button
          onClick={onBack}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-glow, rgba(59, 130, 246, 0.2))'; e.currentTarget.style.transform = 'scale(1.02)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-glow, rgba(59, 130, 246, 0.1))'; e.currentTarget.style.transform = 'scale(1)'; }}
          style={{
            background: 'var(--accent-glow, rgba(59, 130, 246, 0.1))',
            border: `1px solid ${AURA_COLORS.info}`,
            color: AURA_COLORS.info,
            fontSize: 14,
            fontWeight: 600,
            padding: '7px 14px',
            borderRadius: 8,
            transition: 'all 0.2s',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16 }}>←</span> Back
        </button>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          gap: 4,
          background: 'var(--surface-glass, rgba(255,255,255,0.05))',
          border: `1px solid ${AURA_COLORS.borderSubtle}`,
          borderRadius: 10,
          padding: 3,
          flexShrink: 0,
        }}>
          {[
            { key: 'chat', label: 'AI Chat', Icon: Brain },
            { key: 'ml', label: 'ML Signals', Icon: Activity },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px',
                borderRadius: 7,
                border: 'none',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.5,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: activeTab === key
                  ? (key === 'ml' ? 'rgba(10,132,255,0.15)' : 'var(--accent-glow, rgba(10,132,255,0.1))')
                  : 'transparent',
                color: activeTab === key ? AURA_COLORS.info : 'var(--text-tertiary)',
                fontFamily: 'inherit',
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Theme Switcher + Status */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
          <ThemeSwitcher
            currentTheme={normalizedTheme}
            onThemeChange={onThemeChange}
          />
          <AiEnginesStatus statuses={normalizedEngineStatuses} />
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'ml' ? (
        <MlConsensusTab theme={theme} normalizedTheme={normalizedTheme} />
      ) : (
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
              <div style={{ opacity: 0.3, color: AURA_COLORS.manipulation, display: "flex", alignItems: "center", justifyContent: "center" }}><Brain size={48} /></div>
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
                      background: 'var(--surface-glass, rgba(255,255,255,0.05))',
                      border: `1px solid ${AURA_COLORS.borderSubtle}`,
                      borderRadius: 20,
                      padding: '8px 16px',
                      fontSize: 12,
                      color: mutedColor,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = AURA_COLORS.info; e.currentTarget.style.color = AURA_COLORS.info; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = AURA_COLORS.borderSubtle; e.currentTarget.style.color = mutedColor; }}
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
                color: msg.role === 'user' ? AURA_COLORS.info : AURA_COLORS.manipulation,
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
                  ? 'var(--accent-glow, rgba(10,132,255,0.08))'
                  : 'transparent',
                border: msg.role === 'user' ? `1px solid ${AURA_COLORS.info}` : 'none',
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
                border: '2.5px solid var(--border-subtle, rgba(255,200,0,0.15))',
                borderTopColor: AURA_COLORS.warning,
                borderRadius: '50%',
                animation: 'cc-spin 0.6s linear infinite',
              }} />
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 2,
                color: AURA_COLORS.warning,
                textTransform: 'uppercase',
              }}>
                Groq Tactical Processing...
              </span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>
      )}  {/* closes ternary: : ( <div>...chat...</div> ) */}
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
              onFocus={e => e.currentTarget.style.borderColor = AURA_COLORS.info}
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
                background: (isProcessing || !input.trim()) ? 'var(--surface-glass, rgba(255,255,255,0.06))' : AURA_COLORS.info,
                color: (isProcessing || !input.trim()) ? mutedColor : 'var(--accent-text, #FFFFFF)',
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
          color: isDark ? 'var(--text-tertiary, #3A3A3C)' : AURA_COLORS.mutedSoft,
          letterSpacing: 0.5,
        }}>
          Powered by Multi-Model AI Consensus
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
            ? 'var(--aura-status-warning, rgba(245,158,11,0.08))'
            : 'var(--aura-amd-manipulation, rgba(124,58,237,0.08))',
          border: `1px solid ${isFastMode ? AURA_COLORS.warning : AURA_COLORS.manipulation}`,
          color: isFastMode ? AURA_COLORS.warning : AURA_COLORS.manipulation,
          animation: isFastMode ? 'cc-fast-pulse 2s ease-in-out infinite' : 'cc-full-glow 3s ease-in-out infinite',
        }}>
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

    </div>
  );
}
