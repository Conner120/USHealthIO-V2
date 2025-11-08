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
# Move pruned files to /app
RUN mkdir /app && mv out/* /app
WORKDIR /app
# Install dependencies
RUN bun install --production
### --- Runtime stage ---
FROM oven/bun:1.3-slim AS runtime
RUN apt-get update && apt-get install curl gunzip unzip -y
# Copy only necessary files from base stage
COPY --from=base /app /app
WORKDIR /app/apps/hdas
# Expose necessary ports
EXPOSE 3000
# Start the application
CMD ["bun", "run", "start"]