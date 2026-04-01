# ML Engine Implementation Progress

**Started:** 2026-04-01
**Current Phase:** Phase 5: Polish + Production
**Tests:** 21/21 passing ✅ | npm build: ✅

---

## Phase 1: Foundation

— Database + Feature Pipeline + 4 Core Models

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
| `ml-engine/Dockerfile` | ✅ DONE | Python 3.11-slim, uvicorn, healthcheck, httpx-based health check |
| `bff/routes/consensus.mjs` | ✅ DONE | BFF GET /ml/consensus, GET /ml/status, POST /ml/train, GET /ml/health |
| `bff/services/consensusEngine.mjs` | ✅ DONE | Transforms MathEngine.js state → ML feature vector → unified signal |
| `src/features/consensus/*.jsx` | ✅ DONE | ML Signals tab with Hero card, Session, Alpha, Move, RRR, Exit, Sizing, Timing, Votes |
| `src/pages/CollectiveConsciousness.jsx` | ✅ DONE | ML Signals tab added alongside AI Chat tab with ternary tab switcher |

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
- [x] HMM regime detection (hmm_regime.py ✅) — Gaussian HMM 3-state, VR-mean remapping, BIC/AIC, posterior probs

## Phase 3: Exit Strategy + RRR + Position Sizing
- [x] ExitStrategyPredictor (grid search + ML) ✅
- [x] RRR grid search optimizer ✅
- [x] PositionSizingPredictor (Kelly + ML) ✅

## Phase 4: News Intelligence + Timing
- [x] Forex Factory scraper (newsService.mjs, 3★ events only, no API key) ✅
- [x] NewsData.io free tier backup (200 credits/month, sentiment classifier) ✅
- [x] Best entry time model (time_probability.py, 15-min buckets, ML blend) ✅
- [x] News BFF routes (/news/upcoming, /news/countdown) ✅
- [x] Auto-retrain trigger on 3★ events (POST /news-trigger → ML Engine) ✅
- [x] SVM classifier (RBF, CalibratedClassifierCV sigmoid) ✅
- [x] MLP Neural Net (2 hidden layers 64/32, early stopping, calibrated) ✅
- [x] AMD Classifier (GaussianNB + AMD phase win rate priors) ✅

## Phase 5: Polish + Production
- [x] Docker container (ml-engine/Dockerfile, Python 3.11-slim) ✅
- [x] BFF Dockerfile (bff/Dockerfile, Node 20-alpine, zero-ext-deps) ✅
- [x] docker-compose.yml (all 3 services: ml-engine, bff, frontend) ✅
- [x] .dockerignore files (ml-engine + bff) ✅
- [x] All 10+ models calibrated (LightGBM, RF, XGBoost, SVM, MLP, AMD NB, HMM, TimeProbability) ✅
- [x] npm run build passes ✅
- [ ] Stress test: 500K candles (manual, requires real NinjaTrader data)

## Phase 6: Deployment + Security
- [x] GitHub Actions CI/CD (.github/workflows/ci.yml) ✅
  - Frontend: lint + build (Node 20)
  - ML Engine: pytest + Docker build + health check (Python 3.11)
  - BFF: Docker build (Node 20-alpine)
  - Staging deploy: Railway (ML + BFF) + Vercel (frontend)
  - Production deploy: GHCR images + Railway + Vercel
- [x] CODEOWNERS (.github/CODEOWNERS) ✅
- [x] Dependabot (.github/dependabot.yml, weekly npm + pip) ✅
- [x] Security headers (bff/services/security.mjs + server.mjs) ✅
  - X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, CSP
  - Injected on every response via `addSecurityHeaders()`
- [x] Rate limiting (bff/services/security.mjs) ✅
  - Sliding window, per-IP, in-memory (no external deps)
  - 7 endpoint classes: global (100/min), ML predict (10/min), news (20/min), admin (20/5min), AI chat (30/min), terminal write (60/min), health (300/min)
  - `Retry-After`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers on every response
- [x] RBAC enforcement (bff/services/security.mjs + server.mjs) ✅
  - Roles: TRADER (0), MENTOR (1), ADMIN (2) — hierarchical
  - Route permission map: admin routes require ADMIN, ML/news/public require none
  - Bearer token auth: `POST /admin/session` (create), `GET /admin/session` (check), `DELETE /admin/session` (revoke)
  - In-memory session store with TTL (max 24h, default 8h)
  - `cleanupExpiredSessions()` runs every 10 min
- [ ] Railway + Vercel deployment (requires secrets: RAILWAY_TOKEN, VERCEL_TOKEN, etc.)
- [ ] Cloudflare WAF (requires Cloudflare account + DNS configuration)
- [ ] Infisical secrets manager setup (requires Infisical account)
- [ ] Firebase App Check (requires Firebase project + reCAPTCHA Enterprise)
- [ ] Full 31-point security checklist

## Phase 7: Go Live
- [ ] Custom domain + SSL (Cloudflare origin cert)
- [ ] Monitoring: uptime checks on all 3 services
- [ ] Alerting: Slack/Discord webhook for failures
- [ ] Model versioning: backup trained models to GitHub releases
- [ ] Rollback plan documented

---

## Git Commits Log

| Commit | Phase | Description | Tests |
|---|---|---|---|
| 5de6caf | Phase 1 | ML Engine foundation + BFF consensus routes + ML Signals tab | 16/16 ✅ |
| 12b404e | Phase 2+4 | HMM, SVM, MLP, AMD NB, TimeProbability, News Intelligence | 21/21 ✅ |
| 3b8669c | Phase 5+6 | GitHub Actions CI/CD, Dockerfiles, docker-compose, CODEOWNERS, Dependabot | 21/21 ✅ |
| (pending) | Phase 6 security | Native security headers, rate limiting (sliding window), RBAC (TRADER/MENTOR/ADMIN) | 21/21 ✅ |

---

## Known Issues / Blockers
- Helmet.js security headers not yet integrated into bff/server.mjs
- Rate limiting middleware not yet added to bff/server.mjs
- Railway/Vercel deployment requires account setup + secrets configuration

## Decisions Made
1. SQLite WAL over PostgreSQL for dev (zero setup, handles 500K+ rows)
2. LightGBM as primary model (7x faster than sklearn, built-in calibration)
3. TimeSeriesSplit CV with gap=10 candles (no look-ahead bias)
4. AMD phase encoding: one-hot (5 binary columns)
5. Session ID assignment: 0=pre, 1=main, 2=post based on ET hour/minute
6. No external market data API — use MathEngine.js + NinjaTrader CSV only
7. `pd.merge_asof` for historical feature alignment (backward-looking, no future leakage)
8. `estimators_[0]` to access fitted base LGBM after CalibratedClassifierCV
9. BFF uses zero external npm packages (Node.js built-ins only)
10. GitHub Actions uses GHCR for Docker images, Railway API for deployments
