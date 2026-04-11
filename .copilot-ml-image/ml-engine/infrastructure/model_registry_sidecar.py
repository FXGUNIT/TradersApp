"""
FastAPI sidecar that owns loaded model instances for stateless serving pods.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field

import config
from infrastructure.model_registry_service import ModelRegistryService


class WarmRequest(BaseModel):
    names: list[str] | None = None


class PredictRequest(BaseModel):
    candles: list[dict[str, Any]] = Field(default_factory=list)
    trades: list[dict[str, Any]] = Field(default_factory=list)
    math_engine_snapshot: dict[str, Any] = Field(default_factory=dict)
    key_levels: dict[str, Any] | None = None


class RegimeAdvanceRequest(BaseModel):
    features: list[dict[str, Any]] = Field(default_factory=list)


def _to_frame(records: list[dict[str, Any]]) -> pd.DataFrame:
    if not records:
        return pd.DataFrame()
    df = pd.DataFrame(records)
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    return df


@asynccontextmanager
async def lifespan(app: FastAPI):
    registry = ModelRegistryService()
    app.state.registry = registry
    if config.MODEL_REGISTRY_WARMUP:
        try:
            registry.warm_models()
        except Exception as exc:
            print(f"[ModelRegistrySidecar] Warmup skipped: {exc}")
    yield
    registry.close()


app = FastAPI(
    title="TradersApp Model Registry Sidecar",
    version="1.0.0",
    lifespan=lifespan,
)


def _registry() -> ModelRegistryService:
    return app.state.registry


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "healthy", **_registry().status()}


@app.get("/v1/models/status")
async def status() -> dict[str, Any]:
    return _registry().status()


@app.post("/v1/models/warm")
async def warm(request: WarmRequest) -> dict[str, Any]:
    return _registry().warm_models(request.names)


@app.post("/v1/models/invalidate")
async def invalidate(request: WarmRequest) -> dict[str, Any]:
    return _registry().invalidate(request.names)


@app.post("/v1/models/predict")
async def predict(request: PredictRequest) -> dict[str, Any]:
    candles_df = _to_frame(request.candles)
    trade_df = _to_frame(request.trades)
    return _registry().predict(
        candles_df=candles_df,
        trade_log_df=trade_df,
        math_engine_snapshot=request.math_engine_snapshot,
        key_levels=request.key_levels,
    )


@app.post("/v1/models/regime/advance")
async def advance_regime(request: RegimeAdvanceRequest) -> dict[str, Any]:
    feature_df = _to_frame(request.features)
    return _registry().advance_regime(feature_df)
