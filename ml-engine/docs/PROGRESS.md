# ML Engine Implementation Progress

**Started:** 2026-04-01
**Current Phase:** Phase 1: Foundation
**Tests:** 16/16 passing ✅

---

## Phase 1: Foundation — Database + Feature Pipeline + 4 Core Models

### File Structure
| File | Status | Notes |
|---|---|---|
| `ml-engine/requirements.txt` | ✅ DONE | Python deps: fastapi, lightgbm, xgboost, scikit-learn, hmmlearn, numpy, pandas, shap |
| `ml-engine/data/schema.sql` | ✅ DONE | SQLite WAL schema: candles_5min, session_aggregates, trade_log, model_registry, feature_importance, training_log |
| `ml-engine/data/candle_db.py` | ✅ DONE | Thread-safe SQLite WAL layer, connection-per-thread pattern, all CRUD operations |
| `ml-engine/data/load_ninjatrader_csv.py` | ✅ DONE | NinjaTrader CSV parser + session aggregates |
| `ml-engine/config.py` | ✅ DONE | All hyperparameters, FEATURE_COLS (42 features), TSCV_N_SPLITS=5, TSCV_GAP=10 |
| `ml-engine/features/feature_pipeline.py` | ✅ DONE | Full pipeline: session segmenter + candle features + time features + level features + AMD encoding + VR regime + historical (pd.merge_asof) + cross-session + labels |
| `ml-engine/training/cross_validator.py` | ✅ DONE | TimeSeriesSplit wrapper with gap=10 candles |
| `ml-engine/training/model_store.py` | ✅ DONE | joblib persistence, versioned, Windows Path bug fixed |
| `ml-engine/models/direction/lightgbm_classifier.py` | ✅ DONE | Primary model: CalibratedClassifierCV(isotonic) + estimators_[0] importance |
| `ml-engine/models/direction/random_forest.py` | ✅ DONE | RandomForest + CalibratedClassifierCV(sigmoid) |
| `ml-engine/models/direction/xgboost_classifier.py` | ✅ DONE | XGBClassifier + CalibratedClassifierCV(isotonic) |
| `ml-engine/models/magnitude/move_magnitude.py` | ✅ DONE | Quantile regression: 25th/50th/75th percentile at 1/3/5/10 candle horizons |
| `ml-engine/alpha/alpha_engine.py` | ✅ DONE | Mean alpha, directional accuracy, expectancy, by session/time bucket, stability |
| `ml-engine/session/session_probability.py` | ✅ DONE | SessionProbabilityModel: LGBM predicting P(close UP), session features |
| `ml-engine/training/trainer.py` | ✅ DONE | Orchestrates: load candles → engineer features → train models → store → registry |
| `ml-engine/inference/predictor.py` | ✅ DONE | Loads all models from store, runs all votes, majority-vote consensus |
| `ml-engine/inference/explainer.py` | ✅ DONE | SHAP TreeExplainer → human-readable reasons, fallback to feature importance |
| `ml-engine/inference/consensus_aggregator.py` | ✅ DONE | Full BFF consensus output: signal + confidence + votes + timing |
| `ml-engine/optimization/rrr_optimizer.py` | ✅ DONE | Grid search R:R → expectancy maximization, clamping to MIN_ACCEPTABLE_RR |
| `ml-engine/optimization/exit_optimizer.py` | ✅ DONE | ExitStrategyPredictor: grid search → labels → LGBM regression, 10 exit params |
| `ml-engine/optimization/position_sizer.py` | ✅ DONE | PositionSizingPredictor: Kelly + conservative Kelly + firm limits + ML confidence |
| `ml-engine/main.py` | ✅ DONE | FastAPI port 8001: GET /health, POST /train, POST /train-sync, POST /predict, GET /model-status, POST /candles/upload, POST /trades/upload, POST /candles/parse-csv, GET /candles, GET /trades, GET /stats |
| `ml-engine/Dockerfile` | ✅ DONE | Python 3.11-slim, uvicorn, healthcheck |
| `bff/routes/consensus.mjs` | 🔄 IN PROGRESS | Phase 1 — BFF GET /consensus route |
| `bff/services/consensusEngine.mjs` | 🔄 IN PROGRESS | Phase 1 — Aggregates ML outputs → unified signal |
| `src/features/consensus/*.jsx` | ⬜ TODO | Phase 1 — Frontend UI components |
| `src/pages/CollectiveConsciousness.jsx` | ⬜ TODO | Phase 1 — Main page with ML Consensus tab |

### Phase 1 Tests
| Test | Status |
|---|---|
| test_schema_creates | ✅ PASS |
| test_candle_insert_and_query | ✅ PASS |
| test_candle_get_range | ✅ PASS |
| test_session_assignment | ✅ PASS |
| test_feature_pipeline | ✅ PASS (fixed: pd.merge_asof, tz normalization) |
| test_feature_vector | ✅ PASS |
| test_timeseries_cv | ✅ PASS |
| test_lgbm_train | ✅ PASS (fixed: estimators_[0] importance) |
| test_lgbm_predict | ✅ PASS |
| test_model_store | ✅ PASS |
| test_rrr_optimizer | ✅ PASS |
| test_alpha_engine | ✅ PASS |
| test_position_sizer | ✅ PASS |
| test_exit_strategy_predictor | ✅ PASS |
| test_session_probability | ✅ PASS |
| test_config_values | ✅ PASS |

### Bugs Fixed During Phase 1
1. `pandas 2.x bfill()` no longer accepts positional args → replaced with `.fillna()`
2. Windows `Path.stem` strips only last extension → explicit `.meta` stripping
3. `FileNotFoundError` on `.meta` version suffix → `.rstrip(".meta")` cleanup
4. RRR optimizer assertion failure with small data → clamping to MIN_ACCEPTABLE_RR
5. `config.FEATURE_COLS` missing → added 42-feature canonical list
6. `datetime64` vs `datetime64[tz]` comparison → pd.merge_asof + tz normalization
7. `sklearn NotFittedError` on `.estimator` → `estimators_[0]` for fitted base model

---

## Phase 2: Session Engine + Alpha + Magnitude
- [x] Session probability engine (session_probability.py ✅)
- [x] Move magnitude quantile model (move_magnitude.py ✅)
- [x] Alpha discovery engine (alpha_engine.py ✅)
- [ ] HMM regime detection (hmm_regime.py)
- [ ] Sakeeb91 walk-forward validation integration

## Phase 3: Exit Strategy + RRR + Position Sizing
- [x] ExitStrategyPredictor (grid search + ML) ✅
- [x] RRR grid search optimizer ✅
- [x] PositionSizingPredictor (Kelly + ML) ✅

## Phase 4: News Intelligence + Timing
- [ ] Forex Factory scraper + NewsData.io
- [ ] Best entry time model
- [ ] Auto-retrain on 3★ events
- [ ] Remaining models: SVM, Neural Net, AMD Classifier

## Phase 5: Polish + Production
- [x] Docker container ✅
- [ ] All 10+ models calibrated (remaining: SVM, MLP, AMD, HMM)
- [ ] npm run build passes
- [ ] Stress test: 500K candles

## Phase 6: Deployment + Security
- [ ] GitHub Actions CI/CD
- [ ] Railway + Vercel deployment
- [ ] Cloudflare WAF + Infisical + App Check
- [ ] Full security checklist

## Phase 7: Go Live
- [ ] Custom domain + SSL
- [ ] Monitoring + alerting
- [ ] Model versioning + rollback plan

---

## Git Commits Log
| Commit | Phase | Description | Tests |
|---|---|---|---|
| (none yet) | Phase 1 | Foundation files | 16/16 ✅ |

---

## Known Issues / Blockers
- None

## Decisions Made
1. SQLite WAL over PostgreSQL for dev (zero setup, handles 500K+ rows)
2. LightGBM as primary model (7x faster than sklearn, built-in calibration)
3. TimeSeriesSplit CV with gap=10 candles (no look-ahead bias)
4. AMD phase encoding: one-hot (5 binary columns)
5. Session ID assignment: 0=pre, 1=main, 2=post based on ET hour/minute
6. No external market data API — use MathEngine.js + NinjaTrader CSV only
7. `pd.merge_asof` for historical feature alignment (backward-looking, no future leakage)
8. `estimators_[0]` to access fitted base LGBM after CalibratedClassifierCV
