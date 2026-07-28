# Spec changelog

Newest first. Per build-plan §15, implementation-revealed spec bugs are
fixed in the same commit as the implementation and noted here.

*The entries below from 2026-07-17 predate the project's renames from
**Vidmesh** to **Boloka** to **Evermesh**; file names have been updated to
the current ones (e.g. `draft-evermesh-protocol-00.md`,
`EVERMESH_SPEC_PROPOSAL.md`) so the links stay live — the files themselves
were `git mv`-renamed, not recreated.*

## 2026-07-28 — 001 §8.1 chunk-tree profiles named and frozen

The chunk-tree construction in §8 is now the named profile **`EM-1`**, and
DMTAP-PUB §22.2.2's tree is named **`DP-22`**. §8.1 tabulates the two
side by side and states the standing decision: the divergence is frozen,
MUST NOT be converged, and a range proof under one profile MUST NOT be
accepted against the other's root. **No wire change** — `EM-1` is exactly
the construction §8 already specified; this gives it a name, states what
was previously only implied, and points at the executable proof
(`crates/evermesh-kernel/tests/chunk_tree_profiles.rs`).

§8's test-vector index was also corrected: it claimed 1000-chunk-blob and
swapped-leaf-prefix vectors that the shipped `chunktree/` group has never
contained. It now names what is actually covered, and what is not.

## 2026-07-17 — 003 §6.5 notice.takedown `statement` clarified

Writing the DMCA operator guide revealed that US notices require two
distinct statements (good-faith belief and accuracy-under-perjury);
`statement` now explicitly carries all statements the named regime
requires. No wire change.

## 2026-07-17 — Draft 0.2 split into per-concern files (Phase 1)

- Added `000-overview.md` … `011-threat-model.md`, transcribing and
  deepening `draft-evermesh-protocol-00.md` (which remains the
  single-document rendering; on conflict the numbered files win).
- New normative material introduced by the split (all logged in
  DECISIONS.md and per-file "Decisions" headings):
  - full body schemas, refs semantics, validation rules, and worked
    examples for all 27 launch kinds (003);
  - deterministic identity fork-resolution algorithm with
    verifier-local finality (002 §4);
  - relay wire protocol: CBOR frames, filters, receipt-sequence
    cursors, PoW placement, blob sidecar with chunk proofs (006);
  - bundle container format `EVMS\x01` + CBOR sequence with salvage
    semantics (007);
  - content-encryption scheme 1 (chunked XChaCha20-Poly1305, per-blob
    keys, content-key wrap) and key-wrap registry (008 §2);
  - derivation-statement construction for renditions (004 §3);
  - uniform-reference-UI requirement for gateways (009 §7);
  - per-file test-vector indexes naming conformance groups.

## 2026-07-17 — Draft 0.2 (single document)

- `draft-evermesh-protocol-00.md` professionalized Draft 0.1
  (`../EVERMESH_SPEC_PROPOSAL.md`); editorial decisions in its
  Appendix B (envelope keys, id/signature derivation, IdentityRef,
  ref typing, chunk-tree construction, PoW placement, kind ids,
  clean-room kernel).
