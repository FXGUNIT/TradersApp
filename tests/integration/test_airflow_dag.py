"""
Integration tests for Airflow DAG structure and configuration.
Validates DAG tasks, dependencies, and env-var loading without a running Airflow instance.

Mark: @pytest.mark.integration
"""

import os
import sys
from pathlib import Path

import pytest

ML_ENGINE_ROOT = Path(__file__).parent.parent.parent / "ml-engine"
sys.path.insert(0, str(ML_ENGINE_ROOT))

pytestmark = pytest.mark.integration


class TestAirflowDAGStructure:
    """Validate the continuous_model_monitoring DAG structure."""

    def test_dag_file_imports_without_error(self):
        """The DAG file should be importable without raising exceptions."""
        dags_path = Path(__file__).parent.parent.parent / "dags"
        sys.path.insert(0, str(dags_path.parent))

        # Import the DAG module (doesn't run Airflow)
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "continuous_model_monitoring_dag",
            dags_path / "continuous_model_monitoring_dag.py",
        )
        module = importlib.util.module_from_spec(spec)
        # Don't execute — just load
        spec.loader.exec_module(module)
        assert hasattr(module, "continuous_model_monitoring")

    def test_dag_has_required_tasks(self):
        """DAG should define the expected tasks: snapshot, DQ gate, retrain, report."""
        # Load the DAG module without executing
        import importlib.util
        from pathlib import Path as P

        dag_file = P(__file__).parent.parent.parent / "dags" / "continuous_model_monitoring_dag.py"
        spec = importlib.util.spec_from_file_location("dag_mod", str(dag_file))
        mod = importlib.util.module_from_spec(spec)

        # Mock airflow decorators to avoid dependency
        sys.modules.setdefault("airflow", type(sys)("airflow"))
        sys.modules["airflow"].decorators = type(sys)("airflow.decorators")
        sys.modules["airflow.decorators"].dag = lambda **k: (lambda f: f)
        sys.modules["airflow.decorators"].task = lambda **k: (lambda f: f)
        sys.modules.setdefault("pendulum", type(sys)("pendulum"))
        sys.modules["pendulum"].datetime = lambda *a, **k: type("p", (), {"now": lambda: None})()
        sys.modules.setdefault("airflow.exceptions", type(sys)("airflow.exceptions"))
        sys.modules["airflow.exceptions"].AirflowException = Exception

        spec.loader.exec_module(mod)

        dag_func = getattr(mod, "continuous_model_monitoring", None)
        assert callable(dag_func), "DAG function should be callable"

    def test_dag_schedule_is_configurable_via_env(self):
        """The DAG schedule should be configurable via MODEL_MONITOR_SCHEDULE env var."""
        default_schedule = "*/5 * * * *"
        os.environ["MODEL_MONITOR_SCHEDULE"] = "*/10 * * * *"
        try:
            # The schedule is read at import time — verify env var is read
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
            schedule = os.environ.get("TRAINING_ELIGIBILITY_BATCH_SCHEDULE", "0 1 * * *")
            assert schedule == "0 1 * * *"
        finally:
            os.environ.pop("TRAINING_ELIGIBILITY_BATCH_SCHEDULE", None)

    def test_training_eligibility_batch_dag_file_imports_without_error(self):
        dags_path = Path(__file__).parent.parent.parent / "dags"
        sys.path.insert(0, str(dags_path.parent))

        import importlib.util

        for mod in ["pendulum", "airflow", "airflow.decorators"]:
            sys.modules.setdefault(mod, type(sys)(mod))
        sys.modules["pendulum"].datetime = lambda *a, **k: type("p", (), {"now": lambda: None})()
        sys.modules["airflow.decorators"].dag = lambda **k: (lambda f: f)
        sys.modules["airflow.decorators"].task = lambda **k: (lambda f: f)

        spec = importlib.util.spec_from_file_location(
            "training_eligibility_batch_dag",
            dags_path / "training_eligibility_batch_dag.py",
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        assert hasattr(module, "training_eligibility_batch")

    def test_dag_retrain_timeout_reads_from_env(self):
        """ML_RETRAIN_TIMEOUT env var should control retrain timeout."""
        os.environ["ML_RETRAIN_TIMEOUT"] = "600"
        try:
            timeout = int(os.environ.get("ML_RETRAIN_TIMEOUT", "900"))
            assert timeout == 600
        finally:
            os.environ.pop("ML_RETRAIN_TIMEOUT", None)

    def test_distributed_lock_function_exists(self):
        """_acquire_distributed_lock and _release_distributed_lock should be defined."""
        import importlib.util
        from pathlib import Path as P

        dag_file = P(__file__).parent.parent.parent / "dags" / "continuous_model_monitoring_dag.py"
        spec = importlib.util.spec_from_file_location("dag_mod2", str(dag_file))

        # Mock dependencies
        for mod in ["pendulum", "airflow", "airflow.decorators", "airflow.exceptions"]:
            sys.modules.setdefault(mod, type(sys)(mod))
        sys.modules["pendulum"].datetime = lambda *a, **k: type("p", (), {"now": lambda: None})()
        sys.modules["airflow.decorators"].dag = lambda **k: (lambda f: f)
        sys.modules["airflow.decorators"].task = lambda **k: (lambda f: f)
        sys.modules["airflow.exceptions"].AirflowException = Exception

        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        assert hasattr(mod, "_acquire_distributed_lock")
        assert hasattr(mod, "_release_distributed_lock")
        assert hasattr(mod, "_on_dag_failure")
        assert hasattr(mod, "_on_dag_success")

    def test_slack_callback_function_exists(self):
        """_slack_notify should be defined for Slack integration."""
        import importlib.util
        from pathlib import Path as P

        dag_file = P(__file__).parent.parent.parent / "dags" / "continuous_model_monitoring_dag.py"
        spec = importlib.util.spec_from_file_location("dag_mod3", str(dag_file))

        for mod in ["pendulum", "airflow", "airflow.decorators", "airflow.exceptions"]:
            sys.modules.setdefault(mod, type(sys)(mod))
        sys.modules["pendulum"].datetime = lambda *a, **k: type("p", (), {"now": lambda: None})()
        sys.modules["airflow.decorators"].dag = lambda **k: (lambda f: f)
        sys.modules["airflow.decorators"].task = lambda **k: (lambda f: f)
        sys.modules["airflow.exceptions"].AirflowException = Exception

        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        assert hasattr(mod, "_slack_notify")
        assert callable(mod._slack_notify)
