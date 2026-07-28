# Evermesh monorepo task runner. Install `just`: https://github.com/casey/just

# List available recipes
default:
    @just --list

# Install JS dependencies
setup:
    pnpm install

# Run all Rust and JS tests
test: test-rust test-js

# crates/evermesh-node embeds its frontend at compile time
# (`tauri::generate_context!()`, `frontendDist: "./ui"`, gitignored —
# see .gitignore); build it before any cargo command touches that crate.
node-web-build:
    pnpm --filter @evermesh/node-web build

test-rust: node-web-build
    cargo test --workspace

test-js:
    pnpm -r --if-present test

# Lint everything (rustfmt, clippy, JS lint)
lint: node-web-build
    cargo fmt --all --check
    cargo clippy --workspace --all-targets -- -D warnings
    pnpm -r --if-present lint

# Format all Rust code
fmt:
    cargo fmt --all

# Render the protocol spec to PDF (requires pandoc + tectonic)
spec-pdf:
    mkdir -p dist
    pandoc -d spec/pandoc-pdf.yaml spec/draft-evermesh-protocol-00.md -o dist/evermesh-protocol-draft-00.pdf
    @echo "wrote dist/evermesh-protocol-draft-00.pdf"

# Build the WASM kernel bindings into packages/kernel-ts/wasm
wasm:
    pnpm --filter @evermesh/kernel build:wasm

# Local smoke run (relay blob sidecar + gateway) — see README "Smoke run"
dev:
    @echo "See the 'Smoke run' section in README.md: boots a relay with the"
    @echo "blob sidecar and the gateway server against it (no ffmpeg needed)."

# Changing the corpus must change tools/conformance/coverage.json too — that
# is deliberate; see tools/conformance/README.md "Coverage is asserted".
# (Re)generate the deterministic conformance vectors
conformance-generate:
    cargo run --bin generate

# `cargo test --workspace` already runs this target via
# tools/conformance/tests/kernel_conformance.rs; this recipe is the table.
# Conformance vs the in-process kernel (reference target)
conformance:
    cargo run --bin evermesh-conformance -- run --target kernel

# Same vectors against @evermesh/kernel under Node — needs `just wasm` first.
conformance-node:
    cargo run --bin evermesh-conformance -- run --target node

# Same vectors against a live relay's /sync. Pass a URL to point elsewhere.
conformance-relay url="ws://127.0.0.1:8787/sync":
    cargo run --bin evermesh-conformance -- run --target relay --relay-url {{url}}

# Requires `just wasm` and a relay already listening on the default URL.
# The golden rule in full: the same vectors against all three runtimes
conformance-all: conformance conformance-node conformance-relay

# Copy spec/ + docs into site/docs (the site is deployable on its own)
site-docs:
    node tools/site/sync-docs.mjs

# Verify the site in a real browser: console errors, links, every docs route
site-check:
    node tools/site/sync-docs.mjs --check
    node tools/site/check.mjs

# Same, and refresh site/screenshots/
site-shots:
    node tools/site/check.mjs --shots

# Screenshot the gateway reference UI against a stubbed API
# (site/screenshots/ui-{dark,light}.png) — build first.
ui-shots:
    pnpm --filter @evermesh/gateway-web build
    node tools/brand/ui-shots.mjs

# Screenshot the desktop (Tauri) node client against a stubbed IPC
# boundary (site/screenshots/ui-node-{dark,light}.png) — build first.
node-shots:
    pnpm --filter @evermesh/node-web build
    node tools/brand/node-shots.mjs

# Refresh every screenshot in site/screenshots/
shots: site-shots ui-shots node-shots

# Re-render the raster brand exports (OG card, apple-touch-icon)
brand:
    node tools/brand/render.mjs

# Serve site locally at http://127.0.0.1:8080
site-serve:
    cd site && python3 -m http.server 8080
