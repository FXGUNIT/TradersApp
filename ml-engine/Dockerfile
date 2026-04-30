<<<<<<< HEAD
FROM python:3.11-slim-trixie AS builder
=======
FROM python:3.11.13-slim-bookworm
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

<<<<<<< HEAD
WORKDIR /build

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends gcc g++ \
=======
# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

<<<<<<< HEAD
RUN python -m venv "${VIRTUAL_ENV}" \
    && pip install --no-cache-dir pip==26.1 setuptools==82.0.1 wheel==0.47.0 \
    && pip install --no-cache-dir -r requirements.txt --timeout=300 \
    && pip uninstall -y wheel setuptools pip

FROM python:3.11-slim-trixie AS runtime

ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PORT=8001
ENV MODEL_STORE_PVC_MOUNT=""

WORKDIR /app

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends curl libgomp1 \
    && (python -m pip uninstall -y wheel setuptools pip || true) \
    && rm -rf /usr/local/lib/python*/site-packages/pip \
        /usr/local/lib/python*/site-packages/pip-*.dist-info \
        /usr/local/lib/python*/site-packages/setuptools \
        /usr/local/lib/python*/site-packages/setuptools-*.dist-info \
        /usr/local/lib/python*/site-packages/wheel \
        /usr/local/lib/python*/site-packages/wheel-*.dist-info \
        /usr/local/bin/pip* \
        /usr/local/bin/wheel \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
COPY . .

RUN mkdir -p /app/data /app/model_store
=======
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
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

EXPOSE 8001

<<<<<<< HEAD
=======
# Health check via curl (fast, no Python overhead)
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:${PORT:-8001}/health || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
