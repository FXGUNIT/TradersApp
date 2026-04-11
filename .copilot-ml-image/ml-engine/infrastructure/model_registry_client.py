"""
Client for the model registry service.

Modes:
- direct: use an in-process ModelRegistryService (local dev/tests)
- sidecar: call the sidecar over localhost HTTP (k8s serving)
"""
from __future__ import annotations

from typing import Any

import httpx
import pandas as pd

import config
from infrastructure.model_registry_service import ModelRegistryService


class ModelRegistryClient:
    def __init__(
        self,
        mode: str | None = None,
        base_url: str | None = None,
        service: ModelRegistryService | None = None,
    ) -> None:
        self.mode = (mode or config.MODEL_REGISTRY_MODE or "direct").lower()
        self.base_url = (base_url or config.MODEL_REGISTRY_URL).rstrip("/")
        self._service = service or (ModelRegistryService() if self.mode == "direct" else None)
        self._client: httpx.Client | None = None

    def _http(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(timeout=config.MODEL_REGISTRY_TIMEOUT_SECONDS)
        return self._client

    @staticmethod
    def _df_to_records(df: pd.DataFrame | None) -> list[dict[str, Any]]:
        if df is None or df.empty:
            return []
        payload = df.copy()
        for col in payload.columns:
            if pd.api.types.is_datetime64_any_dtype(payload[col]):
                payload[col] = payload[col].astype(str)
        return payload.to_dict(orient="records")

    def warm_models(self, names: list[str] | None = None) -> dict[str, Any]:
        if self.mode == "direct":
            return self._service.warm_models(names)
        response = self._http().post(f"{self.base_url}/v1/models/warm", json={"names": names})
        response.raise_for_status()
        return response.json()

    def invalidate(self, names: list[str] | None = None) -> dict[str, Any]:
        if self.mode == "direct":
            return self._service.invalidate(names)
        response = self._http().post(f"{self.base_url}/v1/models/invalidate", json={"names": names})
        response.raise_for_status()
        return response.json()

    def status(self) -> dict[str, Any]:
        if self.mode == "direct":
            status = self._service.status()
            status["mode"] = "direct"
            return status
        response = self._http().get(f"{self.base_url}/v1/models/status")
        response.raise_for_status()
        return response.json()

    def predict(
        self,
        candles_df: pd.DataFrame,
        trade_log_df: pd.DataFrame | None = None,
        math_engine_snapshot: dict | None = None,
        key_levels: dict | None = None,
    ) -> dict[str, Any]:
        if self.mode == "direct":
            return self._service.predict(candles_df, trade_log_df, math_engine_snapshot, key_levels)

        response = self._http().post(
            f"{self.base_url}/v1/models/predict",
            json={
                "candles": self._df_to_records(candles_df),
                "trades": self._df_to_records(trade_log_df),
                "math_engine_snapshot": math_engine_snapshot or {},
                "key_levels": key_levels,
            },
        )
        response.raise_for_status()
        return response.json()

    def advance_regime(self, feature_df: pd.DataFrame) -> dict[str, Any]:
        if self.mode == "direct":
            return self._service.advance_regime(feature_df)

        response = self._http().post(
            f"{self.base_url}/v1/models/regime/advance",
            json={"features": self._df_to_records(feature_df)},
        )
        response.raise_for_status()
        return response.json()

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
        if self._service is not None:
            self._service.close()
