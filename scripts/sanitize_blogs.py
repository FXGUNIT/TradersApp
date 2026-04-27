#!/usr/bin/env python3
"""Sanitize blog files — remove specific model names, counts, and architecture details."""

content = open('public/blog/architecture/index.html', 'r', encoding='utf-8').read()

# Meta tags
content = content.replace(
    '<meta name="description" content="12 AI models voting on every decision. A Watchtower that self-corrects. A Board Room that governs every signal. Complete architecture of Traders Regiment — the world\'s most advanced Trading AI — and why every technical decision was made the way it was." />',
    '<meta name="description" content="Multi-model consensus, self-correcting intelligence, and institutional governance. Complete architecture of Traders Regiment — the world\'s most advanced Trading AI — and why every technical decision was made the way it was." />'
)
content = content.replace(
    '<meta name="keywords" content="trading AI architecture, self-improving AI system, multi-model consensus engine, quant trading system design, machine learning trading platform, Watchtower self-correction, Board Room governance AI, deliberative AI trading, regime detection HMM, self-training quant system, python trading AI, React trading UI" />',
    '<meta name="keywords" content="trading AI architecture, self-improving AI system, multi-model consensus engine, quant trading system design, machine learning trading platform, governance AI, deliberative AI trading, regime detection, self-training quant system, python trading AI, React trading UI" />'
)
content = content.replace(
    '<meta property="og:description" content="12 AI models voting on every decision. A Watchtower that self-corrects. A Board Room that governs every signal. Complete architecture of Traders Regiment." />',
    '<meta property="og:description" content="Multi-model consensus. Self-correcting intelligence. Institutional governance. Complete architecture of Traders Regiment." />'
)

# Subtitle
content = content.replace(
    '12 AI models voting on every decision. A Watchtower that self-corrects. A Board Room that governs every signal.',
    'Multiple AI models voting on every decision. A Guardian that self-corrects. A Governance Board that oversees every signal.'
)

# System diagram
content = content.replace(
    '<span class="highlight">DVC + MLflow (model versioning)</span>',
    '<span class="highlight">Model versioning and tracking</span>'
)

# BFF layer
content = content.replace(
    'all 12 models are queried simultaneously',
    'all models are queried simultaneously'
)

# ML Engine description
content = content.replace(
    'Every endpoint has a 5-second timeout and a circuit breaker.',
    'Every endpoint has timeout and circuit breaker protection.'
)
content = content.replace(
    'All responses follow a strict <code>BaseResponse</code> contract with <code>ok</code>, <code>error</code>, <code>latency_ms</code>, and <code>timestamp</code>.',
    'All responses follow a strict contract with explicit success/error shapes and timestamps.'
)

# Stack table model names
content = content.replace('<code>PyTorch Mamba</code>', '<code>sequence models</code>')
content = content.replace('<code>HMM</code>', 'hidden Markov models')

# Headings
content = content.replace('<h2>The 5-Phase Recursive Consensus Engine</h2>', '<h2>The Consensus Engine</h2>')
content = content.replace('five phases', 'multiple phases')

# Phase diagram
content = content.replace(
    '<span class="highlight">[PHASE 2]</span> 12 Models Analyze Concurrently<br/>',
    '<span class="highlight">[PHASE 2]</span> Multiple Models Analyze Concurrently<br/>'
)

# The 12 Models section
old_models = '''<h3>The 12 Models</h3>

    <p>Each model is an independent analytical agent with its own specialty. They don't know about each other — they just produce their output. The ensemble aggregator collects all votes and converges on a consensus:</p>

    <ul>
      <li><strong>DirectionModel</strong> — bull/bear/neutral classification with confidence scores</li>
      <li><strong>MagnitudeModel</strong> — predicted size of move, not just direction</li>
      <li><strong>RegimeModel_HMM</strong> — Hidden Markov Model for regime classification</li>
      <li><strong>RegimeModel_FPFK</strong> — Fractal and power-law regime detection</li>
      <li><strong>RegimeModel_Anomalous</strong> — Anomalous diffusion detection for crisis identification</li>
      <li><strong>SessionModel</strong> — historical session probability distributions</li>
      <li><strong>AlphaModel</strong> — non-obvious edge from cross-model disagreement</li>
      <li><strong>OptionsModel</strong> — IV regime, gamma exposure, options flow analysis</li>
      <li><strong>TechCandleModel</strong> — candle pattern recognition with wick noise filtering</li>
      <li><strong>TechIBModel</strong> — trendline and horizontal structure analysis</li>
      <li><strong>MambaSequenceModel</strong> — long-range sequence pattern recognition (PyTorch)</li>
      <li><strong>ExitModel</strong> — stop-loss and target optimization per regime</li>
    </ul>'''

new_models = '''<h3>Model Families</h3>

    <p>Each model family is an independent analytical agent with its own specialty. They don't know about each other — they just produce their output. The ensemble aggregator collects all votes and converges on a consensus:</p>

    <ul>
      <li><strong>Direction models</strong> — bull/bear/neutral classification with confidence scores</li>
      <li><strong>Magnitude models</strong> — predicted size of move, not just direction</li>
      <li><strong>Regime detection</strong> — multiple approaches to market regime classification</li>
      <li><strong>Session probability</strong> — historical session probability distributions</li>
      <li><strong>Alpha detection</strong> — non-obvious edge from cross-model disagreement</li>
      <li><strong>Options flow analysis</strong> — implied volatility regime and premium health</li>
      <li><strong>Technical analysis</strong> — candle patterns and structure analysis</li>
      <li><strong>Exit optimization</strong> — stop-loss and target levels per regime</li>
    </ul>'''

content = content.replace(old_models, new_models)

# Recursive deliberation
content = content.replace(
    'All 12 models vote. Ensemble aggregates.',
    'All models vote. Ensemble aggregates.'
)

# Board Room -> Governance Board
content = content.replace('<h2>The Deliberative Board Room</h2>', '<h2>The Governance Board</h2>')
content = content.replace(
    'The Board Room is our governance layer.',
    'The Governance Board is our oversight layer.'
)
content = content.replace('<td>Tech_IB</td>', '<td>StructureAgent</td>')
content = content.replace('<td>Tech_Candle</td>', '<td>PatternAgent</td>')
content = content.replace('<td>RegimeWatcher</td>', '<td>RegimeAgent</td>')
content = content.replace('<td>OptionsDesk</td>', '<td>FlowAgent</td>')
content = content.replace('<td>RiskOfficer</td>', '<td>RiskAgent</td>')
content = content.replace(
    'from RiskOfficer, RegimeWatcher, or OptionsDesk',
    'from RiskAgent, RegimeAgent, or FlowAgent'
)
content = content.replace('RiskOfficer always has the final word.', 'RiskAgent always has the final word.')

# Veto conditions - remove code, keep concept
content = content.replace(
    '<li><code>regime == "CRISIS"</code> or <code>"CONTAGION"</code> → <strong>RegimeWatcher vetoes</strong></li>',
    '<li>CRISIS or CONTAGION regime detected → <strong>RegimeAgent vetoes</strong></li>'
)
content = content.replace(
    '<li><code>is_expiry_day == True</code> or <code>iv_regime == "LOW"</code> → <strong>OptionsDesk vetoes</strong></li>',
    '<li>Expiry day or low premium environment → <strong>FlowAgent vetoes</strong></li>'
)
content = content.replace(
    '<li><code>losses_today >= 2</code> or <code>positions_open >= 1</code> → <strong>RiskOfficer vetoes</strong></li>',
    '<li>Daily stop hit or max positions open → <strong>RiskAgent vetoes</strong></li>'
)
content = content.replace(
    '<li><code>dead_chop == True</code> (ATR &lt; ATR_avg × 0.5) → <strong>Tech_IB vetoes</strong></li>',
    '<li>Market in dead chop (insufficient volatility) → <strong>StructureAgent vetoes</strong></li>'
)
content = content.replace(
    '<li><code>wick_alone == True</code> (wick signal without close confirmation) → <strong>Tech_Candle vetoes</strong></li>',
    '<li>Wick signal without close confirmation → <strong>PatternAgent vetoes</strong></li>'
)
content = content.replace(
    'The Board Room cannot be overridden by any other component. RiskOfficer veto is absolute.',
    'The Governance Board cannot be overridden by any other component. RiskAgent veto is absolute.'
)

# Watchtower -> Guardian
content = content.replace(
    '<h2>Watchtower — The Self-Correcting Guardian</h2>',
    '<h2>The Guardian System — Self-Correcting Intelligence</h2>'
)
content = content.replace(
    '<p>Watchtower is our performance monitoring and self-correction layer.',
    '<p>The Guardian System is our performance monitoring and self-correction layer.'
)
content = content.replace('Watchtower compares each model', 'the Guardian compares each model')
content = content.replace(
    'if the regime classifier changes state more than 3 times in one hour,',
    'if the regime classifier changes state frequently,'
)
content = content.replace(
    'if the overall ensemble win rate drops below the paper-trade threshold, Watchtower sends',
    'if the overall ensemble performance drops, the Guardian sends'
)
content = content.replace('Watchtower is the reason', 'The Guardian is the reason')
content = content.replace('Watchtower Detects Drift', 'Guardian Detects Drift')
content = content.replace('Trigger EWC Recalibration Pipeline<br/>', 'Trigger Recalibration Pipeline<br/>')

# EWC section
content = content.replace(
    'Traders Regiment uses <strong>Elastic Weight Consolidation (EWC)</strong> — a technique that allows the AI to learn new market patterns without catastrophically forgetting the patterns it already knows.',
    'Traders Regiment uses <strong>continual learning techniques</strong> that allow the AI to learn new market patterns without forgetting the patterns it already knows.'
)
content = content.replace('Optuna-based tuning', 'adaptive hyperparameter optimization')
content = content.replace(
    '<li><strong>MLflow Tracking</strong> — every training run is logged with parameters, metrics, SHAP values, and model artifacts logged automatically.</li>',
    '<li><strong>Training tracking</strong> — every training run is logged with parameters, metrics, and model artifacts.</li>'
)
content = content.replace(
    '<li><strong>DVC (Data Version Control)</strong> — every dataset tracked alongside code. <code>dvc repro</code> recomputes the full pipeline. <code>dvc push/pull</code> syncs models and data to/from remote storage.</li>',
    '<li><strong>Data versioning</strong> — every dataset and model tracked alongside code, with full pipeline reproducibility.</li>'
)
content = content.replace(
    '<li><strong>MinIO (S3-compatible)</strong> — model artifact store. Production models promoted from Staging after paper trade review.</li>',
    '<li><strong>Model registry</strong> — trained models are promoted through stages after validation.</li>'
)

# Pipeline ahead
content = content.replace('<strong>Watchtower Auto-Recalibration</strong>', '<strong>Guardian Auto-Recalibration</strong>')
content = content.replace(
    '<li><strong>Redis Caching</strong> — adding Redis for sub-millisecond consensus caching. Regime cache TTL 300s. Consensus cache TTL 60s.</li>',
    '<li><strong>High-speed caching</strong> — fast consensus result caching for low-latency responses.</li>'
)
content = content.replace('<strong>Watchtower Self-Correction</strong>', '<strong>Guardian Self-Correction</strong>')

# CTA box
content = content.replace(
    '12 models. Board Room governance. Watchtower self-correction.',
    'Multi-model consensus. Governance oversight. Self-correcting intelligence.'
)

open('public/blog/architecture/index.html', 'w', encoding='utf-8').write(content)
print('Architecture blog sanitized')

# Verify
import re
content2 = open('public/blog/architecture/index.html', 'r', encoding='utf-8').read()
sensitive = ['LightGBM', 'HMM', 'Mamba', 'PyTorch', 'HMMlearn', 'XGBoost',
              '200ms', '5s timeout', 'Redis', 'MLflow', 'MinIO',
              'BaseResponse', 'Promise.all', 'Elastic Weight', 'EWC',
              'Board Room', 'Watchtower', 'RiskOfficer',
              'RegimeWatcher', 'OptionsDesk', 'Tech_IB', 'Tech_Candle',
              'DirectionModel', 'MagnitudeModel', 'RegimeModel', 'MambaSequence',
              '12 Models', '12 models', '12+']
found = [t for t in sensitive if re.search(re.escape(t), content2)]
if found:
    print(f'STILL FOUND: {found}')
else:
    print('All sensitive terms removed from architecture blog')
