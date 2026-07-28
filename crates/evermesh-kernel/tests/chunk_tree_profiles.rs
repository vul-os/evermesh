//! The two frozen chunk-tree profiles (spec 001 §8.1), as executable code.
//!
//! Evermesh's chunk tree and DMTAP-PUB §22's `PubManifest` tree solve the
//! same problem — verify one chunk of a blob against a signed root in
//! `O(log n)` hashes — and produce **different roots for the same bytes**,
//! at every chunk count. Spec 001 §8.1 names them:
//!
//! | Profile | Leaf preimage | Interior preimage | Root form |
//! |---|---|---|---|
//! | `EM-1` (this kernel) | `BLAKE3(0x00 ‖ chunk_bytes)` | `BLAKE3(0x01 ‖ l ‖ r)` | bare 32 bytes |
//! | `DP-22` (DMTAP-PUB §22.2.2) | `BLAKE3(DS ‖ 0x00 ‖ h_i)`, `h_i = 0x1e ‖ BLAKE3(chunk)` | `BLAKE3(DS ‖ 0x01 ‖ l ‖ r)` | `0x1e ‖ root` |
//!
//! **The divergence is frozen, not a bug.** Converging would mean
//! re-reading and re-hashing every stored media byte in every deployment
//! (evermesh never persisted `BLAKE3(chunk)` — it folds its `0x00` leaf
//! tag inside the hash), to buy an interchange that nothing performs: no
//! two products exchange a chunk proof across a boundary. See
//! `docs/DMTAP-CONVERGENCE.md` and DECISIONS.md P20.
//!
//! What must never happen is the *opposite* of convergence: the two roots
//! silently coinciding. If they ever did, a proof built under one profile
//! would verify under the other, and a verifier would accept a proof it
//! never validated the rules of. That is strictly worse than being
//! incompatible, so it is asserted here rather than assumed.
//!
//! # Why this test runs in the default build
//!
//! The `DP-22` side is computed by the substrate's reference crate — an
//! **optional dependency**, today the published `kotva-core` aliased as
//! `dmtap-core`. A proof that only runs when that dependency resolves is
//! a proof that disappears the day the dependency does. So the `DP-22`
//! roots are **frozen as constants** below and the whole comparison runs
//! with no features enabled; the `dmtap-pub` feature adds one more test
//! that recomputes them live and asserts the frozen table still matches,
//! so the constants cannot rot either.
//!
//! That design paid off across the `kotva-core = "0.2.0"` bump: the
//! substrate crate changed repository, name and version, and the frozen
//! `DP-22` column did not move by a single byte — asserted live by
//! `dp22_frozen_roots_match_a_live_section_22_computation`, not assumed.
//! The bump is confirmed not to have silently altered the frozen
//! profiles, which remain deliberately NOT converged (DECISIONS.md P20).
//!
//! To regenerate the table after an intentional profile change, print
//! `ChunkTree::from_bytes(&b).root()` and
//! `dmtap_pub::pub_manifest_for_bytes(&b).id` for each row. An
//! *unintentional* change is what this file exists to catch.

use evermesh_kernel::blob::{ChunkTree, CHUNK_SIZE};

/// Bytes of the last chunk in every fixture blob; every earlier chunk is
/// a full [`CHUNK_SIZE`]. Short enough to keep the fixtures cheap, long
/// enough that the final chunk is genuinely partial.
const LAST_CHUNK_LEN: usize = 1024;

/// `(n_chunks, EM-1 root, DP-22 root)` — frozen. The `EM-1` column is a
/// regression pin on this crate's own wire format: if it changes, every
/// `chunk_root` ever published by an evermesh author stops verifying.
#[rustfmt::skip]
const FROZEN: &[(usize, &str, &str)] = &[
    (1, "d2beb49d87e59db174cb3ff1440f1899422968df670d060fd7ce759e8cc160e7", "1e37114dda210aa3b893af97956464f79975213808ec22a3ad86edbf2c3b87a905"),
    (2, "f87d673c698c63548c0a414ea855ec2dc456970b9fca40f584c190e4312524e0", "1eafe4f6aa507f1857fdd7e17543ebde479f60fd1fc20ce8ed3515669553835c94"),
    (3, "72b4127d10940dff24125f781e1dd4dd77cb8a5841bbf1564929d180e9920bdd", "1ec01f80dd2932eee616ebf5fff2489b7da395965d6b3ef9a0dc46a13e50153de2"),
    (4, "121fc92cb6908fd572825628da7fda6b9c73a1a13d843514ff84f1831e75f648", "1e7d4c343f0520c69fc2c19048be68f68a11b2f1111d16d5bbc2a7a804139d70a2"),
    (5, "7d0763337a4daffbc38ab45b5a295c93eb86e18aadc3f693fde0bfa105732e71", "1efd7b9aeb68436785fd6a6ab235e0219a864ba21dbe3a045037b868175c8d442f"),
    (6, "00fbad50418f04ed75258134a82d2547cd123342be625110d79cc4cae5b07dd4", "1e5113e1813543fe26c02ea10cc35d2328ea7b827372b95439ff2336fd8bee445c"),
    (7, "29328809a4317a046efeacfa813be4160d5f4f0485dfbf1ac140a60c535ae9c5", "1e3b417aedaae99b972c53229b5888500364c2b70487753ed0beb7b094fc6f779a"),
    (8, "fea73855ac58a91af8e8c5fab19c56c6ed2522e3b1911c4ddfc4e9d168b7216b", "1eabdd531ea352e5f4bf3872cf72b9e9b6c525d33a87027873fd2f43598d9fba17"),
    (9, "118cf9e39b9fb40e9024967eb819bd950094e8dab0bad5c3d08879062ba9d7c9", "1ee9ca0968e7bb01990bfe0b6e08375f7c35cc29930b976d8ad091ea14b80c60f8"),
];

/// A blob of exactly `n_chunks` chunks: every chunk but the last is a
/// full [`CHUNK_SIZE`] of the repeated byte `i`, the last is
/// [`LAST_CHUNK_LEN`] of it. Real chunk *counts* matter here — a
/// one-chunk tree has no interior node at all, so a fixture that only
/// varies blob length in bytes never exercises the interior-node or
/// odd-node rules the two profiles disagree about.
fn blob_of_chunks(n_chunks: usize) -> Vec<u8> {
    assert!(n_chunks > 0);
    let mut out = Vec::with_capacity((n_chunks - 1) * CHUNK_SIZE + LAST_CHUNK_LEN);
    for i in 0..n_chunks {
        let len = if i + 1 == n_chunks {
            LAST_CHUNK_LEN
        } else {
            CHUNK_SIZE
        };
        out.extend(std::iter::repeat_n(i as u8, len));
    }
    out
}

fn hex_of(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[test]
fn frozen_table_covers_every_chunk_count_it_claims_to() {
    assert_eq!(
        FROZEN.len(),
        9,
        "the frozen table must not shrink: it is the only place the EM-1 root \
         values are pinned"
    );
    for (i, (n, ..)) in FROZEN.iter().enumerate() {
        assert_eq!(
            *n,
            i + 1,
            "the table must cover chunk counts 1..=9 in order"
        );
    }
}

/// Profile `EM-1` is this kernel's wire format. These roots are published
/// inside signed records (`chunk_root`, spec 001 §8), so a change to any
/// of them is a break in the protocol, not a refactor.
#[test]
fn em1_roots_are_frozen() {
    for (n, em1, _) in FROZEN {
        let bytes = blob_of_chunks(*n);
        let tree = ChunkTree::from_bytes(&bytes);
        assert_eq!(tree.n_chunks(), *n, "fixture must really have {n} chunk(s)");
        let root = tree.root().expect("a non-empty blob has a root");
        assert_eq!(
            &hex_of(&root),
            em1,
            "EM-1 chunk root changed for n={n}: every previously published \
             chunk_root at this shape would stop verifying"
        );
    }
}

/// The load-bearing negative result, at every chunk count: a `DP-22` root
/// is never an `EM-1` root wearing a multihash prefix.
#[test]
fn em1_and_dp22_roots_differ_at_every_chunk_count() {
    for (n, em1, dp22) in FROZEN {
        // EM-1 framed the way a §22 address is framed: 0x1e ‖ 32 bytes.
        // Framing is the *only* difference a naive reader might expect;
        // this asserts the digests themselves diverge underneath it.
        let em1_framed = format!("1e{em1}");
        assert_ne!(
            &em1_framed, dp22,
            "EM-1 and DP-22 roots coincide at n={n} — a chunk proof built \
             under one profile would verify under the other, which is far \
             worse than the two being incompatible"
        );
        assert_eq!(dp22.len(), 66, "a DP-22 root is 33 bytes (0x1e ‖ digest)");
        assert!(
            dp22.starts_with("1e"),
            "a DP-22 root carries the BLAKE3-256 multihash prefix"
        );
    }
}

/// Interior-node domain separation, stated as a value rather than as
/// prose: `EM-1` prefixes leaves with `0x00` and interior nodes with
/// `0x01`, so a chunk hashed under the interior tag is not the leaf.
#[test]
fn em1_leaf_and_interior_tags_are_distinct() {
    use evermesh_kernel::blob::{leaf_hash, node_hash};
    let chunk = [0xa7u8; 64];
    let leaf = leaf_hash(&chunk);
    // The same 64 bytes read as two 32-byte halves through the interior
    // rule: a different preimage, therefore a different digest.
    let (l, r) = chunk.split_at(32);
    let interior = node_hash(
        &<[u8; 32]>::try_from(l).unwrap(),
        &<[u8; 32]>::try_from(r).unwrap(),
    );
    assert_ne!(
        leaf, interior,
        "0x00/0x01 domain separation is what stops a leaf being passed off \
         as an interior node"
    );
}

/// With the optional `dmtap-pub` feature on, recompute the `DP-22` column
/// against the substrate's `kotva-core` and prove the frozen constants above are
/// still exactly what §22 produces. Without this, the frozen table could
/// drift from the real §22 rules and the default-build test would happily
/// keep asserting a stale value.
#[cfg(feature = "dmtap-pub")]
#[test]
fn dp22_frozen_roots_match_a_live_section_22_computation() {
    use evermesh_kernel::dmtap_pub::pub_manifest_for_bytes;

    for (n, _, dp22) in FROZEN {
        let bytes = blob_of_chunks(*n);
        let manifest = pub_manifest_for_bytes(&bytes).expect("n >= 1 has a PubManifest");
        assert_eq!(
            &hex_of(manifest.id.as_bytes()),
            dp22,
            "the frozen DP-22 root for n={n} no longer matches what §22 computes; \
             either dmtap-core changed the profile or this table is stale"
        );
    }
}
