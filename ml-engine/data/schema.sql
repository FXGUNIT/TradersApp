-- TradersApp ML Engine — SQLite WAL Schema
-- 5-minute candle data (primary table)
CREATE TABLE IF NOT EXISTS candles_5min (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp       TEXT NOT NULL,
    symbol          TEXT NOT NULL DEFAULT 'MNQ',
    open            REAL NOT NULL,
    high            REAL NOT NULL,
    low             REAL NOT NULL,
    close           REAL NOT NULL,
    volume          INTEGER NOT NULL,
    tick_volume     INTEGER DEFAULT 0,
    session_id      INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT DEFAULT (datetime('now')),
    UNIQUE(timestamp, symbol)
);
CREATE INDEX IF NOT EXISTS idx_candles_ts ON candles_5min(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_candles_sess ON candles_5min(session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_candles_sym ON candles_5min(symbol, timestamp DESC);

-- Precomputed session aggregates
CREATE TABLE IF NOT EXISTS session_aggregates (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_date          TEXT NOT NULL,
    symbol              TEXT DEFAULT 'MNQ',
    session_id          INTEGER NOT NULL,

    -- Price
    session_high        REAL NOT NULL,
    session_low         REAL NOT NULL,
    session_open        REAL NOT NULL,
    session_close       REAL NOT NULL,
    session_range       REAL NOT NULL,

    -- Volume
    total_volume        INTEGER NOT NULL,
    avg_volume          REAL NOT NULL,
    volume_ratio        REAL NOT NULL,

    -- Volatility
    avg_true_range      REAL NOT NULL,
    realized_vol        REAL NOT NULL,
    close_to_open       REAL NOT NULL,

    -- Direction
    direction           INTEGER NOT NULL,
    gap_pct             REAL NOT NULL,

    -- Range quality
    range_vs_atr        REAL NOT NULL,
    candle_count        INTEGER NOT NULL,

    UNIQUE(trade_date, symbol, session_id)
);
CREATE INDEX IF NOT EXISTS idx_session_date ON session_aggregates(trade_date DESC);

-- Historical trade log (ML training labels)
CREATE TABLE IF NOT EXISTS trade_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_time      TEXT NOT NULL,
    exit_time       TEXT,
    symbol          TEXT DEFAULT 'MNQ',

    -- Entry/Exit
    entry_price     REAL NOT NULL,
    exit_price      REAL,
    direction       INTEGER NOT NULL,
    session_id      INTEGER NOT NULL,

    -- Outcome
    pnl_ticks       REAL,
    pnl_dollars     REAL,
    result          TEXT,

    -- RRR
    target_rrr      REAL NOT NULL,
    actual_rrr      REAL,
    rrr_met         INTEGER,

    -- AMD
    amd_phase       TEXT,

    -- Features at entry
    adx_entry       REAL,
    atr_entry       REAL,
    ci_entry        REAL,
    vwap_entry      REAL,
    vwap_slope_entry REAL,
    vr_entry        REAL,
    volatility_regime TEXT,

    -- Expected vs Actual
    expected_move_ticks  REAL,
    actual_move_ticks    REAL,
    alpha_raw            REAL,

    -- Holding
    holding_minutes      REAL,
    exit_type            TEXT,

    UNIQUE(entry_time, symbol)
);
CREATE INDEX IF NOT EXISTS idx_trade_session ON trade_log(session_id, entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_trade_result ON trade_log(result, entry_time DESC);

-- Model metadata
CREATE TABLE IF NOT EXISTS model_registry (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name      TEXT NOT NULL UNIQUE,
    model_type       TEXT NOT NULL,
    version         TEXT NOT NULL,
    trained_at      TEXT DEFAULT (datetime('now')),
    data_trades     INTEGER DEFAULT 0,
    data_days       INTEGER DEFAULT 0,
    accuracy        REAL,
    roc_auc         REAL,
    win_rate        REAL,
    expectancy      REAL,
    profit_factor   REAL,
    sharpe          REAL,
    max_drawdown    REAL,
    is_active       INTEGER DEFAULT 1,
    file_path       TEXT
);
CREATE INDEX IF NOT EXISTS idx_model_active ON model_registry(is_active, model_name);

-- Feature importance snapshots
CREATE TABLE IF NOT EXISTS feature_importance (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name      TEXT NOT NULL,
    feature         TEXT NOT NULL,
    importance      REAL NOT NULL,
    computed_at     TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fi_model ON feature_importance(model_name, computed_at DESC);

-- Training log
CREATE TABLE IF NOT EXISTS training_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name      TEXT NOT NULL,
    train_mode      TEXT NOT NULL,
    started_at      TEXT DEFAULT (datetime('now')),
    completed_at    TEXT,
    rows_used       INTEGER,
    duration_sec    REAL,
    status          TEXT DEFAULT 'running',
    error_message   TEXT
);
