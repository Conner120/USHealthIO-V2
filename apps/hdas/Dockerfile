# syntax=docker/dockerfile:1.4

### --- Base stage ---
FROM oven/bun:1.3 AS base
WORKDIR /app
# Copy the full monorepo (for turbo prune)
COPY . .

# Install Turbo globally
RUN bun add --global turbo
RUN bun install
RUN cd packages/database && bun generate
WORKDIR /app/apps/hdas
RUN bun install
CMD [ "bun", "start" ]