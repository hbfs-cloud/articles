FROM node:22-alpine

WORKDIR /app

# Copy only what's needed (no .git, no videos, no heavy data)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || true

COPY tools/trading-executor/ ./tools/trading-executor/
COPY tools/gen-trading-plan.js ./tools/gen-trading-plan.js
COPY tools/build-broker-map.js ./tools/build-broker-map.js
COPY data/modes-config.json ./data/modes-config.json
COPY data/scanner-positions.json ./data/scanner-positions.json
COPY data/broker-instruments.json ./data/broker-instruments.json
COPY portfolio/v1/ ./portfolio/v1/

# Runtime env (override at deploy)
ENV MODE=balanced
ENV BROKER=paper
ENV CAPITAL_USD=10000
ENV VERBOSE=false
ENV LOG_DIR=/app/data/execution-logs

RUN mkdir -p /app/data/execution-logs /app/data/trading-plans

CMD ["node", "tools/trading-executor/daemon.js"]
