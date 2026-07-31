# Concepts

The [protocol specification](000-overview.md) is written for implementers
and uses precise, normative language on purpose. This page is the same
model in plain language, for anyone who wants to understand *why* Evermesh
is shaped the way it is before diving into the numbered chapters — or
instead of ever diving into them.

## Records: signed bytes that prove themselves

A **record** is the only kind of thing Evermesh has. A video manifest, a
comment, a "this track is mine" claim, a moderation notice — every one of
them is the same shape: a small, canonically-encoded (CBOR) envelope,
signed with the author's Ed25519 key. The record's own id is derived by
hashing its bytes, so two different records can never collide and a record
can never be quietly edited without becoming a different record.

That means a record can be checked by anyone, alone, with no server in the
loop — you need the record's bytes and nothing else. Twenty-seven record
**kinds** exist today (manifests, claims, comments, reactions, playlists,
live streams, compliance notices, and more), all defined in the [kinds
registry](003-kinds-registry.md).

<div style="border:1px solid var(--bo-border); border-radius:14px; overflow:hidden; margin:1.6em 0; background:var(--bo-surface);">
<img src="assets/illustration-record.svg" alt="A signed record — canonical CBOR with an Ed25519 signature and a deterministic id — carries a reference to a blob, addressed by the root of its BLAKE3 chunk tree rather than by a URL." style="display:block; width:100%; height:auto;">
</div>

## Blobs: content, addressed by what it is

Video and audio bytes themselves don't live inside a record — a record
carries a **manifest** that *references* a blob by its hash. Blobs are
chunked and hashed with BLAKE3 into a tree, so a byte range in the middle
of a two-hour video can be proven correct without downloading the whole
file, and two identical uploads from different people produce the exact
same blob id (see [001-kernel](001-kernel.md)).

This is what makes re-hosting free instead of a migration. A blob has no
owner and no canonical location — any node or gateway that already has the
bytes can serve them, and anyone who fetches them can verify they're the
right bytes without trusting whoever handed them over.

## Identity: a rotation log, not an account

There is no username/password account system at the protocol level.
Identity is a signed **rotation log** — a chain of "this key now signs for
this identity" statements, so a creator can rotate to a new key (lost
device, routine hygiene, suspected compromise) without losing continuity
or having to re-publish anything (see [002-identity](002-identity.md)).
Recovery precedence and delegation are defined the same way: as signed
statements in the log, not as a support ticket to a company.

The reference gateway *does* custody keys server-side for users who want a
normal sign-in experience — but the export path (`POST /api/me/export`) is
real and always available, so "losing this gateway" only ever costs
convenience, never identity.

## Gateways: selection, not ownership

A **gateway** is an independent website on its own domain that indexes and
serves *its own selection* of the substrate, under *its own* moderation
policy and jurisdiction. It is not a copy of "the network" — there is no
single network to copy. Two gateways can index almost entirely different
records and both be correct; a gateway declining to index something is a
local editorial choice, not an error condition or a takedown that reaches
anyone else.

<div style="border:1px solid var(--bo-border); border-radius:14px; overflow:hidden; margin:1.6em 0; padding:22px; background:var(--bo-surface);">
<svg viewBox="0 0 900 250" role="img" aria-label="A creator's record passes through a relay, then to independent gateways. Two gateways index it; a third declines to." style="width:100%; height:auto; display:block;">
  <g stroke="var(--bo-border-strong)" stroke-width="2" fill="none">
    <path d="M76,125 H236"/>
    <path d="M236,125 V60 H500"/>
    <path d="M236,125 H500"/>
  </g>
  <path d="M236,125 V195 H500" stroke="var(--bo-border)" stroke-width="2" fill="none" stroke-dasharray="5 7"/>
  <circle cx="76" cy="125" r="9" fill="var(--bo-border-strong)"/>
  <rect x="218" y="107" width="36" height="36" rx="7" fill="var(--bo-surface)" stroke="var(--bo-border-strong)" stroke-width="2.5"/>
  <rect x="500" y="34" width="200" height="52" rx="9" fill="var(--bo-surface-2)" stroke="var(--bo-signal)" stroke-width="2.5"/>
  <rect x="500" y="99" width="200" height="52" rx="9" fill="var(--bo-surface-2)" stroke="var(--bo-signal)" stroke-width="2.5"/>
  <rect x="500" y="169" width="200" height="52" rx="9" fill="none" stroke="var(--bo-border-strong)" stroke-width="2.5" stroke-dasharray="4 5" opacity="0.55"/>
  <text x="76" y="150" text-anchor="middle" font-family="ui-monospace,monospace" font-size="12" fill="var(--bo-muted)">Creator</text>
  <text x="236" y="164" text-anchor="middle" font-family="ui-monospace,monospace" font-size="12" fill="var(--bo-muted)">Relay</text>
  <text x="600" y="65" text-anchor="middle" font-size="14" fill="var(--bo-fg)">Gateway A &#8212; indexes it</text>
  <text x="600" y="130" text-anchor="middle" font-size="14" fill="var(--bo-fg)">Gateway B &#8212; indexes it</text>
  <text x="600" y="200" text-anchor="middle" font-size="14" fill="var(--bo-faint)">Gateway C &#8212; declines it</text>
</svg>
</div>

Every gateway that wants Evermesh trademark compliance ships the same
**uniform reference UI** (spec [009-gateway.md](009-gateway.md) §7) —
operators re-skin colour accents, not the interface — so moving between
gateways changes the catalog and the URL, never the product you're
learning to use.

## Nodes: pinning without public duties

A **node** — today, the desktop client in `crates/evermesh-node` — pins
content its owner chooses (their own uploads first, subscriptions second)
and caches it for offline playback. Per spec
[000-overview.md §4](000-overview.md), a node has *no public-facing
duties*: it doesn't index, serve, or moderate for anyone else. That's the
gateway's job, on purpose, so running a node never carries a gateway's
legal or operational exposure.

<div style="border:1px solid var(--bo-border); border-radius:14px; overflow:hidden; margin:1.6em 0; background:var(--bo-surface);">
<img src="assets/illustration-offline.svg" alt="Even with no path to the gateway, the desktop client verifies a pinned manifest's signature and re-hashes its cached blob locally before playing it." style="display:block; width:100%; height:auto;">
</div>

**Today**, pinning means "downloaded, re-verified, and kept as a local
cache" — the desktop client does not yet seed pinned content to other
nodes; there is no swarm/P2P transport for it to seed over. See the status
table on the [landing page](index.html#status) for exactly what's built
and what's still spec-only.

## Viewers: trust the math, not the host

A **viewer** is anyone watching or listening — a browser is enough, no
account or setup required. The reference web player and the desktop
client both verify a manifest's Ed25519 signature and re-derive its
content hash *client-side*, in the viewer's own process, before showing a
"Verified" badge. A hostile or careless gateway serving substituted bytes
gets caught by the viewer, not trusted by it.

## How the pieces compose

Put together: creators publish signed records into the substrate; relays
carry those records to whoever subscribes; gateways pick a selection and
serve it under their own policy; nodes pin what their owners choose;
viewers verify everything themselves as they watch. No piece in that chain
has to trust any other piece — each one checks what it's handed against
math, not against reputation. That property is what the
[survival test](index.html#survival) on the landing page is actually
testing.

## Next

- [Getting started](getting-started.md) — run a relay, a gateway, and the
  desktop client on your own machine.
- [Protocol specification](000-overview.md) — the normative text these
  concepts summarize, if you're implementing against it.
- [Threat model](011-threat-model.md) — the adversaries this design
  assumes and what it does and doesn't defend against.
