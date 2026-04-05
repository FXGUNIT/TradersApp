# ONNX + Triton Inference Workflow

**Last Updated:** 2026-04-06

---

## Overview

This document describes the complete workflow for exporting ML models to ONNX and serving them via NVIDIA Triton Inference Server in TradersApp.

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  sklearn pipeline   │     │   ONNX Runtime        │     │  Triton Server   │
│  (trainer.py)       │────▶│   (onnx_exporter.py) │────▶│  (GPU/CPU)       │
└─────────────────────┘     └──────────────────────┘     └─────────────────┘
         │                                                             │
         │ (model store)                                               │
         │                                                             │
         ▼                                                             ▼
┌─────────────────────┐                                     ┌─────────────────┐
│  ml-engine/models/   │                                     │  ml-engine:8001 │
│    store/            │                                     │  (FastAPI BFF)  │
└─────────────────────┘                                     └─────────────────┘
```

**Models served via ONNX Runtime on Triton:**
- `lightgbm_direction` — LightGBM, GPU-accelerated
- `xgboost_direction` — XGBoost, GPU-accelerated
- `rf_direction` — Random Forest, CPU
- `svm_direction` — SVM, CPU
- `mlp_direction` — MLP, CPU
- `amd_direction` — AMD Classifier (GaussianNB + Scaler), GPU

**Models served via Triton Python Backend:**
- `regime_ensemble` — HMM + FP-FK + Anomalous Diffusion (JSON I/O)
- `time_probability` — Session probability (JSON I/O)
- `move_magnitude` — Move magnitude estimator (JSON I/O)
- `mamba_ssm` — Mamba state-space model (TorchScript, GPU)

---

## 1. ONNX Export

### Prerequisites

```bash
pip install onnx onnxruntime scikit-learn>=1.3 lightgbm>=4.0
pip install onnxmltools  # For LightGBM fallback export
pip install onnxoptimizer  # Graph optimizations
```

### Export All Models

```bash
# 1. Train models first
python -m ml_engine.training.trainer

# 2. Export all models to ONNX
python -m ml_engine.inference.onnx_exporter --all

# 3. List exported models
python -m ml_engine.inference.onnx_exporter --list
```

### Export a Specific Model

```bash
python -m ml_engine.inference.onnx_exporter --model lightgbm_direction
```

### Quantization (optional)

```bash
# FP16 — 2x speedup, minimal accuracy loss
python -m ml_engine.inference.onnx_exporter --model lightgbm_direction --quantize fp16

# INT8 — 4x speedup, calibration recommended
python -m ml_engine.inference.onnx_exporter --model lightgbm_direction --quantize int8
```

Output: `ml-engine/models/onnx/lightgbm_direction_v3.onnx`

---

## 2. Copy to Triton Repository

The ONNX files must be copied to the Triton model repository before serving.

```bash
# Copy all ONNX models to their Triton directories
python scripts/export_onnx_to_triton.py --all

# Copy a specific model
python scripts/export_onnx_to_triton.py --model lightgbm_direction --version 1

# Dry run (preview without copying)
python scripts/export_onnx_to_triton.py --all --dry-run

# List current Triton repository state
python scripts/export_onnx_to_triton.py --list
```

Expected output:
```
TritonExport: Exported lightgbm_direction_v3.onnx → ml-engine/models/triton_repo/lightgbm_direction/1/model.onnx
```

**Triton directory structure:**
```
ml-engine/models/triton_repo/
  lightgbm_direction/
    config.pbtxt
    1/model.onnx
  xgboost_direction/
    config.pbtxt
    1/model.onnx
  regime_ensemble/
    config.pbtxt
    1/model.py          # Python backend (not ONNX)
  mamba_ssm/
    config.pbtxt
    1/model.pt          # TorchScript
    model.meta.json
```

---

## 3. Triton Server

### Local Development

```bash
# Pull Triton Docker image
docker pull nvcr.io/nvidia/tritonserver:24.04-py3

# Start Triton with model repository
docker run --gpus all \
  --rm -p 8000:8000 -p 8001:8001 -p 8002:8002 \
  -v $(pwd)/ml-engine/models/triton_repo:/models \
  nvcr.io/nvidia/tritonserver:24.04-py3 \
  tritonserver --model-repository=/models

# Verify server is ready
curl http://localhost:8000/v2/models/lightgbm_direction
```

### Kubernetes

```bash
# Deploy via Helm (Triton enabled in values.yaml)
helm upgrade --install tradersapp ./k8s/helm/tradersapp \
  --set triton.enabled=true \
  -f values.prod.yaml

# Check Triton pods
kubectl get pods -n tradersapp -l app=triton

# View Triton logs
kubectl logs -n tradersapp deployment/tradersapp-triton --tail=50
```

### Health Checks

```bash
# Model metadata
curl http://localhost:8000/v2/models/lightgbm_direction

# Server status
curl http://localhost:8000/v2/health/live
curl http://localhost:8000/v2/health/ready

# Inference
curl -X POST http://localhost:8000/v2/models/lightgbm_direction/infer \
  -H "Content-Type: application/octet-stream" \
  --data-binary @input_tensor.bin
```

---

## 4. Model Config Reference

### ONNX Runtime Backend (config.pbtxt)

```protobuf
name: "lightgbm_direction"
platform: "onnxruntime_onnx"
max_batch_size: 64

input [
  {
    name: "input"
    data_type: TYPE_FP32
    dims: [44]        # Match FEATURE_COLS count
  }
]

output [
  {
    name: "prob_long"
    data_type: TYPE_FP32
    dims: [1]
  },
  {
    name: "prob_short"
    data_type: TYPE_FP32
    dims: [1]
  }
]

instance_group [
  { count: 2 kind: KIND_GPU gpus: [0] }
]

dynamic_batching {
  preferred_batch_size: [1, 8, 16, 32, 64]
  max_queue_delay_microseconds: 1000
}
```

### Python Backend (config.pbtxt)

```protobuf
name: "regime_ensemble"
backend: "python"
max_batch_size: 16

input [
  {
    name: "json_input"
    data_type: TYPE_STRING
    dims: [-1]
  }
]
# ... outputs ...

instance_group [{ count: 1 kind: KIND_CPU }]
```

---

## 5. gRPC Integration (Triton → ML Engine → BFF)

Triton serves ONNX models, ML Engine wraps them with feature engineering and consensus aggregation.

```
BFF (port 8788)
  └─ gRPC ──▶ analysis-server.mjs (port 50051)
                  └─ gRPC ──▶ Triton (port 8001)
                              └─ ONNX Runtime (GPU)
```

**Proto generation:**
```bash
# Python stubs (ml-engine)
python scripts/generate_python_proto.py

# JavaScript stubs (BFF)
cd bff && npm run generate-grpc
```

**Verify stubs:**
```bash
python scripts/generate_python_proto.py --verify
```

---

## 6. Benchmarking

```bash
# Basic benchmark
python -m ml_engine.inference.benchmark_latency \
  --endpoint http://localhost:8001/predict \
  --n-requests 100 --concurrency 10

# Load test at multiple concurrency levels
python -m ml_engine.inference.benchmark_latency \
  --endpoint http://localhost:8001/predict \
  --load-test --concurrency-levels 1,10,50,100

# Benchmark Triton directly (HTTP)
python -m ml_engine.inference.benchmark_latency \
  --endpoint http://localhost:8000/v2/models/lightgbm_direction/infer \
  --transport triton-http --model lightgbm_direction
```

**SLA thresholds:**
| Model | P95 Latency | P99 Latency |
|-------|-------------|-------------|
| lightgbm_direction | < 50ms | < 100ms |
| xgboost_direction | < 50ms | < 100ms |
| amd_direction | < 30ms | < 50ms |
| time_probability | < 30ms | < 50ms |
| regime_ensemble | < 1000ms | < 2000ms |
| consensus | < 200ms | < 500ms |

---

## 7. CI/CD Integration

Add ONNX export to the training pipeline:

```yaml
# .github/workflows/train.yml
- name: Export ONNX models
  run: |
    python -m ml_engine.inference.onnx_exporter --all
    python scripts/export_onnx_to_triton.py --all

- name: Validate ONNX models
  run: |
    python -c "
    import onnxruntime as ort
    import numpy as np
    sess = ort.InferenceSession('ml-engine/models/onnx/lightgbm_direction_v3.onnx')
    inputs = [inp.name for inp in sess.get_inputs()]
    outputs = [out.name for out in sess.get_outputs()]
    print(f'Inputs: {inputs}, Outputs: {outputs}')
    X = np.random.randn(1, 44).astype(np.float32)
    result = sess.run(outputs, {inputs[0]: X})
    print(f'Inference OK: {[r.shape for r in result]}')
    "
```

---

## 8. Troubleshooting

### ONNX export fails
```bash
# Check sklearn pipeline structure
python -c "
from training.model_store import ModelStore
store = ModelStore()
pipeline, meta = store.load('lightgbm_direction', 'latest')
print(pipeline.named_steps)
print(meta.get('feature_cols', [])[:5])
"

# Try fallback export path
pip install onnxmltools
python -m ml_engine.inference.onnx_exporter --model lightgbm_direction
```

### Triton model not loading
```bash
# Check model repository structure
ls -la ml-engine/models/triton_repo/lightgbm_direction/1/

# Validate ONNX model
python -c "
import onnx
model = onnx.load('ml-engine/models/triton_repo/lightgbm_direction/1/model.onnx')
onnx.checker.check_model(model)
print('Model is valid')
"

# View Triton server logs
docker logs <container-id> --tail=100
```

### Triton returns wrong output shape
```bash
# Check config.pbtxt dims match ONNX model
python -c "
import onnxruntime as ort
sess = ort.InferenceSession('ml-engine/models/triton_repo/lightgbm_direction/1/model.onnx')
for inp in sess.get_inputs():
    print(f'Input: {inp.name} {inp.shape} {inp.type}')
for out in sess.get_outputs():
    print(f'Output: {out.name} {out.shape} {out.type}')
"
# Compare with config.pbtxt dims
```

### GPU memory issues
```bash
# Set GPU memory fraction
docker run --gpus all \
  --env CUDA_VISIBLE_DEVICES=0 \
  nvcr.io/nvidia/tritonserver:24.04-py3 \
  tritonserver --model-repository=/models \
  --gpu-memory-fraction=0.90

# Kubernetes: adjust resources in values.yaml
```
