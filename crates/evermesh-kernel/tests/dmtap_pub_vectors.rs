//! THE PROOF that this is a convergence and not a third dialect.
//!
//! Runs the **frozen DMTAP-PUB §22 conformance vectors** — copied verbatim from
//! `kotva/conformance/vectors/pub_vectors.json`, the spec repo's authoritative
//! corpus — through evermesh's §22 path, asserting **byte-exact** agreement on
//! every value and fail-closed rejection with the exact `ERR_PUB_*` code on
//! every negative case.
//!
//! Re-vendored for `kotva-core = "0.2.0"`: 10 of the 15 vectors changed value,
//! all downstream of the single `announce_id` rule change (now over the
//! signature-EXCLUDED body, §22.3.1/§1.3). The count is unchanged at 15.
//!
//! Those vectors were generated from the specification text by a script that
//! does not import the reference crate, and are independently cross-checked by a
//! second from-scratch implementation. Passing them means evermesh's §22 path
//! agrees with the spec, not merely with the reference crate.
//!
//! Every vector is executed; the count is asserted, so a corpus that grows
//! without this harness growing with it fails rather than silently skipping.
//!
//! Run with: `cargo test -p evermesh-kernel --features dmtap-pub`
//!
//! # When the feature is OFF, the skip is LOUD
//!
//! `dmtap-pub` is default-off on purpose (it drags `ml-dsa`/`x-wing`/`hpke` into
//! the build and the WASM target). But a fully `#[cfg]`-gated test file compiles
//! to *nothing* and prints `running 0 tests ... test result: ok` — a green line
//! that means "verified nothing", indistinguishable at a glance from a real pass.
//!
//! So [`feature_gate`] always compiles. In the default build it prints, by name,
//! the reason these vectors were not verified, and it still asserts the corpus
//! coverage count. That count assertion is the point: a corpus that grows while
//! the harness is switched off now FAILS the default `cargo test` instead of
//! being silently skipped by a test binary that no longer exists.

use serde_json::Value as J;

/// The vector file, vendored at the revision recorded in `docs/DMTAP-CONVERGENCE.md`.
const VECTORS: &str = include_str!("vectors/dmtap_pub_vectors.json");

/// The size of the frozen §22 corpus. Asserted in BOTH builds — under the
/// feature by the harness below (which also executes every vector), and without
/// it by [`feature_gate`] (which can only count them).
const CORPUS_LEN: usize = 15;

/// Loud skip + coverage count for the default (feature-off) build.
#[cfg(not(feature = "dmtap-pub"))]
mod feature_gate {
    use super::{CORPUS_LEN, J, VECTORS};

    /// Not a placeholder: this asserts the one property still checkable without
    /// the optional dependency — that the corpus is exactly the size the real
    /// harness claims to execute — and prints why the other 15 assertions did
    /// not run.
    #[test]
    fn section_22_vectors_were_not_verified_in_this_build() {
        let doc: J = serde_json::from_str(VECTORS).expect("vector file parses");
        let vectors = doc["vectors"].as_array().expect("vectors array");

        eprintln!(
            concat!(
                "\n  NOT VERIFIED — DMTAP-PUB §22 conformance vectors ({} in corpus)\n",
                "\n  reason:    the `dmtap-pub` feature is OFF, so `kotva-core` is not linked",
                "\n             and evermesh's §22 path was neither compiled nor executed.",
                "\n             Only the corpus size below was checked.\n",
                "\n  to verify: cargo test -p evermesh-kernel --features dmtap-pub\n"
            ),
            vectors.len()
        );

        assert_eq!(
            vectors.len(),
            CORPUS_LEN,
            "the frozen §22 corpus changed size while the harness that executes it \
             is switched off — re-run with --features dmtap-pub and update the \
             harness in the same commit"
        );
    }
}

#[cfg(feature = "dmtap-pub")]
use evermesh_kernel::dmtap_pub::*;

#[cfg(feature = "dmtap-pub")]
fn unhex(s: &str) -> Vec<u8> {
    hex::decode(s).expect("vector hex decodes")
}

#[cfg(feature = "dmtap-pub")]
fn hexs(b: &[u8]) -> String {
    hex::encode(b)
}

#[cfg(feature = "dmtap-pub")]
fn cid(hexstr: &str) -> ContentId {
    ContentId(unhex(hexstr))
}

#[cfg(feature = "dmtap-pub")]
fn s<'a>(v: &'a J, k: &str) -> &'a str {
    v.get(k)
        .and_then(J::as_str)
        .unwrap_or_else(|| panic!("vector field {k} missing or not a string"))
}

#[cfg(feature = "dmtap-pub")]
fn u(v: &J, k: &str) -> u64 {
    v.get(k)
        .and_then(J::as_u64)
        .unwrap_or_else(|| panic!("vector field {k} missing or not a uint"))
}

#[cfg(feature = "dmtap-pub")]
fn hex_list(v: &J, k: &str) -> Vec<String> {
    v.get(k)
        .and_then(J::as_array)
        .unwrap_or_else(|| panic!("vector field {k} missing or not an array"))
        .iter()
        .map(|e| e.as_str().expect("hex string").to_string())
        .collect()
}

/// Assert a rejection carries the exact §22.10 error code the vector names.
#[cfg(feature = "dmtap-pub")]
fn assert_code(err: &PubError, expected: &J, vector: &str) {
    let want_code = s(expected, "error_code");
    let want_name = s(expected, "error_name");
    // Vectors spell codes as `0x0902` / `0x090B`; compare on the numeric value so
    // hex letter-case in the corpus is never load-bearing.
    let want_num = u16::from_str_radix(
        want_code
            .strip_prefix("0x")
            .or_else(|| want_code.strip_prefix("0X"))
            .unwrap_or(want_code),
        16,
    )
    .unwrap_or_else(|_| panic!("{vector}: unparseable error_code {want_code}"));
    assert_eq!(
        err.code(),
        want_num,
        "{vector}: wrong error code (got {} = 0x{:04X}, want {want_code})",
        err.name(),
        err.code()
    );
    assert_eq!(err.name(), want_name, "{vector}: wrong error name");
}

#[cfg(feature = "dmtap-pub")]
#[test]
fn dmtap_pub_conformance_vectors_agree_byte_for_byte() {
    let doc: J = serde_json::from_str(VECTORS).expect("vector file parses");
    assert_eq!(
        doc["format"].as_str(),
        Some("dmtap-conformance-vectors/1"),
        "unexpected vector file format"
    );
    let vectors = doc["vectors"].as_array().expect("vectors array");

    let mut executed = 0usize;

    for v in vectors {
        let name = s(v, "name");
        let op = s(v, "operation");
        let input = &v["input"];
        let expected = &v["expected"];

        match op {
            // §22.2.2 — DS-tagged RFC-6962 Merkle root over plaintext chunk addresses.
            "pub_manifest_root" => {
                let plaintexts: Vec<Vec<u8>> = hex_list(input, "plaintext_chunks_hex")
                    .iter()
                    .map(|h| unhex(h))
                    .collect();

                // h_i = 0x1e ‖ BLAKE3-256(plaintext_i)
                let hashes: Vec<ContentId> = plaintexts.iter().map(|p| chunk_hash(p)).collect();
                let want_hashes = hex_list(expected, "chunk_hashes_hex");
                for (i, (got, want)) in hashes.iter().zip(&want_hashes).enumerate() {
                    assert_eq!(&hexs(got.as_bytes()), want, "{name}: chunk hash {i}");
                }
                assert_eq!(hashes.len(), want_hashes.len(), "{name}: chunk count");

                // id = 0x1e ‖ MTH(h_0 … h_{n-1})
                let root = pub_manifest_root(&hashes);
                assert_eq!(hexs(root.as_bytes()), s(expected, "id_hex"), "{name}: root");

                // ...and a full PubManifest built the evermesh way agrees and self-verifies.
                let m = PubManifest::new(
                    plaintexts.iter().map(|p| p.len() as u64).sum(),
                    1 << 20,
                    hashes,
                    Suite::Classical,
                );
                assert_eq!(m.id, root, "{name}: PubManifest::new root");
                m.verify().unwrap_or_else(|e| panic!("{name}: {e}"));
                executed += 1;
            }

            // §22.2.3 — the DS-tag alone must keep public and sealed roots apart.
            "pub_manifest_type_mismatch" => {
                let chunks: Vec<ContentId> = hex_list(input, "chunk_hashes_hex")
                    .iter()
                    .map(|h| cid(h))
                    .collect();
                let public = pub_manifest_root(&chunks);
                assert_eq!(
                    hexs(public.as_bytes()),
                    s(expected, "public_root_hex"),
                    "{name}: public root"
                );
                assert!(
                    expected["roots_differ"].as_bool().unwrap_or(false),
                    "{name}: vector must assert the roots differ"
                );
                assert_ne!(
                    hexs(public.as_bytes()),
                    s(expected, "sealed_style_root_hex"),
                    "{name}: public and sealed-style roots MUST differ"
                );
                executed += 1;
            }

            // §22.2.1 — key 5 is forbidden in a public manifest, rejected before anything else.
            "det_cbor_decode_pub_manifest" => {
                let bytes = unhex(s(input, "cbor_hex"));
                let err =
                    PubManifest::from_det_cbor(&bytes).expect_err(&format!("{name}: MUST reject"));
                assert_eq!(s(expected, "outcome"), "reject");
                assert_code(&err, expected, name);

                // The same object WITHOUT key 5 must decode and self-verify — proving the
                // rejection is about key 5, not about the manifest being unparseable.
                let ok = unhex(s(input, "valid_cbor_hex_for_reference"));
                let m = PubManifest::from_det_cbor(&ok)
                    .unwrap_or_else(|e| panic!("{name}: reference manifest must decode: {e}"));
                m.verify().unwrap_or_else(|e| panic!("{name}: {e}"));
                assert_eq!(m.det_cbor(), ok, "{name}: manifest re-encode is byte-exact");
                executed += 1;
            }

            // §22.3.1 / §22.4.1 — the DS-tagged signing preimages, byte-exact.
            "ed25519_sign" => {
                let seed: [u8; 32] = unhex(s(input, "seed_hex"))
                    .try_into()
                    .expect("32-byte seed");
                let key = IdentityKey::from_seed(&seed);
                assert_eq!(
                    hexs(&key.public()),
                    s(expected, "pubkey_hex"),
                    "{name}: public key"
                );

                let domain = unhex(s(input, "domain_hex"));
                let msg = unhex(s(input, "msg_hex"));

                // The domain in the vector must be exactly the DS constant we compile against.
                let ds: &[u8] = match name {
                    n if n.contains("announce") => PUB_ANNOUNCE_DS,
                    n if n.contains("feed") => PUB_FEED_DS,
                    n => panic!("{n}: unrecognised signing-preimage vector"),
                };
                assert_eq!(
                    domain, ds,
                    "{name}: DS-tag must match the compiled constant"
                );

                let sig = key.sign_domain(&domain, &msg);
                assert_eq!(hexs(&sig), s(expected, "sig_hex"), "{name}: signature");

                // And the preimage must be the one our object types actually produce: decode
                // the object from the signed vector bytes and re-derive its preimage.
                if name.contains("announce") {
                    // msg is det_cbor(PubAnnounce ∖ sig); reconstruct the signed object.
                    let mut a = decode_announce_from_preimage(&msg, &sig);
                    assert_eq!(
                        a.signing_preimage(),
                        msg,
                        "{name}: PubAnnounce::signing_preimage is byte-exact"
                    );
                    a.sign(&key);
                    assert_eq!(hexs(&a.sig), s(expected, "sig_hex"), "{name}: resigned");
                    a.verify(&a.announce_id())
                        .unwrap_or_else(|e| panic!("{name}: {e}"));
                }
                executed += 1;
            }

            // §22.3.1 / §1.3 — announce_id = 0x1e ‖ BLAKE3-256(det_cbor(PubAnnounce ∖ {9})),
            // over the SIGNATURE-EXCLUDED body.
            //
            // This vector CHANGED when the substrate moved to kotva-core 0.2.0: it used to
            // carry the complete signed object (a CBOR map with key 9) and the id of that,
            // and now carries the sig-excluded body and the id of that. The reason is §1.3 —
            // hybrid AND-composition is EUF-CMA, not SUF-CMA, so a signature is malleable and
            // an id derived from one would let a mauled-but-valid copy of a single semantic
            // announce carry a second id. See docs/DMTAP-CONVERGENCE.md.
            "content_address" => {
                let body = unhex(s(input, "bytes_hex"));

                // The vector body has no signature, so reassemble two announces that differ
                // ONLY in key 9. `from_det_cbor` does not check the signature — it requires a
                // well-formed 64-byte one — which is exactly what makes this the executable
                // statement of the property: the id must not move when the signature does.
                let a = decode_announce_from_preimage(&body, &[0x11u8; 64]);
                let b = decode_announce_from_preimage(&body, &[0x22u8; 64]);
                assert_ne!(a.sig, b.sig, "{name}: fixture must vary the signature");

                // Evermesh's §22 path reproduces the vector's signing body byte-for-byte...
                assert_eq!(
                    a.signing_preimage(),
                    body,
                    "{name}: signing preimage MUST be byte-identical to the vector body"
                );
                // ...and derives the vector's id from it.
                assert_eq!(
                    hexs(a.announce_id().as_bytes()),
                    s(expected, "id_hex"),
                    "{name}: announce_id"
                );
                // The load-bearing §1.3 property: swapping the signature does not move the id.
                assert_eq!(
                    a.announce_id(),
                    b.announce_id(),
                    "{name}: announce_id MUST NOT depend on the malleable signature (§1.3)"
                );
                // NOTE: no `verify()` here — these two announces carry deliberately bogus
                // signatures, so there is nothing valid to verify. Signature verification of a
                // real vector-supplied announce is covered by `pub_announce_signing_preimage`
                // and by both `pub_announce_supersede_*` vectors, which still carry complete
                // signed CBOR; this arm is solely about the id derivation rule.
                executed += 1;
            }

            // §22.3.4 — a publisher may supersede only its own announcements.
            "pub_supersede_check" => {
                let pred = unhex(s(input, "predecessor_pub_hex"));
                let succ_bytes = unhex(s(input, "successor_cbor_hex"));
                let succ = PubAnnounce::from_det_cbor(&succ_bytes)
                    .unwrap_or_else(|e| panic!("{name}: successor must decode: {e}"));
                assert_eq!(succ.det_cbor(), succ_bytes, "{name}: successor re-encode");
                assert_eq!(
                    hexs(&succ.publisher),
                    s(input, "successor_pub_hex"),
                    "{name}: successor publisher"
                );
                assert_eq!(
                    succ.supersedes.as_ref().map(|c| hexs(c.as_bytes())),
                    Some(s(input, "successor_supersedes_hex").to_string()),
                    "{name}: supersedes link"
                );
                // The successor's own signature must be valid either way — the supersede rule
                // is an authorization check layered on top of a well-signed object.
                succ.verify(&succ.announce_id())
                    .unwrap_or_else(|e| panic!("{name}: {e}"));

                let result = check_supersede(&pred, &succ.publisher);
                match s(expected, "outcome") {
                    "accept" => result.unwrap_or_else(|e| panic!("{name}: MUST accept: {e}")),
                    "reject" => {
                        let err = result.expect_err(&format!("{name}: MUST reject"));
                        assert_code(&err, expected, name);
                    }
                    other => panic!("{name}: unknown outcome {other}"),
                }
                executed += 1;
            }

            // §22.4.1 — entry_id and the prev-chain.
            "pub_feed_entry_root" => {
                let raw: Vec<Vec<u8>> = hex_list(input, "entries_cbor_hex")
                    .iter()
                    .map(|h| unhex(h))
                    .collect();
                let entries: Vec<FeedEntry> = raw
                    .iter()
                    .map(|b| {
                        FeedEntry::from_det_cbor(b)
                            .unwrap_or_else(|e| panic!("{name}: entry must decode: {e}"))
                    })
                    .collect();
                for (i, (e, b)) in entries.iter().zip(&raw).enumerate() {
                    assert_eq!(
                        &e.det_cbor(),
                        b,
                        "{name}: entry {i} re-encode is byte-exact"
                    );
                }
                let want_ids = hex_list(expected, "entry_ids_hex");
                for (i, (e, want)) in entries.iter().zip(&want_ids).enumerate() {
                    assert_eq!(&hexs(e.entry_id().as_bytes()), want, "{name}: entry_id {i}");
                }
                if expected["prev_chain_valid"].as_bool().unwrap_or(false) {
                    // NOTE: the vector's three entries are three *positions*, not one
                    // contiguous validated range; the chain rule is checked pairwise via
                    // each entry's `prev` against the preceding entry_id where they link.
                    verify_feed_chain(&entries[..1])
                        .unwrap_or_else(|e| panic!("{name}: genesis chain: {e}"));
                    assert_eq!(
                        entries[1].prev.as_ref().map(|c| hexs(c.as_bytes())),
                        Some(want_ids[0].clone()),
                        "{name}: entry 1 prev links to entry 0"
                    );
                }
                executed += 1;
            }

            // §22.4.2 — anti-rollback / equivocation.
            "pub_feed_anti_rollback" => {
                let last_seq = u(input, "last_accepted_seq");
                let last_tip = input
                    .get("last_accepted_tip_hex")
                    .and_then(J::as_str)
                    .map(cid);
                let presented_seq = u(input, "presented_seq");
                let presented_tip = cid(s(input, "presented_tip_hex"));

                let result =
                    check_anti_rollback(last_seq, last_tip.as_ref(), presented_seq, &presented_tip);
                match s(expected, "outcome") {
                    "accept" => {
                        let d = result.unwrap_or_else(|e| panic!("{name}: MUST accept: {e}"));
                        assert_eq!(
                            d,
                            RollbackDecision::AcceptIdempotent,
                            "{name}: equal seq + identical tip is an idempotent re-fetch"
                        );
                    }
                    "reject" => {
                        let err = result.expect_err(&format!("{name}: MUST reject"));
                        assert_code(&err, expected, name);
                    }
                    other => panic!("{name}: unknown outcome {other}"),
                }
                executed += 1;
            }

            // §22.4.1 — the genesis/prev structural rule, fail-closed at decode.
            "det_cbor_decode_feed_entry" => {
                let bytes = unhex(s(input, "cbor_hex"));
                let err =
                    FeedEntry::from_det_cbor(&bytes).expect_err(&format!("{name}: MUST reject"));
                assert_eq!(s(expected, "outcome"), "reject");
                assert_code(&err, expected, name);
                executed += 1;
            }

            other => panic!("{name}: unhandled vector operation {other} — extend this harness"),
        }
    }

    assert_eq!(
        executed,
        vectors.len(),
        "every vector in the corpus must be executed, none skipped"
    );
    assert_eq!(
        executed, CORPUS_LEN,
        "the frozen §22 corpus is {CORPUS_LEN} vectors"
    );
}

/// Rebuild a signed `PubAnnounce` from its unsigned signing preimage plus the
/// signature: append key 9 to the preimage's CBOR map and decode the result.
/// This exercises the decoder on bytes the harness assembled, so a preimage that
/// is not exactly `det_cbor(∖sig)` cannot pass.
#[cfg(feature = "dmtap-pub")]
fn decode_announce_from_preimage(preimage: &[u8], sig: &[u8]) -> PubAnnounce {
    // The preimage is a definite-length CBOR map with 7 or 8 entries (major type 5,
    // additional info = count). Bump the count and append `9: bstr(sig)`.
    let mut out = Vec::with_capacity(preimage.len() + sig.len() + 8);
    let head = preimage[0];
    assert_eq!(head >> 5, 5, "signing preimage must be a CBOR map");
    let n = head & 0x1f;
    assert!(n < 23, "map header must be single-byte for this fixup");
    out.push((5 << 5) | (n + 1));
    out.extend_from_slice(&preimage[1..]);
    out.push(0x09); // key 9
                    // bstr header for a 64-byte Ed25519 signature.
    assert_eq!(sig.len(), 64, "Ed25519 signature is 64 bytes");
    out.push(0x58);
    out.push(64);
    out.extend_from_slice(sig);
    PubAnnounce::from_det_cbor(&out).expect("reassembled announce decodes")
}
