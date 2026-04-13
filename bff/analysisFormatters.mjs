/**
 * analysisFormatters.mjs
 * All normalization helpers, payload builders, and response formatters
 * for the analysis gRPC service.
 */

// ─── Normalization helpers ────────────────────────────────────────────────────

export function numberMap(values) {
  const mapped = {};
  for (const [key, value] of Object.entries(values || {})) {
    const num = Number(value);
    if (Number.isFinite(num)) {
      mapped[key] = num;
    }
  }
  return mapped;
}

export function stringMap(values) {
  const mapped = {};
  for (const [key, value] of Object.entries(values || {})) {
    if (value === null || value === undefined) {
      continue;
    }
    mapped[key] = String(value);
  }
  return mapped;
}

// ─── ML Engine payload builders ─────────────────────────────────────────────

export function toPredictPayload(request) {
  return {
    symbol: String(request?.symbol || "MNQ"),
    session_id: Number(request?.session_id || 1),
    candles: Array.isArray(request?.candles) ? request.candles : [],
    trades: Array.isArray(request?.trades) ? request.trades : [],
    math_engine_snapshot: numberMap(request?.features || {}),
    key_levels: {},
  };
}

export function toGrpcConsensusResponse(payload) {
  const voteConfidences = {};
  for (const [modelName, vote] of Object.entries(payload?.votes || {})) {
    const confidence = Number(vote?.confidence);
    if (Number.isFinite(confidence)) {
      voteConfidences[modelName] = confidence;
    }
  }

  const regimeValue =
    typeof payload?.physics_regime === "string"
      ? payload.physics_regime
      : payload?.physics_regime?.regime || "";

  return {
    signal: String(payload?.signal || "NEUTRAL"),
    confidence: Number(payload?.confidence || 0.5),
    models_used: Number(
      payload?.models_used || Object.keys(payload?.votes || {}).length || 0,
    ),
    data_trades_analyzed: Number(payload?.data_trades_analyzed || 0),
    model_freshness: String(payload?.model_freshness || "unknown"),
    timing: stringMap(payload?.timing || {}),
    vote_confidences: voteConfidences,
    regime: String(regimeValue),
  };
}

// ─── Prometheus metrics formatter ────────────────────────────────────────────

/**
 * Formats Prometheus /metrics text output.
 * @param {object} metricsState - { requestsTotal, errorsTotal, latencyMs, cbState, mlHealthy }
 * @param {object} cbState      - { state, failures, lastFailure }
 */
export function getPrometheusMetrics(metricsState, cbState) {
  const { requestsTotal, errorsTotal, latencyMs, mlHealthy } = metricsState;
  const { state: cb_state, failures: cb_failures } = cbState;

  const lines = [
    "# HELP analysis_service_requests_total Total gRPC requests by endpoint",
    "# TYPE analysis_service_requests_total counter",
  ];

  for (const [endpoint, count] of Object.entries(requestsTotal.byEndpoint)) {
    lines.push(
      `analysis_service_requests_total{endpoint="${endpoint}"} ${count}`,
    );
  }
  lines.push(
    `analysis_service_requests_total{endpoint="unknown"} ${
      requestsTotal.total -
      Object.values(requestsTotal.byEndpoint).reduce((a, b) => a + b, 0)
    }`,
  );

  lines.push("");
  lines.push("# HELP analysis_service_errors_total Total errors by endpoint");
  lines.push("# TYPE analysis_service_errors_total counter");
  for (const [endpoint, count] of Object.entries(errorsTotal.byEndpoint)) {
    lines.push(
      `analysis_service_errors_total{endpoint="${endpoint}"} ${count}`,
    );
  }

  lines.push("");
  lines.push(
    "# HELP analysis_service_latency_ms Request latency in milliseconds",
  );
  lines.push("# TYPE analysis_service_latency_ms histogram");
  lines.push(`analysis_service_latency_ms_sum ${latencyMs.sum}`);
  lines.push(`analysis_service_latency_ms_count ${latencyMs.count}`);
  lines.push(
    `analysis_service_latency_ms_avg ${
      latencyMs.count > 0
        ? (latencyMs.sum / latencyMs.count).toFixed(2)
        : 0
    }`,
  );

  lines.push("");
  lines.push(
    "# HELP analysis_service_circuit_breaker_state Circuit breaker state (0=closed, 1=half-open, 2=open)",
  );
  lines.push("# TYPE analysis_service_circuit_breaker_state gauge");
  const cbStateVal = cb_state === "CLOSED" ? 0 : cb_state === "HALF_OPEN" ? 1 : 2;
  lines.push(`analysis_service_circuit_breaker_state ${cbStateVal}`);
  lines.push(`analysis_service_circuit_breaker_failures ${cb_failures}`);

  lines.push("");
  lines.push(
    "# HELP analysis_service_ml_engine_up Whether ML Engine is reachable",
  );
  lines.push("# TYPE analysis_service_ml_engine_up gauge");
  lines.push(`analysis_service_ml_engine_up ${mlHealthy ? 1 : 0}`);

  return lines.join("\n");
}
