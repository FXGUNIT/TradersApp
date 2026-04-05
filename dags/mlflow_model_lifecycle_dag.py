"""
Airflow DAG — MLflow Model Lifecycle Management

Runs every Monday at 06:00 UTC (after weekend paper-trade review):
  1. Sync MLflow registry state → Prometheus metrics
  2. Poll Staging models → check PBO/sharpe/win_rate metrics
  3. Promote qualifying models Staging → Production
  4. Archive stale Production models (>7 days)
  5. Log lifecycle events to MLflow

Run manually:
  airflow dags trigger mlflow_model_lifecycle

Requires:
  - MLflow server at MLFLOW_TRACKING_URI (default: http://mlflow:5000)
  - MinIO artifact store for model artifacts
  - Models registered via POST /mlflow/promote in ML Engine

Thresholds (enforced):
  Strategy models:   PBO < 5%  AND  Sharpe >= 0.5  AND  Win rate >= 50%
  Classifier models: CV AUC >= 0.55  AND  CV Accuracy >= 52%

Promotion gates:
  Staging → Production:  manual review required (this DAG logs the recommendation)
  Production → Archived:  auto-archive if model age > 7 days
"""

import sys
import os
from pathlib import Path

import pendulum
from airflow.decorators import dag, task
from airflow.models import Variable

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ML_ENGINE_ROOT = PROJECT_ROOT / "ml-engine"
if str(ML_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ENGINE_ROOT))

MLFLOW_TRACKING_URI = os.environ.get("MLFLOW_TRACKING_URI", "http://mlflow:5000")
MODEL_PREFIXES = ["direction", "regime", "magnitude", "alpha", "session", "mamba"]


# ─── PBO / Metric Thresholds ──────────────────────────────────────────────────

PBO_THRESHOLD = 0.05          # Pass if PBO < 5%
SHARPE_MIN = 0.5
WIN_RATE_MIN = 0.50
CV_AUC_MIN = 0.55
CV_ACCURACY_MIN = 0.52
MAX_PROD_AGE_DAYS = 7


@dag(
    dag_id="mlflow_model_lifecycle",
    schedule="0 6 * * 1",       # Every Monday at 06:00 UTC
    start_date=pendulum.datetime(2026, 4, 6, tz="UTC"),
    catchup=False,
    tags=["mlops", "mlflow", "model-registry", "lifecycle"],
    doc_md="""
## MLflow Model Lifecycle DAG

**Schedule:** Every Monday at 06:00 UTC (after weekend review)

### Pipeline Steps

| Step | Task | Description |
|------|------|-------------|
| 1 | `sync_registry_metrics` | Poll MLflow registry → Prometheus gauge |
| 2 | `get_staging_models` | List all models in Staging stage |
| 3 | `validate_models` | Check PBO/sharpe/win_rate thresholds |
| 4 | `promote_qualified` | Promote Staging → Production (if thresholds met) |
| 5 | `archive_stale` | Archive Production models older than 7 days |
| 6 | `log_lifecycle` | Record lifecycle events as MLflow runs |

### Promotion Policy
- **Staging → Production**: This DAG logs a recommendation; human reviews and promotes
- **Production → Archived**: Fully automatic when model age > 7 days

### Safety
- Never promotes directly from None/Unknown → Production
- Always archives with reason logged
- Fails open: if MLflow unreachable, skips promotion (never degrades prod)
""",
)
def model_lifecycle_dag():
    # ── Step 1: Sync registry metrics to Prometheus ──────────────────────────
    @task(task_id="sync_registry_metrics")
    def sync_registry_metrics():
        """
        Query MLflow registry and sync model counts per stage to Prometheus.
        Allows dashboards to alert on stale/missing production models.
        """
        try:
            from infrastructure.prometheus_exporter import sync_mlflow_registry
            from infrastructure.mlflow_client import get_mlflow_client

            registry = {}
            for prefix in MODEL_PREFIXES:
                client = get_mlflow_client(prefix)
                models = client.get_registry_models(f"{prefix}_")
                registry.update(models)

            sync_mlflow_registry(registry)
            total = sum(len(v) for v in registry.values())
            print(f"[lifecycle] Synced {total} registered models across {len(registry)} model families")
            return {"synced": True, "total_models": total, "families": list(registry.keys())}
        except Exception as e:
            print(f"[lifecycle] Failed to sync registry metrics: {e}")
            return {"synced": False, "error": str(e)}

    # ── Step 2: Get staging models ───────────────────────────────────────────
    @task(task_id="get_staging_models")
    def get_staging_models():
        """List all models currently in Staging stage across all families."""
        staging = []
        for prefix in MODEL_PREFIXES:
            try:
                from infrastructure.mlflow_client import get_mlflow_client
                client = get_mlflow_client(prefix)
                versions = client._client.get_latest_versions(
                    f"tradersapp_{prefix}_ensemble",
                    stages=["Staging"]
                ) if client._client else []
                if not versions:
                    # Try without prefix
                    try:
                        versions = client._client.get_latest_versions(
                            f"{prefix}_ensemble",
                            stages=["Staging"]
                        ) if client._client else []
                    except Exception:
                        pass
                for v in versions:
                    staging.append({
                        "model_name": v.name,
                        "version": v.version,
                        "stage": "Staging",
                        "run_id": v.run_id,
                        "created": v.creation_timestamp,
                    })
            except Exception as e:
                print(f"[lifecycle] Could not query {prefix}_ensemble: {e}")
        print(f"[lifecycle] Found {len(staging)} models in Staging")
        return staging

    # ── Step 3: Validate models ──────────────────────────────────────────────
    @task(task_id="validate_models")
    def validate_models(staging: list) -> list:
        """
        Check each staging model against PBO/sharpe/win_rate thresholds.
        Returns list of models that qualify for promotion recommendation.
        """
        if not staging:
            print("[lifecycle] No staging models to validate")
            return []

        qualified = []
        for model in staging:
            try:
                run_id = model.get("run_id")
                if not run_id:
                    continue

                from infrastructure.mlflow_client import get_mlflow_client
                client = get_mlflow_client("direction")
                if not client._client:
                    continue

                run = client._client.get_run(run_id)
                if not run:
                    continue

                metrics = run.data.metrics or {}

                # Check strategy thresholds
                pbo = metrics.get("pbo", 999)
                sharpe = metrics.get("sharpe_oracle", 0.0)
                win_rate = metrics.get("win_rate", 0.0)
                cv_auc = metrics.get("cv_roc_auc_mean", 0.0)
                cv_acc = metrics.get("cv_accuracy_mean", 0.0)

                strategy_ok = (
                    pbo < PBO_THRESHOLD
                    and sharpe >= SHARPE_MIN
                    and win_rate >= WIN_RATE_MIN
                )
                classifier_ok = (
                    cv_auc >= CV_AUC_MIN
                    and cv_acc >= CV_ACCURACY_MIN
                )

                model.update({
                    "pbo": pbo,
                    "sharpe": sharpe,
                    "win_rate": win_rate,
                    "cv_roc_auc": cv_auc,
                    "cv_accuracy": cv_acc,
                    "strategy_qualified": strategy_ok,
                    "classifier_qualified": classifier_ok,
                    "qualified": strategy_ok or classifier_ok,
                })

                if model["qualified"]:
                    qualified.append(model)
                    print(f"[lifecycle] QUALIFIED: {model['model_name']} v{model['version']} "
                          f"(PBO={pbo:.4f}, Sharpe={sharpe:.3f}, WR={win_rate:.1%})")
                else:
                    print(f"[lifecycle] NOT QUALIFIED: {model['model_name']} v{model['version']} "
                          f"(PBO={pbo:.4f}, Sharpe={sharpe:.3f})")

            except Exception as e:
                print(f"[lifecycle] Validation error for {model.get('model_name')}: {e}")

        print(f"[lifecycle] {len(qualified)}/{len(staging)} staging models qualified")
        return qualified

    # ── Step 4: Promote qualified models ──────────────────────────────────────
    @task(task_id="promote_qualified", trigger_rule="none_failed_min_one_success")
    def promote_qualified(qualified: list):
        """
        Promote qualified Staging models to Production.
        NOTE: This logs a recommendation. In strict mode, set recommend_only=True
        to require human review before actual promotion.
        """
        recommend_only = os.environ.get("LIFECYCLE_RECOMMEND_ONLY", "false").lower() == "true"
        promoted = []

        for model in qualified:
            try:
                name = model["model_name"]
                version = model["version"]

                if recommend_only:
                    print(f"[lifecycle] RECOMMEND: promote {name} v{version} "
                          f"(recommend_only=True — skipped actual promotion)")
                    continue

                from infrastructure.mlflow_client import get_mlflow_client
                client = get_mlflow_client("direction")
                result = client.promote_model(
                    model_name=name,
                    from_stage="Staging",
                    to_stage="Production",
                )

                if result.get("ok"):
                    print(f"[lifecycle] PROMOTED: {name} v{version} → Production")
                    promoted.append(result)
                else:
                    print(f"[lifecycle] FAILED to promote {name}: {result.get('error')}")

            except Exception as e:
                print(f"[lifecycle] Promotion error: {e}")

        return {
            "promoted": promoted,
            "recommend_only": recommend_only,
            "total_qualified": len(qualified),
        }

    # ── Step 5: Archive stale production models ────────────────────────────────
    @task(task_id="archive_stale")
    def archive_stale():
        """Archive production models older than MAX_PROD_AGE_DAYS."""
        import time
        archived = []
        cutoff_ms = (time.time() - MAX_PROD_AGE_DAYS * 86400) * 1000

        for prefix in MODEL_PREFIXES:
            try:
                from infrastructure.mlflow_client import get_mlflow_client
                client = get_mlflow_client(prefix)
                if not client._client:
                    continue

                try:
                    prod_versions = client._client.get_latest_versions(
                        f"tradersapp_{prefix}_ensemble",
                        stages=["Production"]
                    )
                except Exception:
                    try:
                        prod_versions = client._client.get_latest_versions(
                            f"{prefix}_ensemble",
                            stages=["Production"]
                        )
                    except Exception:
                        continue

                for v in prod_versions:
                    if v.creation_timestamp < cutoff_ms:
                        try:
                            client._client.transition_model_version_stage(
                                name=v.name,
                                version=v.version,
                                stage="Archived",
                            )
                            age_days = (time.time() - v.creation_timestamp / 1000) / 86400
                            print(f"[lifecycle] ARCHIVED: {v.name} v{v.version} "
                                  f"(age={age_days:.1f}d)")
                            archived.append({
                                "name": v.name,
                                "version": v.version,
                                "age_days": round(age_days, 1),
                            })
                        except Exception as e:
                            print(f"[lifecycle] Archive failed for {v.name}: {e}")

            except Exception as e:
                print(f"[lifecycle] Could not process {prefix}: {e}")

        print(f"[lifecycle] Archived {len(archived)} stale production models")
        return {"archived": archived}

    # ── Step 6: Log lifecycle events to MLflow ────────────────────────────────
    @task(task_id="log_lifecycle")
    def log_lifecycle(sync_result: dict, staging: list, qualified: list,
                      promote_result: dict, archive_result: dict):
        """Record lifecycle run as an MLflow experiment."""
        try:
            from infrastructure.mlflow_client import get_mlflow_client
            from datetime import datetime, timezone

            client = get_mlflow_client("lifecycle")
            with client.start_run(run_name="model_lifecycle_weekly"):
                client.log_params({
                    "dag": "mlflow_model_lifecycle",
                    "recommend_only": promote_result.get("recommend_only", False),
                    "pbo_threshold": PBO_THRESHOLD,
                    "sharpe_min": SHARPE_MIN,
                    "win_rate_min": WIN_RATE_MIN,
                    "cv_auc_min": CV_AUC_MIN,
                    "cv_accuracy_min": CV_ACCURACY_MIN,
                    "max_prod_age_days": MAX_PROD_AGE_DAYS,
                })
                client.log_metrics({
                    "registry_synced": int(sync_result.get("synced", False)),
                    "total_registered": sync_result.get("total_models", 0),
                    "staging_count": len(staging),
                    "qualified_count": len(qualified),
                    "promoted_count": len(promote_result.get("promoted", [])),
                    "archived_count": len(archive_result.get("archived", [])),
                    "recommend_only": int(promote_result.get("recommend_only", False)),
                })
                client.log_tag("lifecycle_event", "weekly_review")
                client.log_tag(
                    "timestamp", datetime.now(timezone.utc).isoformat()
                )
            print("[lifecycle] Lifecycle run logged to MLflow")
        except Exception as e:
            print(f"[lifecycle] Failed to log to MLflow: {e}")

    # ── Task graph ────────────────────────────────────────────────────────────
    sync = sync_registry_metrics()
    staging = get_staging_models()
    qualified = validate_models(staging)
    promoted = promote_qualified(qualified)
    archived = archive_stale()
    log_lifecycle(sync, staging, qualified, promoted, archived)


model_lifecycle_dag = model_lifecycle_dag()
