import pytest
from infrastructure import mlflow_client as mlflow_mod


class _FakeRegistryClient:
    def __init__(self):
        self.transitions = []

    def transition_model_version_stage(self, **kwargs):
        self.transitions.append(kwargs)


def test_normalize_stage_canonicalizes_values():
    client = mlflow_mod.MLflowTrackingClient("direction")

    assert client._normalize_stage("staging") == "Staging"
    assert client._normalize_stage("Production") == "Production"
    assert client._normalize_stage("ARCHIVED") == "Archived"


def test_normalize_stage_rejects_invalid_values():
    client = mlflow_mod.MLflowTrackingClient("direction")

    with pytest.raises(ValueError):
        client._normalize_stage("qa")


def test_auto_register_uses_classifier_validation_gate(monkeypatch):
    client = mlflow_mod.MLflowTrackingClient("direction")
    fake_registry = _FakeRegistryClient()
    client._client = fake_registry

    monkeypatch.setattr(
        client,
        "log_model",
        lambda **kwargs: {"ok": True, "run_id": "run-123", "version": 7},
    )

    result = client.auto_register_if_passing(
        model_name="direction_lightgbm",
        metrics={
            "cv_roc_auc_mean": 0.61,
            "cv_accuracy_mean": 0.57,
        },
        model=object(),
        metadata={"symbol": "MNQ"},
        stage="staging",
    )

    assert result["registered"] is True
    assert result["stage"] == "Staging"
    assert result["validation_strategy"] == "classifier"
    assert fake_registry.transitions == [
        {
            "name": "direction_lightgbm",
            "version": 7,
            "stage": "Staging",
            "archive_existing_versions": False,
        }
    ]
