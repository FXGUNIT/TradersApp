FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8788
ENV ML_ENGINE_URL=http://ml-engine:8001

RUN addgroup -S tradersapp && adduser -S tradersapp -G tradersapp

COPY bff/package.json bff/package-lock.json ./bff/
WORKDIR /app/bff
RUN npm ci --omit=dev

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
