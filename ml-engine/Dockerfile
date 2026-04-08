FROM python:3.11.13-slim-bookworm

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
# Use Tsinghua PyPI mirror + 300s timeout for slow networks
RUN pip install --no-cache-dir -r requirements.txt \
    --timeout=300 \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    --trusted-host pypi.tuna.tsinghua.edu.cn

# Build args (secrets injected at Docker build time from GitHub Actions)
ARG AI_GEMINI_PRO_KEY
ARG AI_GROQ_TURBO_KEY
ARG AI_OPENROUTER_MIND_ALPHA
ARG AI_OPENROUTER_MIND_BETA
ARG AI_CEREBRAS_KEY
ARG AI_DEEPSEEK_KEY
ARG AI_SAMBANOVA_KEY
ARG FINNHUB_API_KEY
ARG NEWS_API_KEY

# Copy ml-engine
COPY . .

# Create data directory and model store
RUN mkdir -p /app/data /app/model_store

# Model store PVC mount path (set by k8s deployment when ml-models-pvc is mounted)
# In k8s: the PVC is mounted at /models, so MODEL_STORE=/models/store
# Local dev: not set, falls back to ml-engine/models/store
ENV MODEL_STORE_PVC_MOUNT=""

# Environment — use build args if present, otherwise Railway/Infisical will set at runtime
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PORT=8001
# AI Provider keys (injected at Docker build time)
ENV AI_GEMINI_PRO_KEY=${AI_GEMINI_PRO_KEY:-}
ENV AI_GROQ_TURBO_KEY=${AI_GROQ_TURBO_KEY:-}
ENV AI_OPENROUTER_MIND_ALPHA=${AI_OPENROUTER_MIND_ALPHA:-}
ENV AI_OPENROUTER_MIND_BETA=${AI_OPENROUTER_MIND_BETA:-}
ENV AI_CEREBRAS_KEY=${AI_CEREBRAS_KEY:-}
ENV AI_DEEPSEEK_KEY=${AI_DEEPSEEK_KEY:-}
ENV AI_SAMBANOVA_KEY=${AI_SAMBANOVA_KEY:-}
ENV FINNHUB_API_KEY=${FINNHUB_API_KEY:-}
ENV NEWS_API_KEY=${NEWS_API_KEY:-}

# Expose port
EXPOSE 8001

# Health check via curl (fast, no Python overhead)
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:${PORT:-8001}/health || exit 1

# Run
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
