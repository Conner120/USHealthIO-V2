# syntax=docker/dockerfile:1.4

### --- Base stage ---
FROM oven/bun:1.3 AS base

# Copy the full monorepo (for turbo prune)
COPY . .

# Install Turbo globally
RUN bun add --global turbo
RUN bun install
RUN cd packages/database && bun generate
WORKDIR /apps/hdas
CMD [ "bun", "src/index.ts" ]