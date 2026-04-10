/**
 * PhysicsRegimeSection — FP-FK, Tsallis q, Hurst H, Criticality display
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React from 'react';
import { Gauge, AlertTriangle } from 'lucide-react';
import { SectionCard } from './SectionCard.jsx';
import { REGIME_COLORS } from './RegimeBadge.jsx';

export const PhysicsRegimeSection = React.memo(function PhysicsRegimeSection({ regime }) {
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
});
