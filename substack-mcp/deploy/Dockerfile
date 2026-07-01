# substack-mcp — production image. No secrets baked in; injected at runtime from the secret store.
FROM node:20-slim

WORKDIR /app

# Install deps first for layer caching.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# App source. The converter (tools/gen-substack-draft.js) is expected at build/run time via
# GEN_SUBSTACK_DRAFT; copy it in during the build in the private repo, or mount it.
COPY src ./src

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# SUBSTACK_COOKIE, MCP_AUTH_TOKEN, SUBSTACK_PUBLICATION, GEN_SUBSTACK_DRAFT come from env at runtime.
CMD ["node", "src/server.js"]
