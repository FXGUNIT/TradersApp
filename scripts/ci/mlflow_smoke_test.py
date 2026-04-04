#!/usr/bin/env python3
import json
import os
import time

import mlflow
from mlflow.tracking import MlflowClient
from sklearn.datasets import load_iris
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split


def main() -> None:
    tracking_uri = os.environ.get("MLFLOW_TRACKING_URI", "http://127.0.0.1:5000")
    experiment_name = os.environ.get("MLFLOW_SMOKE_EXPERIMENT", "tradersapp_smoketest")
    model_name = os.environ.get("MLFLOW_SMOKE_MODEL", "smoketest_direction_model")

    mlflow.set_tracking_uri(tracking_uri)
    mlflow.set_experiment(experiment_name)

    iris = load_iris()
    X_train, X_test, y_train, y_test = train_test_split(
        iris.data,
        iris.target,
        test_size=0.2,
        random_state=42,
        stratify=iris.target,
    )

    model = LogisticRegression(max_iter=400)
    model.fit(X_train, y_train)
    accuracy = float(model.score(X_test, y_test))

    with mlflow.start_run(run_name="registry-smoke-test") as run:
        mlflow.log_params(
            {
                "model_type": "logistic_regression",
                "dataset": "iris",
                "purpose": "smoke_test",
            }
        )
        mlflow.log_metric("accuracy", accuracy)
        model_info = mlflow.sklearn.log_model(
            sk_model=model,
            artifact_path="model",
            registered_model_name=model_name,
        )
        run_id = run.info.run_id

    client = MlflowClient(tracking_uri=tracking_uri)
    version = None
    deadline = time.time() + 30
    while time.time() < deadline:
        versions = client.search_model_versions(f"name='{model_name}'")
        for candidate in versions:
            if candidate.run_id == run_id:
                version = candidate.version
                break
        if version:
            break
        time.sleep(1)

    if version is None:
        raise RuntimeError(f"Model version for run {run_id} was not registered in time")

    client.transition_model_version_stage(
        name=model_name,
        version=version,
        stage="Staging",
        archive_existing_versions=False,
    )

    print(
        json.dumps(
            {
                "tracking_uri": tracking_uri,
                "experiment": experiment_name,
                "model_name": model_name,
                "run_id": run_id,
                "version": version,
                "stage": "Staging",
                "accuracy": accuracy,
                "model_uri": model_info.model_uri,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
