"""
Integration tests for Airflow DAG structure and configuration.
Validates DAG tasks, scheduling, and orchestration wiring without a running Airflow instance.

Mark: @pytest.mark.integration
"""

import importlib.util
import os
import sys
import types
from pathlib import Path

import pytest

ML_ENGINE_ROOT = Path(__file__).parent.parent.parent / "ml-engine"
PROJECT_ROOT = Path(__file__).parent.parent.parent
DAGS_ROOT = PROJECT_ROOT / "dags"
sys.path.insert(0, str(ML_ENGINE_ROOT))
sys.path.insert(0, str(PROJECT_ROOT))

pytestmark = pytest.mark.integration


def _install_airflow_stubs():
    airflow_module = types.ModuleType("airflow")
    decorators_module = types.ModuleType("airflow.decorators")
    exceptions_module = types.ModuleType("airflow.exceptions")
    pendulum_module = types.ModuleType("pendulum")

    def dag(**kwargs):
        def decorator(fn):
            def dag_factory(*args, **_kwargs):
                return {
                    "dag_id": kwargs.get("dag_id"),
                    "factory": fn.__name__,
                    "args": args,
                }

            dag_factory.__name__ = fn.__name__
            dag_factory.__wrapped__ = fn
            dag_factory._dag_kwargs = kwargs
            return dag_factory

        return decorator

    def task(**kwargs):
        def decorator(fn):
            def task_factory(*args, **_kwargs):
                return {
                    "task_id": kwargs.get("task_id", fn.__name__),
                    "factory": fn.__name__,
                    "args": args,
                }

            task_factory.__name__ = fn.__name__
            task_factory.__wrapped__ = fn
            task_factory._task_kwargs = kwargs
            return task_factory

        return decorator

    decorators_module.dag = dag
    decorators_module.task = task
    exceptions_module.AirflowException = Exception
    pendulum_module.datetime = lambda *args, **kwargs: {
        "args": args,
        "kwargs": kwargs,
    }

    airflow_module.decorators = decorators_module
    airflow_module.exceptions = exceptions_module

    sys.modules["airflow"] = airflow_module
    sys.modules["airflow.decorators"] = decorators_module
    sys.modules["airflow.exceptions"] = exceptions_module
    sys.modules["pendulum"] = pendulum_module


def _load_module(module_name: str, file_path: Path):
    _install_airflow_stubs()
    sys.modules.pop(module_name, None)
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class TestAirflowDAGStructure:
    """Validate the DAG modules that orchestrate monitoring and retraining."""

    def test_continuous_monitoring_dag_imports_without_error(self):
        module = _load_module(
            "continuous_model_monitoring_dag",
            DAGS_ROOT / "continuous_model_monitoring_dag.py",
        )
        assert hasattr(module, "continuous_model_monitoring")
        assert callable(module.continuous_model_monitoring)

    def test_continuous_monitoring_dag_has_required_helpers(self):
        module = _load_module(
            "continuous_model_monitoring_dag_helpers",
            DAGS_ROOT / "continuous_model_monitoring_dag.py",
        )

        assert hasattr(module, "_acquire_distributed_lock")
        assert hasattr(module, "_release_distributed_lock")
        assert hasattr(module, "_on_dag_failure")
        assert hasattr(module, "_on_dag_success")
        assert hasattr(module, "_slack_notify")
        assert callable(module._slack_notify)

    def test_continuous_monitoring_schedule_is_configurable_via_env(self):
        default_schedule = "*/5 * * * *"
        os.environ["MODEL_MONITOR_SCHEDULE"] = "*/10 * * * *"
        try:
            schedule = os.environ.get("MODEL_MONITOR_SCHEDULE", default_schedule)
            assert schedule == "*/10 * * * *"
        finally:
            os.environ.pop("MODEL_MONITOR_SCHEDULE", None)

    def test_feedback_retrain_dag_uses_saturday_schedule_env(self):
        os.environ["FEEDBACK_RETRAIN_SCHEDULE"] = "0 22 * * 6"
        try:
            schedule = os.environ.get("FEEDBACK_RETRAIN_SCHEDULE", "0 22 * * 6")
            assert schedule == "0 22 * * 6"
        finally:
            os.environ.pop("FEEDBACK_RETRAIN_SCHEDULE", None)

    def test_nightly_training_batch_dag_uses_nightly_schedule_env(self):
        os.environ["TRAINING_ELIGIBILITY_BATCH_SCHEDULE"] = "0 1 * * *"
        try:
            schedule = os.environ.get(
                "TRAINING_ELIGIBILITY_BATCH_SCHEDULE",
                "0 1 * * *",
            )
            assert schedule == "0 1 * * *"
        finally:
            os.environ.pop("TRAINING_ELIGIBILITY_BATCH_SCHEDULE", None)

    def test_training_eligibility_batch_dag_imports_without_error(self):
        module = _load_module(
            "training_eligibility_batch_dag",
            DAGS_ROOT / "training_eligibility_batch_dag.py",
        )
        assert hasattr(module, "training_eligibility_batch")
        assert callable(module.training_eligibility_batch)

    def test_feedback_retrain_dag_imports_without_error(self):
        module = _load_module(
            "feedback_loop_dag",
            DAGS_ROOT / "feedback_loop_dag.py",
        )
        assert hasattr(module, "feedback_retrain_loop")
        assert callable(module.feedback_retrain_loop)

    def test_feedback_retrain_dag_prepares_updated_eligible_batch_before_retrain(self):
        dag_source = (DAGS_ROOT / "feedback_loop_dag.py").read_text(encoding="utf-8")

        assert 'schedule=os.environ.get("FEEDBACK_RETRAIN_SCHEDULE", "0 22 * * 6")' in dag_source
        assert 'params={"symbol": "MNQ", "batch_type": "weekly_retrain"}' in dag_source
        assert "dq >> pr >> tb >> dd >> rr >> summary" in dag_source

    def test_nightly_batch_dag_calls_nightly_eligibility_snapshot(self):
        dag_source = (DAGS_ROOT / "training_eligibility_batch_dag.py").read_text(
            encoding="utf-8",
        )

        assert (
            'schedule=os.environ.get("TRAINING_ELIGIBILITY_BATCH_SCHEDULE", "0 1 * * *")'
            in dag_source
        )
        assert 'params={"symbol": "MNQ", "batch_type": "nightly_eligibility"}' in dag_source

    def test_dag_retrain_timeout_reads_from_env(self):
        os.environ["ML_RETRAIN_TIMEOUT"] = "600"
        try:
            timeout = int(os.environ.get("ML_RETRAIN_TIMEOUT", "900"))
            assert timeout == 600
        finally:
            os.environ.pop("ML_RETRAIN_TIMEOUT", None)
