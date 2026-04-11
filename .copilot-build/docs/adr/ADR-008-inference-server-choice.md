# ADR-008: Triton + vLLM for Model Inference

**ADR ID:** ADR-008
**Title:** Triton + vLLM for Model Inference
**Status:** Accepted
**Date:** 2026-04-06
**Author:** Claude

## Context

The TradersApp ML system requires efficient model inference for:
- **Direction models** (LightGBM, XGBoost): Binary classification (LONG/SHORT/NEUTRAL)
- **Regime detection** (HMM, FP-FK, Anomalous Diffusion): Multi-class classification
- **Magnitude prediction** (regression): Expected price move percentage
- **Alpha scoring**: Custom alpha factor combination
- **Session probability**: Multi-class session classification
- **LLM integration** (optional): AI explanation generation

Each model type has different requirements:
- LightGBM/XGBoost: CPU inference, fast, small models
- PyTorch models (HMM, custom): GPU preferred, moderate size
- vLLM: GPU required, high memory, LLM inference only

## Decision

We will use a **dual inference server architecture**:

### 1. Triton Inference Server (NVIDIA)

For traditional ML models (LightGBM, XGBoost, PyTorch):
- ONNX Runtime backend for LightGBM/XGBoost
- PyTorch backend for neural models
- TensorRT backend for optimized GPU inference

### 2. vLLM

For LLM inference (AI explanations, natural language output):
- OpenAI-compatible API
- HuggingFace model support
- PagedAttention for memory efficiency

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Inference Layer                          │
├─────────────────────────────────────────────────────────────┤
│  ML Engine (FastAPI) — Port 8001                             │
│  ├── Routes requests to appropriate inference server        │
│  ├── Handles model orchestration (consensus, ensemble)       │
│  └── Returns normalized response format                     │
├─────────────────────────────────────────────────────────────┤
│           │                           │                     │
│           ▼                           ▼                     │
│  ┌──────────────────┐      ┌──────────────────┐              │
│  │ Triton Server    │      │ vLLM Server     │              │
│  │ Port 8002        │      │ Port 8003       │              │
│  │                  │      │                 │              │
│  │ Models:          │      │ Models:          │              │
│  │ - direction_*    │      │ - llm-explain   │              │
│  │ - regime_*      │      │                 │              │
│  │ - magnitude_*   │      │                 │              │
│  │ - session_*     │      │                 │              │
│  │ - alpha_*       │      │                 │              │
│  └──────────────────┘      └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### Model Repository Structure

```
/models/
├── direction/
│   ├── 1/
│   │   └── model.onnx
│   └── 2/
│       └── model.onnx
├── regime/
│   ├── hmm/
│   │   └── model.pt
│   ├── fp_fk/
│   │   └── model.pt
│   └── ensemble/
│       └── model.pt
├── magnitude/
│   └── ...
├── session/
│   └── ...
├── alpha/
│   └── ...
└── config.pbtxt  # Triton config for each model type
```

### Triton Configuration

```protobuf
# config.pbtxt (example for direction model)
name: "direction_lgb"
platform: "onnx_runtime_onnx"
max_batch_size: 64

dynamic_batching {
  preferred_batch_size: [16, 32, 64]
  max_queue_delay_microseconds: 100
}

instance_group {
  count: 2
  kind: KIND_GPU
}

input [
  {
    name: "features"
    data_type: TYPE_FP32
    dims: [128]  # Feature dimension
  }
]

output [
  {
    name: "signal"
    data_type: TYPE_INT64
    dims: [1]
  },
  {
    name: "confidence"
    data_type: TYPE_FP32
    dims: [1]
  }
]
```

## Consequences

### Positive
- **GPU utilization:** Triton optimizes GPU memory and compute
- **Dynamic batching:** Aggregates requests for efficient batch inference
- **Model versioning:** Native support for multiple model versions
- **Multi-backend:** Supports ONNX, PyTorch, TensorRT, Python backends
- **OpenAI-compatible API:** vLLM provides OpenAI-compatible endpoint
- **Memory efficiency:** vLLM's PagedAttention reduces memory waste
- **Ensemble support:** Triton can run model ensembles natively

### Negative
- **GPU requirement:** Production inference requires GPU hardware
- **Container complexity:** Multiple inference containers increase orchestration
- **Cold start:** Model loading takes time on Triton startup
- **ONNX conversion:** LightGBM/XGBoost need conversion to ONNX format
- **vLLM resource hungry:** LLM models require significant GPU memory

### Neutral
- Triton adds ~10ms latency for orchestration layer
- Need to manage GPU memory between Triton and vLLM
- Model updates require Triton model warmup

## Alternatives Considered

### TF Serving (TensorFlow Serving)
- Pros: Mature, excellent for TensorFlow models
- Cons: No native LightGBM/XGBoost support, heavier than Triton
- **Rejected** because we primarily use LightGBM/XGBoost, not TensorFlow

### TorchServe
- Pros: Native PyTorch support, simpler for PyTorch models
- Cons: No ONNX backend, less mature than Triton, limited batching
- **Rejected** because we need ONNX support for LightGBM

### Batching via Celery/RQ
- Pros: Simple to implement, uses existing ML Engine
- Cons: No GPU optimization, ad-hoc batching logic
- **Rejected** because GPU efficiency is critical for production latency

### Online-only inference (no separate server)
- Pros: Simpler architecture, no additional services
- Cons: No GPU optimization, model loading on every request
- **Rejected** because we need efficient batch inference with GPU

## References

- [Triton Inference Server Documentation](https://docs.nvidia.com/deeplearning/triton-inference-server/)
- [vLLM Documentation](https://docs.vllm.ai/)
- [ONNX Runtime Integration with Triton](https://github.com/triton-inference-server/server/blob/main/docs/user_guide/onnx.md)
- Related ADRs: [ADR-007 Feast](ADR-007-feast-choice.md) (feeds features to inference), [ADR-012 Continual Learning](ADR-012-continual-learning.md) (model updates to Triton)
