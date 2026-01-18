# syntax=docker/dockerfile:1.4

### --- Base stage ---
FROM oven/bun:1.3 AS base
WORKDIR /app
# Copy the full monorepo (for turbo prune)
COPY apps ./apps
COPY packages ./packages
COPY turbo.json .
COPY bun.lock .
COPY package.json .
RUN apt-get update -y && apt-get install -y openssl curl gzip unzip coreutils libc6
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
COPY parser-tools/parser-rs/build.rs ./parser-tools/parser-rs/build.rs
COPY parser-tools/parser-rs/Cargo.toml ./parser-tools/parser-rs/Cargo.toml
COPY parser-tools/parser-rs/src ./parser-tools/parser-rs/src
WORKDIR /app/parser-tools/parser-rs
RUN cargo build --release
# Install Turbo globally
RUN bun add --global turbo
RUN bun install
RUN cd packages/database && bun generate
WORKDIR /app/apps/hdas
RUN bun install
CMD [ "bun", "start" ]