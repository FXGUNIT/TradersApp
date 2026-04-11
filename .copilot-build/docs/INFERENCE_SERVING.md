# Low-Latency Inference Serving (Triton)

This deployment path serves model predictions through NVIDIA Triton with gRPC and GPU acceleration.

## Architecture

- Dedicated Triton inference pods (`k8s/triton-deployment.yaml` or Helm `triton.enabled=true`)
- gRPC serving on port `8001` (HTTP/REST also exposed on `8000`)
- Dynamic batching enabled in generated `config.pbtxt`
- ONNX artifacts exported from `ml-engine/models/store` to `ml-engine/models/onnx`
- ML Engine inference path:
  - `triton` (primary)
  - `onnx_local` fallback
  - `sklearn_local` fallback

## Performance targets

- Trading path target: p99 <= 50-100ms under load
- Configurable threshold: `INFERENCE_P99_TARGET_MS` (default `100`)

## Benchmark and gate

Quick benchmark:

```bash
python -c "import sys; sys.path.insert(0,'ml-engine'); from inference.triton_client import TritonInferenceClient as C; print(C().benchmark(n_samples=1000,batch_size=32))"
```

CI/CD gate (fails build when strict mode is enabled and p99 exceeds target):

```bash
python ml-engine/scripts/inference_latency_gate.py --strict --target-p99-ms 100
```

Optional JSON artifact:

```bash
python ml-engine/scripts/inference_latency_gate.py --strict --json-out airflow/reports/inference_latency.json
```

## Helm values (key fields)

- `triton.enabled`
- `triton.cudaVisibleDevices`
- `triton.models.*.maxBatchSize`
- `triton.models.*.preferredBatchSizes`
- `triton.models.*.maxQueueDelayUs`
- `triton.inferenceLatencyTargetMs`

## Model optimization

Quantization/export options:

```bash
python -m ml_engine.inference.onnx_exporter --all
python -m ml_engine.inference.onnx_exporter --model lightgbm_direction --quantize fp16
python -m ml_engine.inference.onnx_exporter --model lightgbm_direction --quantize int8
```

Use quantized ONNX artifacts in Triton to reduce latency and increase throughput.
