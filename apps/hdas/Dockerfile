# syntax=docker/dockerfile:1.4

### --- Base stage ---
FROM oven/bun:1.3 AS base

# Copy the full monorepo (for turbo prune)
COPY . .

# Install Turbo globally
RUN bun add --global turbo

# Prune dependencies for only this app
ARG APP_NAME=hdas
RUN turbo prune --scope=${APP_NAME}
### --- Dependencies stage ---
FROM oven/bun:1.3 AS dependencies
COPY --from=base /out/apps/${APP_NAME} ./
RUN bun install --frozen-lockfile
### --- Production stage ---
FROM oven/bun:1.3 AS production
COPY --from=base /out/apps/hdas/ ./apps/hdas/
ARG APP_NAME=hdas
RUN bun run turbo run build --filter=./apps/${APP_NAME}...
ENV NODE_ENV=production
WORKDIR /apps/hdas
CMD ["bun", "run", "start"] 