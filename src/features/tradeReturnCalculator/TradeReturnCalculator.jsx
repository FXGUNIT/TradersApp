/**
 * TradeReturnCalculator — Monte Carlo trade return simulator
 * Renders below NewsCountdown in MlConsensusTab.
 * Fetches from BFF /trade-calc/simulate; falls back to client-side math.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Calculator, TrendingUp, TrendingDown, AlertTriangle, ChevronDown } from 'lucide-react';
import { SectionCard } from '../consensus/SectionCard.jsx';
import { hasBff } from '../../services/gateways/base.js';
import {
  kelly,
  tradePnL,
  simulateEquityCurve,
} from './calculatorUtils.js';

const BFF_BASE = import.meta.env.VITE_BFF_URL || "http://127.0.0.1:8788";
const MAX_CLIENT_TRADES = 10_000;

function formatCurrency(v) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
}
function formatPct(v) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}
function formatNum(v) {
  return new Intl.NumberFormat('en-US').format(Math.round(v));
}

/** Draw a Canvas 2D equity curve */
function drawEquityCurve(canvas, equityCurve, startBalance) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const n = equityCurve.length;
  if (n < 2) return;

  const min = Math.min(...equityCurve);
  const max = Math.max(...equityCurve);
  const range = max - min || 1;

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (i / 4) * H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Shaded area under curve
  const pad = 4;
  ctx.beginPath();
  ctx.moveTo(pad, H - pad);
  for (let i = 0; i < n; i++) {
    const x = pad + (i / (n - 1)) * (W - pad * 2);
    const y = H - pad - ((equityCurve[i] - min) / range) * (H - pad * 2);
    if (i === 0) ctx.lineTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(pad + (W - pad * 2), H - pad);
  ctx.closePath();

  const last = equityCurve[n - 1];
  const isUp = last >= startBalance;
  ctx.fillStyle = isUp ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)';
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = isUp ? '#30D158' : '#FF453A';
  ctx.lineWidth = 1.5;
  ctx.moveTo(pad, H - pad - ((equityCurve[0] - min) / range) * (H - pad * 2));
  for (let i = 1; i < n; i++) {
    const x = pad + (i / (n - 1)) * (W - pad * 2);
    const y = H - pad - ((equityCurve[i] - min) / range) * (H - pad * 2);
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Start balance reference line
  const startY = H - pad - ((startBalance - min) / range) * (H - pad * 2);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, startY);
  ctx.lineTo(W - pad, startY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Labels
  ctx.font = '9px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText(`Start ${formatCurrency(startBalance)}`, pad, startY - 3);
  ctx.fillStyle = isUp ? '#30D158' : '#FF453A';
  ctx.fillText(`End ${formatCurrency(last)}`, pad, H - pad - 3);
}

/** Pre-filled from consensus RRR if available */
function defaultInputs(consensus) {
  const rr = consensus?.rrr?.recommended_rr ?? 2.0;
  const winRate = consensus?.rrr?.expected_win_rate ?? 0.5;
  return { balance: 25_000, nTrades: 100, riskPct: 0.01, rr, winRate };
}

export const TradeReturnCalculator = React.memo(function TradeReturnCalculator({ consensus }) {
  const defaults = defaultInputs(consensus);
  const [open, setOpen] = useState(false);
  const [inputs, setInputs] = useState(defaults);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [usingBff, setUsingBff] = useState(false);
  const canvasRef = useRef(null);

  const runSim = useCallback(async (overrides = {}) => {
    const params = { ...inputs, ...overrides };
    setLoading(true);
    setError(null);
    try {
      let data;
      // ── Client-side first (default — zero rate limit, instant) ──────────
      const n = Math.min(params.nTrades, MAX_CLIENT_TRADES);
      data = simulateEquityCurve({ ...params, nTrades: n });
      data.latency_ms = 0;
      setUsingBff(false);

      // ── BFF only for large-batch runs that exceed client cap ────────────
      if (params.nTrades > MAX_CLIENT_TRADES && hasBff()) {
        setLoading(true); // still show loading while BFF runs
        const res = await fetch(`${BFF_BASE}/trade-calc/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            balance: params.balance,
            nTrades: params.nTrades,
            riskPct: params.riskPct,
            rr: params.rr,
            winRate: params.winRate,
          }),
          signal: AbortSignal.timeout(30_000),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Simulation failed');
        data = json;
        setUsingBff(true);
      }

      setResult(data);
    } catch (err) {
      setError(err.message || 'Simulation failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [inputs]);

  // Draw chart whenever result changes
  useEffect(() => {
    if (!result || !canvasRef.current) return;
    const canvas = canvasRef.current;
    // Responsive: match container width
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth || 360;
      canvas.height = 120;
    }
    drawEquityCurve(canvas, result.equityCurve, inputs.balance);
  }, [result, inputs.balance]);

  const handleChange = (key, raw) => {
    const val = parseFloat(raw);
    if (isNaN(val)) return;
    setInputs(prev => ({ ...prev, [key]: val }));
  };

  const k = kelly(inputs.winRate, inputs.rr);
  const pnl = tradePnL(inputs.balance, inputs.riskPct, inputs.rr);

  const inputRow = (label, key, step, min, max) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={inputs[key]}
        onChange={e => handleChange(key, e.target.value)}
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          color: 'var(--text-primary)',
          fontSize: 13,
          fontWeight: 600,
          padding: '5px 8px',
          width: '100%',
          outline: 'none',
        }}
      />
    </label>
  );

  return (
    <SectionCard title="Trade Return Calculator" icon={Calculator} accent="rgba(48,209,88,0.7)">
      {/* Collapse toggle */}
      <button
        onClick={() => { setOpen(v => !v); if (!open && !result) runSim(); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-primary)', padding: '2px 0',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {usingBff
            ? `BFF batch sim · ${formatNum(inputs.nTrades)} trades`
            : `Client-side · ${formatNum(Math.min(inputs.nTrades, MAX_CLIENT_TRADES))} trades${inputs.nTrades > MAX_CLIENT_TRADES ? ` (${formatNum(inputs.nTrades)} via BFF)` : ''}`
          }
        </span>
        <ChevronDown
          size={14}
          color="var(--text-secondary)"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>

      {open && (
        <>
          {/* Kelly info strip */}
          <div style={{
            display: 'flex', gap: 12, flexWrap: 'wrap',
            padding: '8px 10px', borderRadius: 8, marginBottom: 10,
            background: 'rgba(48,209,88,0.06)',
            border: '1px solid rgba(48,209,88,0.15)',
            fontSize: 10.5, color: 'var(--text-secondary)',
          }}>
            <span>Kelly: <strong style={{ color: '#30D158' }}>{k > 0 ? `${(k * 100).toFixed(1)}%` : 'N/A'}</strong></span>
            <span>Risk/trade: <strong>{formatCurrency(inputs.balance * inputs.riskPct)}</strong></span>
            <span>Win: <strong style={{ color: '#30D158' }}>{formatCurrency(pnl.win)}</strong></span>
            <span>Loss: <strong style={{ color: '#FF453A' }}>{formatCurrency(pnl.loss)}</strong></span>
          </div>

          {/* Input grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: 8, marginBottom: 10,
          }}>
            {inputRow('Balance ($)', 'balance', 100, 1, 100_000_000)}
            {inputRow('Trades', 'nTrades', 1, 1, 100_000)}
            {inputRow('Risk %', 'riskPct', 0.001, 0.001, 1)}
            {inputRow('R:R Ratio', 'rr', 0.1, 0.1, 50)}
            {inputRow('Win Rate', 'winRate', 0.01, 0, 1)}
          </div>

          {/* Run button */}
          <button
            onClick={() => runSim()}
            disabled={loading}
            style={{
              width: '100%', padding: '8px', borderRadius: 8,
              background: loading ? 'rgba(48,209,88,0.3)' : 'rgba(48,209,88,0.15)',
              border: '1px solid rgba(48,209,88,0.4)',
              color: loading ? 'rgba(255,255,255,0.5)' : '#30D158',
              fontSize: 12, fontWeight: 700, letterSpacing: 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: 10, transition: 'all 0.15s',
            }}
          >
            {loading ? 'Simulating…' : '▶  Run Monte Carlo Sim'}
          </button>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 10px', borderRadius: 8, marginBottom: 8,
              background: 'rgba(255,69,58,0.08)',
              border: '1px solid rgba(255,69,58,0.25)',
              fontSize: 11, color: '#FF453A',
            }}>
              <AlertTriangle size={12} />
              {error}
            </div>
          )}

          {result && (
            <>
              {/* Equity curve */}
              <div style={{
                borderRadius: 8, overflow: 'hidden',
                border: '1px solid var(--border-subtle)', marginBottom: 10,
              }}>
                <canvas
                  ref={canvasRef}
                  style={{ display: 'block', width: '100%', height: 120 }}
                />
              </div>

              {/* Output metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { label: 'End Balance', value: formatCurrency(result.endBalance), color: result.endBalance >= inputs.balance ? '#30D158' : '#FF453A' },
                  { label: 'ROI', value: formatPct(result.roi), color: result.roi >= 0 ? '#30D158' : '#FF453A' },
                  { label: 'Max Drawdown $', value: formatCurrency(result.maxDrawdown), color: '#FF9F0A' },
                  { label: 'Max Drawdown %', value: `${result.maxDrawdownPct.toFixed(2)}%`, color: '#FF9F0A' },
                  { label: 'Wins', value: formatNum(result.nWins), color: '#30D158', icon: TrendingUp },
                  { label: 'Losses', value: formatNum(result.nLosses), color: '#FF453A', icon: TrendingDown },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8, padding: '8px 10px',
                  }}>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </SectionCard>
  );
});
