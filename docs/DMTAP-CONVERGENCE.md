# Vidmesh ↔ DMTAP-PUB convergence

**Status: decision document. The final call is FOUNDER-GATED — nothing in this
document has been actioned in the substrate.** Phase 1 is deliberately
non-destructive: the kernel/codec/relay byte formats are unchanged. This
records the choice on the table, its cost, and a recommendation, so the
founder can decide with the numbers in front of them.

## The question

Vidmesh built its own **self-certifying substrate** — a signed-record kernel
(CBOR envelope, Ed25519, BLAKE3), a content-addressed blob layer with
chunk-tree range proofs, an identity/rotation model, and a `/sync` relay.
Independently, the **DMTAP** protocol (in `~/code/vulos/dmtap`) has grown
**DMTAP-PUB** (§22, "Public Objects"): the *authenticity-without-confidentiality*
quadrant — signed public objects, plaintext-addressed public blobs, and
per-author append-only feeds, served over a `/.well-known/dmtap-pub` HTTP
surface. §23 (the CAD/artifact profile) is the first application over it, and a
**§24 video profile is being authored right now**; **envoir** is implementing
§22 in Rust.

DMTAP-PUB and vidmesh solve the *same substrate problem* — a signed, publicly
verifiable, content-addressed, dedup-friendly, trustlessly-servable object graph
keyed to a sovereign identity — with **different bytes**. That is the
duplication this document is about.

Two routes:

- **(a) Keep the parallel substrate.** Vidmesh stays its own protocol; DMTAP-PUB
  is a sibling that happens to overlap. Two codecs, two identity models, two
  serving surfaces, two conformance suites, two ecosystems.
- **(b) Re-base the application onto DMTAP-PUB.** Vidmesh's *video-specific*
  layer becomes the **DMTAP-PUB §24 video profile** — the exact relationship
  §23 (CAD) has to §22 — riding envoir's Rust §22 implementation. One substrate,
  one identity model, one serving surface; vidmesh keeps everything that makes it
  *video* and contributes its substrate innovations upstream.

**Recommendation: (b), founder-gated.** Reasoning and cost below.

## Why the two substrates are the same shape

| Concern | Vidmesh | DMTAP-PUB §22 |
|---|---|---|
| Signed object | `Record`: CBOR map keys 1–7, `kind`+`refs`+`body`+`sig` (spec 001) | `PubAnnounce` (kind `0x40`): integer-keyed CBOR, `pub`/`roots`/`meta`/`sig` (§22.3) |
| Object id | `BLAKE3-256(canonical bytes)`, bare 32 bytes; sig over `"vidmesh:record:v1" ‖ id` (P2/P3) | `announce_id = 0x1e ‖ BLAKE3-256(det_cbor)`; sig over `"DMTAP-PUB-v0/announce" ‖ 0x00 ‖ det_cbor(∖sig)` (§22.3.1) |
| Content-addressed blob | `Manifest` + chunk tree, 1 MiB chunks, `0x00`/`0x01` domain-sep, odd-node promotion (P6) | `PubManifest`, RFC-6962 tree, DS-tag `"DMTAP-PUB-v0/manifest"` folded into every leaf/node, `h_i = 0x1e ‖ BLAKE3(plaintext_i)` (§22.2.2) |
| Per-blob chunk self-verification | `blob::verify_chunk` + `ChunkTree::prove` (range proofs) | inherited from §5.5, `h_i` self-verify; range-proof construction unspecified |
| Author ordering / anti-rollback | none at substrate level (relay gossip + identity rotation finality) | `FeedHead`/`FeedEntry`: monotonic `seq`, `prev` hash-chain, fork-detectable (§22.4) |
| Identity | `IdentityRef = [identity_id, signing_key]`, rotation with recovery>signing **contest-window finality** (spec 002 §4) | root `IK` + `DeviceCert` chain (§1.2); feeds bind `signer` to `pub` |
| Serving | relay `WS /sync` + `/blob` sidecar (`GET`/range/`/proof`) | `/.well-known/dmtap-pub/{feed,announce,manifest,chunk}` (§22.5.1), `pub-1` capability |
| Moderation posture | gateway *selection = moderation*; no protocol takedown (spec 009) | per-holder serve policy; no protocol takedown (§22.6.2) — **identical philosophy** |

The philosophies already match (self-verifying, trustless serving, no
protocol-level takedown, derived-and-rebuildable indexes, honest irrevocability).
The *bytes* differ. Maintaining both means paying twice for one idea.

## Migration cost (route b)

What actually has to change lives almost entirely in the **substrate crates**
(`vidmesh-kernel`, `vidmesh-relay`, `vidmesh-wasm`). The **application layer
survives** (next section).

| Area | Change | Cost | Notes |
|---|---|---|---|
| **DS-tags** | Replace `"vidmesh:record:v1"` / `"vidmesh:derivation:v1"` with the DMTAP-PUB DS-tag family (`DMTAP-PUB-v0/{announce,feed,manifest}` ‖ `0x00`) | **Low** | Mechanical; touches signing/verify preimages only. Isolated in `record.rs` / `content.rs`. |
| **Envelope shape** | Vidmesh's one universal `Record` becomes a small set of DMTAP-PUB object types (`PubAnnounce` for what is published; `meta` carries the video schema). The **kinds registry stops being a wire concept and becomes a `meta` schema** (like §23's `"artifact"` key) | **Medium** | Conceptual, not just mechanical: "everything is a Record" → "everything published is an announce carrying a profile schema". Kinds like `manifest`, `comment`, `playlist`, `channel` re-express as §24 `meta` schemas or as their own announces. |
| **Multihash prefix** | Prefix every content address with `0x1e` (BLAKE3-256), per §18.1.5 hash-agility | **Low** | `ids.rs` (`BlobId`/`RecordId` gain the prefix on the wire); enables FIPS/SHA-2 migration and Git-LFS interop for free. |
| **Chunk tree** | Move from odd-node-promotion + bare `0x00`/`0x01` to the **RFC-6962 split rule with the DS-tag folded into leaf/node** (§22.2.2) | **Medium–High** | The deepest byte change. But vidmesh's *range-proof* code is exactly what §22 lacks — see "contribute upstream". Reuses `ChunkTree` machinery; only the split rule + domain-sep bytes change. |
| **Feed / anti-rollback** | Adopt `FeedHead`/`FeedEntry`: per-author append-only log, monotonic `seq`, `prev` chain (§22.4) | **Medium (new)** | A primitive vidmesh does not have today. Gives ordering, discovery, and anti-rollback the relay's gossip only approximates. |
| **Serving surface** | Add `/.well-known/dmtap-pub/{feed,announce,manifest,chunk}` and advertise `pub-1` | **Low** | The relay's `/blob` sidecar (content-addressed GET + range + immutable caching) is ~80% of the `chunk`/`manifest`/`announce` endpoints already. `/sync` gossip can remain as an optimization beside the well-known surface. |
| **Error model** | Map kernel `Error` onto the `ERR_PUB_*` (`0x09xx`) registry (§22.10) | **Low** | Naming/telemetry alignment; behavior (fail-closed) already matches. |
| **Conformance** | Re-target the suite's vectors at the DMTAP-PUB object types; contribute them to the §22/§24 conformance corpus | **Medium** | The three-runtime harness is reusable as-is; the vectors change shape. |

**Not on this list — because it survives untouched:** transcode/HLS, the policy
engine, key custody, the gateway API, and the entire web UI + verification badge.

## What survives (the application layer is the moat)

None of the following cares whether the substrate is vidmesh-native or
DMTAP-PUB — they sit *above* the object graph:

- **Kinds registry → §24 video schema.** The 27 kinds become the video
  profile's `meta` schemas and announce conventions, exactly as §23 turned CAD
  concepts into `ArtifactMetadata`. This is *content*, not *crypto*.
- **Transcode / HLS / original-only pipeline** (`apps/gateway/server`) — pure
  application logic over blobs.
- **Policy engine** — *gateway selection = moderation* is already the same
  posture as §22.6.2 per-holder serve policy.
- **Key custody with a documented exit** (spec 002 §7 / 009 §5) — a product
  choice layered over any identity model.
- **Gateway UI + client-side verification badge** — verifies signatures and
  content addresses regardless of which DS-tags/prefixes they use.

The moat was never the CBOR dialect. It is video-specific: transcode economics,
the uniform reference UI (a trademark-level requirement, spec 009 §7), and the
gateway selection model. Route (b) keeps all of it.

## What vidmesh contributes upstream

Re-basing is not a surrender; vidmesh's substrate has three things §22/§24 should
adopt:

1. **Chunk-tree range proofs.** §22.2 gives per-chunk self-verification but no
   *range-proof* construction (prove chunk `i` against the root with a sibling
   path). Vidmesh's `ChunkTree::prove` / `blob::verify_chunk` and the relay's
   `GET /blob/{id}/proof?chunk=i` endpoint are exactly that primitive, already
   tested and wired into the conformance suite. Contribute the range-proof
   grammar to the §22 manifest profile (adjusted to the RFC-6962 + DS-tag tree).
2. **Rotation-log finality / anti-equivocation.** Vidmesh identity rotation
   resolves forks by **recovery > signing** class and a **contest-window
   finality** rule with verifier-local first-seen times (spec 002 §4, P9) — a
   richer anti-equivocation model than a `FeedHead`'s monotonic `seq` alone.
   Contribute it to harden feed/identity fork handling (§22.4.2 already reaches
   for "fork = HALT_ALERT with transferable evidence"; this makes finality
   precise).
3. **Fetch-hint registry.** Vidmesh manifests carry per-blob retrieval **hints**
   (a registry of where/how to fetch a content address). §22 stops at the
   content address and the `/.well-known` surface; a fetch-hint registry gives
   swarm/CDN/mirror discovery a typed home. Contribute it as a §22 (or §24)
   optional `meta` block.

## The case for (a), stated fairly

Route (a) is not indefensible:

- **Zero migration risk now.** The substrate is tested and green today; (b) touches
  the chunk tree and identity, the two places a subtle byte bug is most expensive.
- **§24 is unwritten and §22's Rust impl is in flight.** Betting the substrate on
  a spec being authored *right now* and an implementation that is not yet a
  dependency is real schedule risk.
- **Independence.** A separate substrate cannot be blocked by DMTAP governance
  decisions.

The counter: (a) permanently pays double for one idea, fragments identity and
serving across two incompatible ecosystems, and forfeits the network effect of
sharing envoir/DMTAP's substrate, holders, and identity graph — for a *video*
product whose actual differentiation is not in the CBOR layer. The independence
(a) buys is independence from the exact ecosystem vidmesh would most benefit from
joining.

## Recommendation

**Adopt route (b): re-base vidmesh's video layer as the DMTAP-PUB §24 video
profile, on envoir's Rust §22 substrate, and contribute range proofs,
rotation-log finality, and the fetch-hint registry upstream.** The migration cost
is real but bounded to the substrate crates; the application layer — the moat —
survives intact.

**This is FOUNDER-GATED.** Concretely, before any substrate byte changes:

1. Founder confirms the strategic direction (one substrate vs. two).
2. §24 reaches enough of a draft to target (or vidmesh co-authors it — the video
   profile is vidmesh's to write, the way §23 is CAD's).
3. envoir's §22 Rust implementation is a consumable dependency.

Until all three hold, Phase 1 stays non-destructive: keep the substrate green,
keep the tests running, and keep this door open — do not rewrite the kernel,
codec, or relay byte formats.
