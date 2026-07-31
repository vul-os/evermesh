# Architecture (for contributors)

This page is repo structure and test strategy, for someone about to send a
PR. It duplicates nothing in [Concepts](CONCEPTS.md) (the protocol model,
in plain language) or [`spec/`](../spec/README.md) (the normative wire
format) — read those for *what the protocol says*; read this for *where
the code that implements it lives and how it's proven correct*. It is
intentionally **not** published to `site/docs/` (see
[`tools/site/sync-docs.mjs`](../tools/site/sync-docs.mjs)'s `DOCS` list) —
it's for people working in the repo, not readers of the spec.

## Repo layout

```
evermesh/
├── spec/                normative protocol spec (000–011 + draft), CC-BY-SA-4.0
├── crates/               Rust workspace (Cargo.toml lists the members)
│   ├── evermesh-kernel    the protocol kernel — the one crate everything else builds on
│   ├── evermesh-relay     the /sync websocket relay (Axum binary)
│   ├── evermesh-wasm      wasm-bindgen wrapper over evermesh-kernel
│   └── evermesh-node      Tauri 2 desktop client, links evermesh-kernel natively
├── packages/              pnpm workspace, TypeScript
│   ├── kernel-ts          typed API over the WASM kernel build
│   └── ui                 shared React components (Player, VerifiedBadge, ...)
├── apps/
│   ├── gateway/server      reference gateway backend (Fastify/TS, SQLite index)
│   ├── gateway/web         reference gateway frontend (React/Vite/Tailwind)
│   └── node-web            evermesh-node's embedded frontend (React/Vite)
├── tools/
│   ├── conformance         vectors + the three-runtime runner (Rust)
│   ├── site                site/docs sync + the real-browser site checker
│   └── brand               brand asset rendering (OG card, icons, UI screenshots)
├── site/                  static site (owned by the landing/docs agent — see below)
├── docs/                  this file, CONCEPTS.md, GETTING-STARTED.md, DMTAP-CONVERGENCE.md
├── assets/                brand: logo, tokens, fonts, architecture.svg
├── brand/                 the source-of-truth logo.svg + the rendered icon set
└── deploy/                relay1.json / relay2.json used by docker-compose.yml
```

`Cargo.toml` is a single workspace (`resolver = "2"`); `pnpm-workspace.yaml`
covers `apps/*/*`, `packages/*`, and the root. There is no `apps/site/` —
that was a duplicate that drifted and was removed; `site/` is the only
copy.

## Crate / package map

| Path | Language | Depends on | Job |
|---|---|---|---|
| `evermesh-kernel` | Rust | `blake3`, `ed25519-dalek`, `ciborium` | Records, identity/rotation, blobs + chunk trees, bundles, canonical CBOR codec, all 27 kinds. `#![forbid(unsafe_code)]`. The only crate the wire format lives in. |
| `evermesh-relay` | Rust | `evermesh-kernel`, `axum`, `tokio`, `rusqlite` | The `/sync` binary: envelope validation, storage, subscriptions, gossip, PoW, rate-limit, retention, optional blob sidecar. |
| `evermesh-wasm` | Rust → WASM | `evermesh-kernel`, `wasm-bindgen` | Exposes kernel functions to JS. Built by `just wasm` into `packages/kernel-ts/wasm`. |
| `evermesh-node` | Rust (Tauri 2) | `evermesh-kernel` (native, not WASM), `tauri`, `reqwest`, `rusqlite` | Desktop client: `gateway_client.rs` browses a gateway's HTTP API, `verify.rs` re-verifies every manifest natively, `pinning.rs` is the re-verifying pin store. Embeds `apps/node-web`'s build output at `crates/evermesh-node/ui/` — gitignored, `just node-web-build` (or the `just test`/`just lint` recipes, which depend on it) regenerates it. |
| `kernel-ts` | TypeScript | `evermesh-wasm`'s build | Typed, ergonomic wrapper (`createRecord`, `verifyRecord`, `Identity` helpers) — this is what `apps/gateway/*` and `apps/node-web` actually import, never the raw WASM bindings. |
| `ui` | TypeScript/React | `kernel-ts` | Shared components: `Player`, `AudioPlayer`, `VerifiedBadge`, `NowPlayingBar`, `useQueue`. Consumed by both `gateway/web` and `node-web`. |
| `apps/gateway/server` | TypeScript (Fastify) | `kernel-ts` | Config, SQLite index, policy engine, custodial key handling, relay clients, upload pipeline, JSON API. Runs from source (`node --experimental-transform-types`), no bundler — see the release workflow's comment on why. |
| `apps/gateway/web` | TypeScript/React | `kernel-ts`, `ui` | The uniform reference UI (spec 009 §7). Builds to a static bundle. |
| `apps/node-web` | TypeScript/React | `kernel-ts`, `ui` | `evermesh-node`'s frontend; built and embedded at Tauri compile time, not served independently. |
| `tools/conformance` | Rust (binary + lib) | `evermesh-kernel` | `vectors/` (JSON+CBOR fixtures) + a runner that replays them against the kernel in-process, `@evermesh/kernel` under Node (`node-harness.mjs`), and a live relay over `/sync`. |

## Running a node and a gateway locally

The full walkthrough — prerequisites, exact commands, what each step
should print — is [GETTING-STARTED.md](GETTING-STARTED.md) and the
README's [Quick start](../README.md#quick-start-standalone) /
[Development](../README.md#development) sections; this page doesn't repeat
those commands. In one line: `just setup && just wasm`, then boot
`evermesh-relay` against a local config, then `apps/gateway/server` against
that relay, then optionally `cargo tauri dev -p evermesh-node` pointed at
the gateway's URL.

## Test strategy

Four layers, each catching a different class of bug:

1. **Unit + property tests, in-crate.** `evermesh-kernel` has 201 unit
   tests plus 7 `proptest` property tests (canonical-encoding round-trips,
   merge-order independence). `evermesh-relay` has 47. Fast, run on every
   `cargo test`.
2. **Frozen fixture tests.** `crates/evermesh-kernel/tests/chunk_tree_profiles.rs`
   pins the `EM-1` chunk-tree profile's roots for chunk counts 1–9 as
   literal constants, in the default build — this is what makes "the
   chunk-tree divergence from DMTAP-PUB's `DP-22` profile is frozen, not a
   bug" (DECISIONS.md P20/T9) an executable claim instead of a comment.
3. **Cross-implementation conformance.** `tools/conformance/vectors/` is a
   deterministic corpus (currently 189 vectors) replayed against three
   independent runtimes — the Rust kernel, `@evermesh/kernel` under
   Node/WASM, and a live relay's `/sync`. A vector diverging between
   runtimes is treated as a protocol or binding bug, never special-cased.
   `tools/conformance/coverage.json` declares the exact per-group
   pass/fail/skip shape each target must produce, and every run checks
   itself against it — a shrunken corpus or a silently-skipped group fails
   the run instead of printing a smaller clean table. See
   [`tools/conformance/README.md`](../tools/conformance/README.md).
4. **JS/TS unit and component tests.** `packages/kernel-ts` (Node's test
   runner), `apps/gateway/server` (Node's test runner, in-memory SQLite),
   `apps/gateway/web` (Vitest + Testing Library, including route smoke
   tests). Counts drift; the README's [Status by
   component](../README.md#status-by-component) table states the last
   verified count for each, and CI (`.github/workflows/ci.yml`) is the
   actual gate — it runs the same suites this page describes, plus the
   two-target conformance job (node + relay) that a plain `cargo test`
   cannot reach on its own, plus a dedicated job asserting the optional
   `dmtap-pub` feature's vectors actually ran (not silently skipped).

`site/` has its own check (`just site-check`, `tools/site/check.mjs`) — a
real-browser pass over the landing page and every docs route — but that is
about the static site rendering correctly, not the protocol, and is
documented in [`site/README.md`](../site/README.md), owned separately from
the rest of this repo's docs.
