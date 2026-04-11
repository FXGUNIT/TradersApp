/**
 * MlConsensusTab — ML Consensus container (owns all state + fetching)
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React, { useState, useCallback, useEffect } from 'react';
import BreakingNewsPanel from '../../components/BreakingNewsPanel.jsx';
import { Activity, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { fetchConsensus } from './consensusGateway.js';
import { SIGNAL_COLOR_MAP } from './SignalBadge.jsx';
import { SignalBadge } from './SignalBadge.jsx';
import { SessionProbabilityPanel } from './SessionProbabilityPanel.jsx';
import { PhysicsRegimeSection } from './PhysicsRegimeSection.jsx';
import { AlphaDisplay } from './AlphaDisplay.jsx';
import { ExpectedMovePanel } from './ExpectedMovePanel.jsx';
import { RRRRecommendation } from './RRRRecommendation.jsx';
import { ExitStrategyPanel } from './ExitStrategyPanel.jsx';
import { PositionSizingPanel } from './PositionSizingPanel.jsx';
import { TimingRecommendation } from './TimingRecommendation.jsx';
import { ModelVotesPanel } from './ModelVotesPanel.jsx';
import { NewsCountdown } from './NewsCountdown.jsx';
import { TradeReturnCalculator } from '../tradeReturnCalculator/TradeReturnCalculator.jsx';

const AURA_COLORS = {
  info: 'var(--aura-status-info, #0A84FF)',
  success: 'var(--aura-status-success, #30D158)',
  borderSubtle: 'var(--border-subtle, rgba(255,255,255,0.06))',
};

export const MlConsensusTab = React.memo(function MlConsensusTab({ theme: _theme, normalizedTheme: _normalizedTheme }) {
  const [consensus, setConsensus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const doFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConsensus({ session: 1 });
      setConsensus(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || 'Failed to reach ML Engine');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    doFetch();
    const interval = setInterval(doFetch, 60_000);
    return () => clearInterval(interval);
  }, [doFetch]);

  const signal = consensus?.signal || 'NEUTRAL';
  const confidence = consensus?.confidence;
  const session = consensus?.session || { id: 1, name: 'Main Trading', session_pct: 0, minutes_into_session: 0 };
  const sc = SIGNAL_COLOR_MAP[signal];

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
            onClick={doFetch}
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
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '40px 20px', gap: 12, textAlign: 'center',
          }}>
            <XCircle size={32} color="#FF453A" />
            <div style={{ fontSize: 13, fontWeight: 600, color: '#FF453A' }}>ML Engine Offline</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{error}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 400, lineHeight: 1.6 }}>
              Start the ML Engine with: <code style={{ fontSize: 10 }}>cd ml-engine && python -m uvicorn main:app --port 8001</code>
            </div>
            <button
              onClick={doFetch}
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

        {/* Breaking News */}
        <BreakingNewsPanel mathEngine={consensus?.feature_vector} />

        {consensus && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Hero Signal Card */}
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
                Confidence: {(confidence * 100 || 0).toFixed(1)}% &nbsp;·&nbsp;
                {consensus.models_used || 0} models &nbsp;·&nbsp;
                {consensus.data_trades_analyzed || 0} trades analyzed
              </div>
            </div>

            {/* Session */}
            <SessionProbabilityPanel session={session} />

            {/* Physics Regime */}
            {consensus.regime && !consensus.regime.error && (
              <PhysicsRegimeSection regime={consensus.regime} />
            )}

            {/* Alpha */}
            <AlphaDisplay alpha={consensus.alpha} />

            {/* Expected Move */}
            <ExpectedMovePanel expected_move={consensus.expected_move} />

            {/* RRR */}
            <RRRRecommendation rrr={consensus.rrr} />

            {/* Exit Strategy */}
            <ExitStrategyPanel exit_plan={consensus.exit_plan} />

            {/* Position Sizing */}
            <PositionSizingPanel position_sizing={consensus.position_sizing} />

            {/* Timing */}
            <TimingRecommendation timing={consensus.timing} />

            {/* Model Votes */}
            <ModelVotesPanel votes={consensus.votes} />

            {/* News */}
            <NewsCountdown consensus={consensus} />

            {/* Trade Return Calculator */}
            <TradeReturnCalculator consensus={consensus} />

            {/* Footer */}
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
});
