FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8788
ENV ML_ENGINE_URL=http://ml-engine:8001

RUN apk upgrade --no-cache \
    && addgroup -S tradersapp \
    && adduser -S tradersapp -G tradersapp \
    && apk add --no-cache gosu

COPY bff/package.json bff/package-lock.json ./bff/
WORKDIR /app/bff
RUN npm ci --omit=dev \
    && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

WORKDIR /app
COPY bff/ ./bff/
COPY proto/ ./proto/

RUN mkdir -p /app/runtime /app/board-room /app/bff/data \
    && chown -R tradersapp:tradersapp /app \
    && chmod -R 755 /app/runtime /app/board-room /app/bff/data

COPY bff/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod 755 /app/docker-entrypoint.sh

EXPOSE 8788

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8788/health >/dev/null 2>&1 || busybox wget -qO- http://127.0.0.1:8788/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["node", "bff/server.mjs"]
