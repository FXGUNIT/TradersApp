FROM node:20-alpine

WORKDIR /app

# Install dependencies (BFF uses only Node.js built-ins — no external packages)
COPY bff/package.json ./
RUN npm install --omit=dev --prefer-offline 2>/dev/null || true

# Copy bff source
COPY bff/ ./

# Environment
ENV NODE_ENV=production
ENV PORT=8788
ENV ML_ENGINE_URL=http://ml-engine:8001

# Expose port
EXPOSE 8788

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8788/health || exit 1

# Start
CMD ["node", "server.mjs"]
