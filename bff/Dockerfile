<<<<<<< HEAD
FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8788
ENV ML_ENGINE_URL=http://ml-engine:8001

RUN apk upgrade --no-cache \
    && addgroup -S tradersapp \
    && adduser -S tradersapp -G tradersapp

COPY bff/package.json bff/package-lock.json ./bff/
WORKDIR /app/bff
RUN npm ci --omit=dev \
    && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

WORKDIR /app
COPY bff/ ./bff/
COPY proto/ ./proto/

RUN mkdir -p /app/runtime /app/board-room /app/bff/data \
    && chown -R tradersapp:tradersapp /app

USER tradersapp

EXPOSE 8788

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8788/health >/dev/null 2>&1 || busybox wget -qO- http://127.0.0.1:8788/health >/dev/null 2>&1 || exit 1

CMD ["node", "bff/server.mjs"]
=======
FROM node:20-slim

WORKDIR /app

# Install dependencies (BFF uses only Node.js built-ins — no external packages)
COPY bff/package.json ./
RUN npm install --omit=dev --prefer-offline 2>/dev/null || true

# Copy bff source
COPY bff/ ./

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
ARG BFF_ADMIN_PASS_HASH
ARG MASTER_SALT
ARG ML_ENGINE_URL

# Environment — use build args if present, otherwise Railway/Infisical will set at runtime
ENV NODE_ENV=production
ENV PORT=8788
ENV ML_ENGINE_URL=${ML_ENGINE_URL:-http://ml-engine:8001}
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
ENV BFF_ADMIN_PASS_HASH=${BFF_ADMIN_PASS_HASH:-}
ENV MASTER_SALT=${MASTER_SALT:-}

# Expose port
EXPOSE 8788

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8788/health || exit 1

# Start
CMD ["node", "server.mjs"]
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
