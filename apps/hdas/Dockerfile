# syntax=docker/dockerfile:1.4

### --- Base stage ---
FROM oven/bun:1.3 AS base
WORKDIR /repo

# Copy the full monorepo (for turbo prune)
COPY . .

# Install Turbo globally
RUN bun add --global turbo

# Prune dependencies for only this app
ARG APP_NAME=hdas
RUN turbo prune --scope=./apps/${APP_NAME} -f ./Dockerfile --base=base --include-deps
### --- Dependencies stage ---
FROM oven/bun:1.3 AS dependencies
WORKDIR /repo
COPY --from=base /repo/out/full/ ./
RUN bun install --frozen-lockfile
### --- Production stage ---
FROM oven/bun:1.3 AS production
WORKDIR /repo
COPY --from=dependencies /repo/ ./
COPY --from=base /repo/apps/hdas/ ./apps/hdas/
ARG APP_NAME=hdas
RUN bun run turbo run build --filter=./apps/${APP_NAME}...
ENV NODE_ENV=production
WORKDIR /repo/apps/hdas
CMD ["bun", "run", "start"] 