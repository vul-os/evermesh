# boloka-relay container image.
#
# boloka-relay depends on boloka-kernel via a workspace path
# dependency, so the build context for this Dockerfile MUST be the
# repository root, not this crate directory, e.g.:
#
#   docker build -f crates/boloka-relay/Dockerfile -t boloka-relay .
#
# (docker-compose.yml at the repo root does this already.)

FROM rust:1-bookworm AS build
WORKDIR /workspace

# Workspace manifests and lockfile first, for layer caching.
COPY Cargo.toml Cargo.lock ./
COPY crates/boloka-kernel ./crates/boloka-kernel
COPY crates/boloka-relay ./crates/boloka-relay
COPY crates/boloka-wasm ./crates/boloka-wasm
COPY crates/boloka-node ./crates/boloka-node

RUN cargo build --release -p boloka-relay

FROM debian:bookworm-slim AS runtime

# ca-certificates: gossip peers are typically wss:// (TLS); wget: used
# by the compose healthcheck against GET /info.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates wget \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /workspace/target/release/boloka-relay /usr/local/bin/boloka-relay

ENV BOLOKA_RELAY_CONFIG=/etc/boloka/relay.json
VOLUME ["/data"]
EXPOSE 8787

ENTRYPOINT ["/usr/local/bin/boloka-relay"]
