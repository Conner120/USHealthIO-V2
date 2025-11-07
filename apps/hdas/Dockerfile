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
RUN bun turbo prune --scope=$APP_NAME --docker

### --- Builder stage ---
FROM oven/bun:1.3 AS builder
WORKDIR /repo
ARG APP_NAME=hdas

# Copy pruned dependency files
COPY --from=base /repo/out/json/ ./
COPY --from=base /repo/out/bun.lockb ./bun.lockb
RUN bun install --frozen-lockfile

# Copy pruned source
COPY --from=base /repo/out/full/ ./

# Build the app
RUN bun run build --filter=$APP_NAME

### --- Runner stage ---
FROM oven/bun:1.3 AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG APP_NAME=hdas
EXPOSE 3000

# Copy built app
COPY --from=builder /repo/apps/${APP_NAME} ./

# Start app
CMD ["bun", "run", "start"]
