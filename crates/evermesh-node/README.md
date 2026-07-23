# evermesh-node

The Evermesh node app: a Tauri 2 desktop media client. It browses a
user-configured gateway's public catalog, verifies every manifest natively
(no WASM — `evermesh-kernel` is a native dependency of this binary), plays
video/audio back, and pins chosen content for offline playback while
honoring its own disk/bandwidth budgets. Per spec
[000-overview.md §4](../../spec/000-overview.md), a node has **no
public-facing duties**: it does not index, serve, or moderate for anyone
but its owner. That's the gateway's job.

## What it does

- **Browses a gateway.** `Settings` manages an allow-list of gateway
  origins (plain `http(s)`, no default baked in); `Browse` lists that
  gateway's public catalog (video and audio, spec 004 §2 / DMTAP §24.4.2).
- **Verifies natively, before playback.** Every manifest fetched is parsed
  and Ed25519-verified, kind-validated (spec 003), and has every
  rendition's derivation signature checked (spec 004 §3) in Rust — the
  same checks the browser-side `VerifiedBadge` runs in WASM, run here as a
  plain function call instead, before any bytes reach the webview.
- **Pins by explicit choice.** `pin_manifest` downloads a manifest's
  original media blob, re-hashes it (chunked BLAKE3 when it spans more
  than one chunk) against the manifest's own claim, and only then records
  the pin — a correctly-signed manifest proves *authorship* of a claim,
  not that a given gateway actually served the claimed bytes.
- **Plays back offline.** Pinned content resolves to a local file path
  (`local_media_path`, fed to `convertFileSrc()`); everything else falls
  back to the gateway's remote URL.
- **Keeps an offline library.** Every fetched-and-verified manifest is
  cached (`manifest_cache`), pinned or not, so `Library` has something to
  show without a network round-trip.
- **Honors its own budget.** A configurable disk-space/bandwidth ceiling
  is recorded (spec 000 §4); automatic eviction against it is not
  implemented yet (there is no seeding/swarm participation to make room
  for — see Known gaps).

## Known gaps

- **No P2P/swarm retrieval.** Every read is gateway-HTTP. "Pinning" means
  "downloaded, re-verified, and kept as a local cache" — this node does
  not seed to other nodes.
- **No budget enforcement/eviction.** `set_budget` persists intent;
  nothing evicts subscription pins over the ceiling yet (there are no
  subscription pins yet either — see next point).
- **No "seed by subscription."** Only explicit pins (`PinReason::Explicit`)
  are ever created; `PinReason::Subscription` is a modeled-but-unused
  variant, reserved for a future follow/auto-pin feature.
- **Offline library entries don't record their origin gateway.** Content
  is content-addressed and gateway-independent by design, so a
  cached-but-unpinned `Library` entry has no remote URL to fall back to
  until it's browsed again from a live gateway session — a pinned entry
  is unaffected (it always plays from disk).

## Building

Rust side — plain compilation works with only the Rust toolchain (no
Node.js needed to typecheck/test the Rust code, though the frontend build
step below does need it):

```sh
cargo check -p evermesh-node
cargo test -p evermesh-node
cargo clippy -p evermesh-node -- -D warnings
```

Frontend (`apps/node-web`, a separate pnpm package — see its own
directory, not under this crate) builds straight into `./ui`, which
`tauri.conf.json`'s `frontendDist` already points at:

```sh
pnpm --filter @evermesh/node-web build
```

To run the full desktop app (requires the `tauri` CLI, Node.js, and pnpm):

```sh
cargo install tauri-cli --version "^2"
cargo tauri dev -p evermesh-node   # runs apps/node-web's dev server via beforeDevCommand
cargo tauri build -p evermesh-node # runs its build via beforeBuildCommand first
```

## Layout

| Path | Purpose |
|---|---|
| `Cargo.toml` | crate manifest: `tauri` + `fs`/`http`/`dialog` plugins, `reqwest`, `rusqlite`, `tokio`, `evermesh-kernel` |
| `build.rs` | `tauri_build::build()` — bundle glue from `tauri.conf.json` |
| `tauri.conf.json` | Tauri 2 config: identifier `org.evermesh.node`, `devUrl`/before-dev/build commands pointing at `apps/node-web`, `frontendDist: "./ui"` |
| `capabilities/default.json` | ACL: app-data fs read/write/remove, `http(s)` egress (gateway origins are user-configured at runtime, so scoped broadly here — the real guard is `gateway_client.rs`'s `http(s)`-only URL validation), open/save dialogs |
| `icons/icon.png` | app icon (512×512, derived from `assets/favicon.svg`) |
| `ui/` | **built output, gitignored** — `apps/node-web`'s `vite build` writes here (`tauri.conf.json`'s `frontendDist`). `tauri::generate_context!()` embeds this directory at compile time, so it must exist before `cargo build`/`check`/`test`/`clippy` — CI's `rust` job runs the pnpm build first for exactly this reason. |
| `src/main.rs` | Tauri builder, app state, and every `#[tauri::command]` |
| `src/gateway_client.rs` | `reqwest`-based client for a gateway's public JSON API (`apps/gateway/API.md`) |
| `src/verify.rs` | native record/manifest verification, and post-download content-address re-hashing |
| `src/pinning.rs` | `PinStore` — rusqlite-backed `pins`/`budget`/`manifest_cache` tables |

Frontend source lives in `apps/node-web` (a pnpm workspace package, sibling
to `apps/gateway/{web,server}`), not under this crate.
