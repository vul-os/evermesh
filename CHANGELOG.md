# Changelog

All notable changes to Evermesh (formerly **Boloka**, and before that
**Vidmesh**) are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **`crates/evermesh-node`** promoted from a Phase 8 UI scaffold to a real
  Tauri 2 desktop media client: browses a user-configured gateway's public
  catalog (`gateway_client.rs`, native `reqwest`), verifies every
  manifest's signature/kind-validity/derivation signatures natively
  (`verify.rs` — no WASM, `evermesh-kernel` is linked directly), and pins
  chosen content for offline playback with a re-verifying, rusqlite-backed
  `PinStore` (`pinning.rs`: `pins`, `budget`, `manifest_cache` tables).
  Frontend rebuilt as `apps/node-web` (React + Vite, reusing
  `@evermesh/ui`'s `Player`/`AudioPlayer`/`NowPlayingBar`/`useQueue`/
  `VerifiedBadge`) with Browse/Library/Watch/Listen/Settings views.
  P2P/swarm retrieval remains out of scope — playback is gateway-HTTP plus
  an offline cache, never a second implementation of transport.
- **Chunk-tree profiles `EM-1` and `DP-22`, frozen** (spec 001 §8.1,
  DECISIONS.md P20/T9). Evermesh's chunk tree and DMTAP-PUB §22.2.2's
  produce different roots for the same bytes; the divergence is now named,
  specified side by side, and declared permanent rather than carried as a
  migration item. No wire change — `EM-1` is exactly the construction §8
  already described. `crates/evermesh-kernel/tests/chunk_tree_profiles.rs`
  pins both profiles' roots for chunk counts 1–9 **in the default build**,
  so the proof does not depend on the optional `dmtap-pub` git dependency
  being reachable; with the feature on, one further test recomputes the
  `DP-22` column live so the frozen constants cannot go stale.
- **The conformance suite asserts its own coverage.**
  `tools/conformance/coverage.json` declares the exact per-group vector
  counts and the exact pass/fail/skip shape each target must produce, and
  every run — CLI or test — fails on any mismatch. Skips are printed by
  name with their reason under a `NOT VERIFIED` heading; an unparseable
  vector file is now a hard error instead of a dropped file with a
  `warning:` line.
- **The conformance suite runs in CI.** The kernel target runs inside
  `cargo test --workspace` (`tools/conformance/tests/kernel_conformance.rs`);
  a new `conformance` workflow job runs the node target against a freshly
  built WASM package and the relay target against a relay it boots. The
  three-runtime "golden rule" was previously asserted only by hand.
  `just conformance-node`, `just conformance-relay` and
  `just conformance-all` were added alongside.

### Changed

- The conformance node target now checks `layer: "kind"` vectors through
  `@evermesh/kernel`'s `validateKind` instead of skipping them: **node
  moves 142/0/47 → 177/0/12**, still zero failures. The surface had existed
  since the WASM binding gained `validate_kind`; the harness simply was not
  calling it.
- `site/` is the single copy of the static site. It was byte-identically
  duplicated at `apps/site/`, and only the `apps/` copy was refreshed by
  `tools/site/sync-docs.mjs` — so the two would have silently drifted on
  the next spec edit. Tooling, the justfile and the docs now all point at
  `site/`.

## [0.1.0] — 2026-07-21

*This project was named **Vidmesh** for most of the work this entry
describes; it was renamed to **Boloka** (and rescoped from video-only to
media — video and audio) before this first tag, then renamed again to
**Evermesh** shortly after (naming correction only — same scope, mesh mark
restored). See DECISIONS.md's 2026-07-2x and 2026-07-23 entries for the
full rationale; component names below are the current (Evermesh) ones.*

**Status: pre-alpha.** This is the first tagged snapshot, not a shipped
product: there is no deployment, no swarm/P2P transport, no live-streaming
product surface, and the desktop node is a scaffold. It marks the point where
the protocol kernel, the relay, the WASM/TS bindings, the reference gateway
(backend + frontend), and the cross-implementation conformance suite are all
implemented with test suites that run and pass. The [spec](spec/) is
normative; where code and spec disagree, the spec wins. See the
[Status by component](README.md#status-by-component) table in the README for
the authoritative breakdown of what is implemented versus scaffolded versus
spec'd-but-not-built.

### Added

- **Protocol spec (000–011 + IETF-style Internet-Draft)** — the normative
  description of records, identity and key rotation, the kind registry,
  manifests, claims, the relay sync protocol, bundles, privacy/encryption,
  the gateway (including the uniform reference UI requirement), the
  substrate economics, and the threat model. Licensed CC-BY-SA-4.0
  (`LICENSE-SPEC`).
- **`crates/evermesh-kernel`** — the protocol kernel: self-certifying signed
  records (CBOR envelope, Ed25519, BLAKE3), all 27 record kinds, identity
  with recovery-precedence key rotation, content-addressed chunked blobs
  with proofs, and the canonical codec. 193 unit tests + 7 property tests.
  Additive, default-off `dmtap-pub` feature consumes `dmtap-core` (Envoir's
  reference crate) to prove byte-for-byte agreement with DMTAP-PUB §22's
  frozen conformance vectors, without touching the native format.
- **`crates/evermesh-relay`** — an axum `/sync` websocket relay: envelope
  validation, SQLite-backed storage, filtered subscriptions, gossip,
  proof-of-work admission, rate-limiting, retention, and an optional blob
  sidecar (PUT / GET-range / proof). 47 tests.
  - `crates/evermesh-wasm` — wasm-bindgen bindings over the kernel for
    browsers and Node.
  - `crates/evermesh-node` — a Tauri 2 desktop-node **scaffold** (pins and
    seeds nothing yet).
- **`packages/kernel-ts`** — a typed TypeScript API over the WASM kernel (5
  tests). `packages/ui` — shared React components (player, verification
  badge) consumed by the gateway frontend.
- **`apps/gateway/server`** — the reference gateway backend (Fastify):
  config, a SQLite index, a policy engine, custodial key handling, relay
  clients, kind-aware ingest, an upload/original-only pipeline, and the
  JSON API. 45 tests; boots and connects to a relay. Ships a mandatory,
  non-configurable CSAM hash-matching integration point (`CSAM.md`) — the
  one moderation decision the spec does not leave to gateway policy.
- **`apps/gateway/web`** — the uniform reference UI (React + Vite +
  Tailwind + TanStack Query) every gateway ships, re-skinnable only through
  its `--bo-*` design tokens. 45 tests; builds.
- **`site`** — evermesh.org: a static landing page and docs viewer,
  browser-checked (`just site-check`).
- **`tools/conformance`** — 189 deterministic test vectors replayed
  identically against three independent runtimes (in-process kernel,
  Node/WASM via `@evermesh/kernel`, and a live relay over `/sync`); a
  divergence is treated as a protocol/binding bug, never special-cased.
- **Dual code license** (MIT OR Apache-2.0) plus a separate CC-BY-SA-4.0
  license for everything under `spec/`.
- **CI** — Rust fmt/clippy/test, a dedicated job proving the `dmtap-pub`
  feature's conformance vectors actually ran (not silently skipped), a WASM
  build, and JS lint/test across the pnpm workspace.

### Known gaps (spec'd, not built)

- Swarm/P2P retrieval, WebRTC and BitTorrent-style transport — blob
  retrieval today is the relay's HTTP sidecar only.
- Live streaming — the `live.manifest` / `live.chat` kinds validate in the
  kernel; there is no live ingest, player, or product surface.
- Non-custodial key flows — the reference gateway custodies keys
  server-side; client-held keys are a later phase.

[Unreleased]: https://github.com/vul-os/evermesh/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/vul-os/evermesh/releases/tag/v0.1.0
