# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy dependency manifests
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/cli/package.json ./packages/cli/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN npm ci

# Copy source code and configurations
COPY tsconfig.base.json ./
COPY packages/core ./packages/core
COPY packages/cli ./packages/cli
COPY apps/api ./apps/api
COPY apps/web ./apps/web
COPY fixtures ./fixtures

# Build all packages and web frontend
RUN npm run build:core && \
    npm run build --workspace=@greenwash/cli && \
    npm run build --workspace=@greenwash/api && \
    npm run build --workspace=@greenwash/web

# Prune devDependencies for production
RUN npm prune --omit=dev

# --- Production Runner Stage ---
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Copy production dependencies and built artifacts
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/packages/cli/dist ./packages/cli/dist
COPY --from=builder /app/packages/cli/package.json ./packages/cli/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/fixtures ./fixtures

EXPOSE 3001

# Run the single-port unified server (API + Web UI)
CMD ["node", "apps/api/dist/server.js"]
