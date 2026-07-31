# Getting started

This page is for a person, not a spec reader. If you want the normative
protocol text, it's in [Protocol specification](000-overview.md) further
down this sidebar — start here first.

## What is Evermesh?

Evermesh is a decentralized media protocol for video and music. Instead of
one company's servers, it has a **substrate**: signed records and
content-addressed blobs that verify from their own bytes. Independent
**gateways** index and serve their own selection of that substrate, on
their own domains, under their own moderation policy. **Nodes** — a
background app or a desktop client — pin whatever content their owner
chooses and cache it for offline playback. **Viewers** watch or listen,
verifying signatures and hashes client-side as they go.

Nothing here needs a token, a blockchain, or a company you have to trust.
See [Concepts](concepts.md) for the model in plain language, or the
[landing page](index.html) for the short version with pictures.

## What you can do today

Evermesh is **pre-alpha**. There is no deployed public gateway and no
downloadable desktop build — see the status table on the
[landing page](index.html#status) or the repository
[README](https://github.com/vul-os/evermesh#status-by-component) for the
exact, honest state of every component. What you *can* do, right now, from
a clone of the repository:

- Run a relay and a reference gateway on your own machine.
- Publish a video or an audio track to that gateway and watch/listen to it
  in the reference web UI, with real client-side signature verification.
- Build and run the desktop node client against that same gateway, browse
  its catalog, and pin something for offline playback.
- Run the conformance suite and see the same test vectors pass identically
  against three independent runtimes.

None of this touches a network beyond your own machine. That is the
current, honest ceiling — read [What actually exists](index.html#status)
before you plan anything on top of it.

## Prerequisites

Rust (stable), Node.js ≥ 22, [pnpm](https://pnpm.io), and
[`just`](https://github.com/casey/just). `ffmpeg`/`ffprobe` are optional —
without them the gateway still runs, just without transcoded renditions or
HLS (see "What degrades without ffmpeg" in
[`apps/gateway/server/README.md`](https://github.com/vul-os/evermesh/blob/main/apps/gateway/server/README.md)).

```sh
git clone https://github.com/vul-os/evermesh.git
cd evermesh
just setup   # pnpm install
just wasm    # build the WASM kernel used by the TS/web side
```

## Run a relay and a gateway

A relay is the thing records move through; a gateway is the thing you
actually browse. This boots both locally with no ffmpeg required (see the
full "Smoke run" in the README for the byte-for-byte commands, including
a manual blob put/get):

```sh
cargo build --workspace

mkdir -p smoke/blobs
cat > smoke/relay.json <<'JSON'
{
  "listen_addr": "127.0.0.1:8787",
  "db_path": "smoke/relay.sqlite3",
  "name": "smoke-relay.local",
  "pow_min_bits": 0,
  "blob": { "enabled": true, "dir": "smoke/blobs", "max_bytes": 4294967296 }
}
JSON
./target/debug/evermesh-relay smoke/relay.json &

cp apps/gateway/server/config.example.json apps/gateway/server/config.json
cp apps/gateway/server/policy.example.json apps/gateway/server/policy.json
# edit config.json: a real sessionSecret and custody.secret (32+ chars
# each), and set relays to ["ws://127.0.0.1:8787/sync"]
cd apps/gateway/server
GATEWAY_CONFIG=./config.json pnpm dev   # http://localhost:8600
```

Then, in another terminal, start the reference web UI against it:

```sh
pnpm --filter @evermesh/gateway-web dev   # http://localhost:5173, proxies /api to :8600
```

## Play something

Open the gateway-web dev server in a browser, create an account
(`/auth`), and use `/upload` to publish a video or audio file. It will be
transcoded if `ffmpegPath` is configured, or served as the original file
if not — either way the manifest is a real signed record and the
watch page's verification badge is a real client-side signature and
content-hash check, not a decoration. This is the same reference UI every
gateway ships (spec [009 §7](009-gateway.md)) and the same code path shown
in the [`ui-dark`/`ui-light` screenshots](index.html#gallery).

## Run the desktop node client

The desktop client (`crates/evermesh-node`, Tauri 2) browses a gateway you
point it at, verifies every manifest natively in Rust before it plays, and
pins content you choose for offline playback:

```sh
pnpm --filter @evermesh/node-web build   # builds the embedded frontend
cargo install tauri-cli --version "^2"
cargo tauri dev -p evermesh-node
```

Add `http://localhost:8600` (or wherever your gateway is listening) as a
gateway in `Settings`, then use `Browse` to find what you just uploaded.
`Library` shows a mixed video/audio grid regardless of pin state; pinning
downloads the original blob, re-verifies its hash against the manifest's
own claim, and plays it back from disk from then on. It does not seed to
other nodes yet — see [Concepts](concepts.md#nodes) and the status table.

## Run the conformance suite

The same 189 test vectors are replayed against three independent
runtimes — the Rust kernel, the WASM kernel under Node, and a live relay
over its `/sync` websocket:

```sh
just conformance         # kernel target
just wasm && just conformance-node   # WASM/TS target
# with a relay listening on ws://127.0.0.1:8787/sync:
just conformance-relay
```

A vector that passes on one runtime and fails or diverges on another is a
protocol bug, not a fixture to special-case — see
[Conformance: the golden rule](index.html#status) for what each target
does and does not check.

## Where to go next

- [Concepts](concepts.md) — the model in plain language, with diagrams.
- [Protocol specification](000-overview.md) — the normative spec, if you're
  implementing against it or just want the precise rules.
- [Decisions](decisions.md) and [Changelog](changelog.md) — why things are
  shaped the way they are, and what changed recently.
- [GitHub](https://github.com/vul-os/evermesh) — file an issue, read the
  code, or open a pull request.
