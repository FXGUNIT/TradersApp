-- TradersApp ML Engine — PostgreSQL Schema
-- Migration target: replaces SQLite WAL schema
-- Notes for migration from SQLite:
--   - INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY (or BIGSERIAL for large tables)
--   - datetime('now') → NOW() at application level
--   - INSERT OR IGNORE → ON CONFLICT DO NOTHING
--   - f-string ORDER BY {limit} → LIMIT embedded in SQL (safe — validated integer)

-- 5-minute candle data (primary table)
CREATE TABLE IF NOT EXISTS candles_5min (
    id              BIGSERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL,
    symbol          TEXT NOT NULL DEFAULT 'MNQ',
    open            DOUBLE PRECISION NOT NULL,
    high            DOUBLE PRECISION NOT NULL,
    low             DOUBLE PRECISION NOT NULL,
    close           DOUBLE PRECISION NOT NULL,
    volume          BIGINT NOT NULL,
    tick_volume     BIGINT DEFAULT 0,
    session_id      INTEGER NOT NULL DEFAULT 1,
    session_name    TEXT NOT NULL DEFAULT 'main_trading',
    session_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    trade_date_local TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(timestamp, symbol)
);
CREATE INDEX IF NOT EXISTS idx_candles_ts ON candles_5min(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_candles_sess ON candles_5min(session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_candles_session_name ON candles_5min(session_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_candles_sym ON candles_5min(symbol, timestamp DESC);

-- Precomputed session aggregates
CREATE TABLE IF NOT EXISTS session_aggregates (
    id                  BIGSERIAL PRIMARY KEY,
    trade_date          DATE NOT NULL,
    symbol              TEXT DEFAULT 'MNQ',
    session_id          INTEGER NOT NULL,
    session_name        TEXT NOT NULL DEFAULT 'main_trading',
    session_timezone    TEXT NOT NULL DEFAULT 'Asia/Kolkata',

    -- Price
    session_high        DOUBLE PRECISION NOT NULL,
    session_low         DOUBLE PRECISION NOT NULL,
    session_open        DOUBLE PRECISION NOT NULL,
    session_close       DOUBLE PRECISION NOT NULL,
    session_range       DOUBLE PRECISION NOT NULL,

    -- Volume
    total_volume        BIGINT NOT NULL,
    avg_volume          DOUBLE PRECISION NOT NULL,
    volume_ratio        DOUBLE PRECISION NOT NULL,

    -- Volatility
    avg_true_range      DOUBLE PRECISION NOT NULL,
    realized_vol        DOUBLE PRECISION NOT NULL,
    close_to_open       DOUBLE PRECISION NOT NULL,

    -- Direction
    direction           INTEGER NOT NULL,
    gap_pct             DOUBLE PRECISION NOT NULL,

    -- Range quality
    range_vs_atr        DOUBLE PRECISION NOT NULL,
    candle_count        INTEGER NOT NULL,

    UNIQUE(trade_date, symbol, session_id)
);
CREATE INDEX IF NOT EXISTS idx_session_date ON session_aggregates(trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_session_name_date ON session_aggregates(session_name, trade_date DESC);

-- Historical trade log (ML training labels)
CREATE TABLE IF NOT EXISTS trade_log (
    id              BIGSERIAL PRIMARY KEY,
    entry_time      TIMESTAMPTZ NOT NULL,
    exit_time       TIMESTAMPTZ,
    symbol          TEXT DEFAULT 'MNQ',

    -- Entry/Exit
    entry_price     DOUBLE PRECISION NOT NULL,
    exit_price      DOUBLE PRECISION,
    direction       INTEGER NOT NULL,
    session_id      INTEGER NOT NULL,
    session_name    TEXT DEFAULT 'main_trading',
    session_timezone TEXT DEFAULT 'Asia/Kolkata',
    trade_date_local TEXT,

    -- Outcome
    pnl_ticks       DOUBLE PRECISION,
    pnl_dollars     DOUBLE PRECISION,
    result          TEXT,

    -- RRR
    target_rrr      DOUBLE PRECISION NOT NULL,
    actual_rrr      DOUBLE PRECISION,
    rrr_met         INTEGER,

    -- AMD
    amd_phase       TEXT,

    -- Features at entry
    adx_entry       DOUBLE PRECISION,
    atr_entry       DOUBLE PRECISION,
    ci_entry        DOUBLE PRECISION,
    vwap_entry      DOUBLE PRECISION,
    vwap_slope_entry DOUBLE PRECISION,
    vr_entry        DOUBLE PRECISION,
    volatility_regime TEXT,

    -- Expected vs Actual
    expected_move_ticks  DOUBLE PRECISION,
    actual_move_ticks    DOUBLE PRECISION,
    alpha_raw            DOUBLE PRECISION,
    partial_exit_count   INTEGER DEFAULT 0,
    partial_exit_qty     DOUBLE PRECISION,
    partial_exit_pnl_dollars DOUBLE PRECISION,
    remaining_qty        DOUBLE PRECISION,
    exit_legs_json       TEXT,

    -- Holding
    holding_minutes      DOUBLE PRECISION,
    exit_type            TEXT,
    source_uid           TEXT,
    source_role          TEXT,
    days_used            INTEGER,
    source_days_used     INTEGER,
    is_training_eligible BOOLEAN,

    UNIQUE(entry_time, symbol)
);
CREATE INDEX IF NOT EXISTS idx_trade_session ON trade_log(session_id, entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_trade_session_name ON trade_log(session_name, entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_trade_result ON trade_log(result, entry_time DESC);

-- Model metadata
CREATE TABLE IF NOT EXISTS model_registry (
    id              BIGSERIAL PRIMARY KEY,
    model_name      TEXT NOT NULL,
    model_type      TEXT NOT NULL,
    version         TEXT NOT NULL,
    trained_at      TIMESTAMPTZ DEFAULT NOW(),
    data_trades     INTEGER DEFAULT 0,
    data_days       INTEGER DEFAULT 0,
    accuracy        DOUBLE PRECISION,
    roc_auc         DOUBLE PRECISION,
    win_rate        DOUBLE PRECISION,
    expectancy      DOUBLE PRECISION,
    profit_factor   DOUBLE PRECISION,
    sharpe          DOUBLE PRECISION,
    max_drawdown    DOUBLE PRECISION,
    is_active       INTEGER DEFAULT 1,
    file_path       TEXT,
    UNIQUE(model_name)
);
CREATE INDEX IF NOT EXISTS idx_model_active ON model_registry(is_active, model_name);

-- Feature importance snapshots
CREATE TABLE IF NOT EXISTS feature_importance (
    id              BIGSERIAL PRIMARY KEY,
    model_name      TEXT NOT NULL,
    feature         TEXT NOT NULL,
    importance      DOUBLE PRECISION NOT NULL,
    computed_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fi_model ON feature_importance(model_name, computed_at DESC);

-- Training log
CREATE TABLE IF NOT EXISTS training_log (
    id              BIGSERIAL PRIMARY KEY,
    model_name      TEXT NOT NULL,
    train_mode      TEXT NOT NULL,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    rows_used       INTEGER,
    duration_sec    DOUBLE PRECISION,
    status          TEXT DEFAULT 'running',
    error_message   TEXT
);

-- Consensus signal log (for feedback loop)
CREATE TABLE IF NOT EXISTS signal_log (
    id                  BIGSERIAL PRIMARY KEY,
    signal_time         TIMESTAMPTZ NOT NULL,
    symbol              TEXT NOT NULL DEFAULT 'MNQ',
    session_id          INTEGER NOT NULL DEFAULT 1,
    session_name        TEXT NOT NULL DEFAULT 'main_trading',
    session_timezone    TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    trade_date_local    TEXT,

    -- Signal output
    signal              TEXT NOT NULL,
    confidence          DOUBLE PRECISION NOT NULL,

    -- Market context
    regime              TEXT,
    regime_confidence   DOUBLE PRECISION,
    market_regime       TEXT,
    session_phase       TEXT,

    -- Model votes at signal time (JSONB for fast querying)
    votes_json          JSONB,
    consensus_json      JSONB,

    -- Outcome (filled when trade closes)
    matched_trade_id    BIGINT,
    outcome_result      TEXT,
    outcome_correct     INTEGER,

    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signal_time ON signal_log(signal_time DESC);
CREATE INDEX IF NOT EXISTS idx_signal_matched ON signal_log(matched_trade_id);
CREATE INDEX IF NOT EXISTS idx_signal_regime ON signal_log(regime, signal_time DESC);

-- Signal-to-trade outcome mapping
CREATE TABLE IF NOT EXISTS signal_outcome (
    id                  BIGSERIAL PRIMARY KEY,
    signal_id          BIGINT NOT NULL,
    trade_id           BIGINT NOT NULL,
    result             TEXT NOT NULL,
    correct            INTEGER NOT NULL,

    -- PnL at outcome time
    pnl_ticks          DOUBLE PRECISION,
    pnl_dollars        DOUBLE PRECISION,
    actual_move_ticks   DOUBLE PRECISION,
    expected_move_ticks DOUBLE PRECISION,

    recorded_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_so_signal ON signal_outcome(signal_id);
CREATE INDEX IF NOT EXISTS idx_so_trade ON signal_outcome(trade_id);

-- Nightly training eligibility batch snapshots
CREATE TABLE IF NOT EXISTS training_batch_runs (
    id                      BIGSERIAL PRIMARY KEY,
    batch_date              DATE NOT NULL,
    batch_type              TEXT NOT NULL DEFAULT 'nightly_eligibility',
    symbol                  TEXT NOT NULL DEFAULT 'MNQ',
    total_trade_count       INTEGER NOT NULL DEFAULT 0,
    eligible_trade_count    INTEGER NOT NULL DEFAULT 0,
    ineligible_trade_count  INTEGER NOT NULL DEFAULT 0,
    eligible_user_count     INTEGER NOT NULL DEFAULT 0,
    admin_trade_count       INTEGER NOT NULL DEFAULT 0,
    newly_eligible_trade_count INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(batch_date, batch_type, symbol)
);
CREATE INDEX IF NOT EXISTS idx_training_batch_runs_date ON training_batch_runs(batch_date DESC, symbol);

-- Partitioning strategy (for future scale):
-- ALTER TABLE candles_5min PARTITION BY RANGE (timestamp);
-- For now, use BRIN indexes on timestamp columns for efficient time-range scans.
