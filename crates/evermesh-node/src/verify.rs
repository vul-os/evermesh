//! Native verification: everything the browser-side `VerifiedBadge`
//! (`@evermesh/ui`) does in a WASM-compiled kernel, done here instead with
//! the same kernel crate linked natively.
//!
//! This is why the node app does not ship the WASM kernel build at all
//! (unlike `apps/gateway/web`, which must — a browser has no other way to
//! run Rust): `evermesh-kernel` is already a native dependency of this
//! binary (see `Cargo.toml`), so verification is a plain function call,
//! not a `.wasm` fetch-and-instantiate.
//!
//! Two independent checks live here:
//! - [`verify_record_cbor`]: is this record's signature valid and is it
//!   kind-valid (spec 001 §§3-4, spec 003)? Runs on the small CBOR
//!   envelope fetched from `/api/records/{id}/cbor`.
//! - [`rehash_blob_file`] / [`chunk_root_of_file`]: does a *downloaded
//!   blob's* content actually hash to the id the (already-verified)
//!   manifest claims for it? Runs on the (potentially large) media file
//!   after [`crate::gateway_client::GatewayClient::download_to_file`]
//!   writes it to disk, and MUST pass before [`crate::pinning::PinStore`]
//!   records the blob as pinned — a manifest's signature only proves the
//!   *author* asserted this blob id, not that the bytes a gateway served
//!   for it actually match.

use std::fs::File;
use std::path::Path;

use evermesh_kernel::{blob, kinds, BlobId, Record};
use serde::Serialize;

/// The result of checking one record's signature and kind-validity.
/// Mirrors `@evermesh/ui`'s `VerifiedState` (`verifying` has no Rust
/// analogue: by the time this type exists, the check already ran).
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum VerifyVerdict {
    // `rename_all` on the enum container only cases the `status` tag
    // value itself (serde: container `rename_all` on an enum renames
    // variants, not their fields) — each struct variant needs its own
    // `rename_all` for its fields to come out camelCase on the wire.
    #[serde(rename_all = "camelCase")]
    Verified {
        /// Full record id, hex.
        record_id: String,
        /// First 12 hex chars, for display (matches the web UI's
        /// `shortId` convention in `VerifiedBadge`).
        short_id: String,
        kind: u64,
        kind_name: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    Failed { reason: String },
}

/// Parse, verify the signature, and check kind-validity of one record's
/// canonical CBOR bytes (as returned by `/api/records/{id}/cbor`). Never
/// panics: every failure mode becomes `VerifyVerdict::Failed` with a
/// human-readable reason, matching the kernel's "never panic on untrusted
/// input" contract (`evermesh_kernel::error::Error`'s doc comment).
pub fn verify_record_cbor(cbor: &[u8]) -> VerifyVerdict {
    let record = match Record::from_cbor(cbor) {
        Ok(r) => r,
        Err(e) => {
            return VerifyVerdict::Failed {
                reason: format!("malformed record envelope: {e}"),
            }
        }
    };
    if let Err(e) = record.verify() {
        return VerifyVerdict::Failed {
            reason: format!("signature verification failed: {e}"),
        };
    }
    if let Err(e) = kinds::validate(&record) {
        return VerifyVerdict::Failed {
            reason: format!("kind validation failed: {e}"),
        };
    }
    let id = record.id();
    let hex = id.to_hex();
    VerifyVerdict::Verified {
        short_id: hex[..12].to_string(),
        record_id: hex,
        kind: record.kind(),
        kind_name: kinds::kind_name(record.kind()).map(str::to_string),
    }
}

/// Parse and verify the record, then additionally parse it as a
/// `manifest` (spec 003 §4.1) and verify every rendition's derivation
/// signature (spec 004 §3.1) — the same two-step
/// [`kinds::validate`]/`content::verify_derivation` sequence
/// `evermesh_kernel::kinds::validate` runs for `KIND_MANIFEST`, exposed
/// here as one call that also hands back the parsed `Manifest` so the
/// caller can read `original.blob`/`chunk_root` to know what to download.
///
/// Returns `Err` (not `VerifyVerdict::Failed`) for anything that isn't
/// even a valid, verified manifest — there is no `Manifest` to hand back
/// in that case, so the two outcomes cannot share a return type.
pub fn verify_and_parse_manifest(cbor: &[u8]) -> Result<(Record, kinds::Manifest), String> {
    let record = Record::from_cbor(cbor).map_err(|e| format!("malformed record envelope: {e}"))?;
    record
        .verify()
        .map_err(|e| format!("signature verification failed: {e}"))?;
    if record.kind() != kinds::KIND_MANIFEST {
        return Err(format!(
            "record kind {} is not a manifest (kind {})",
            record.kind(),
            kinds::KIND_MANIFEST
        ));
    }
    let manifest = kinds::Manifest::parse(&record)
        .map_err(|e| format!("manifest kind validation failed: {e}"))?;
    for rendition in &manifest.renditions {
        kinds::verify_derivation(rendition, &manifest.original.blob)
            .map_err(|e| format!("rendition derivation signature invalid: {e}"))?;
    }
    Ok((record, manifest))
}

/// Re-hash a downloaded file's whole-file BLAKE3 (spec 001 §6) and return
/// its [`BlobId`]. Streams rather than loading the file into memory —
/// media blobs can be large. Synchronous and CPU/IO-bound: callers on the
/// async runtime should run this via `tokio::task::spawn_blocking`.
pub fn rehash_blob_file(path: &Path) -> std::io::Result<BlobId> {
    let file = File::open(path)?;
    let (id, _size) = blob::hash_stream(file).map_err(|e| std::io::Error::other(e.to_string()))?;
    Ok(id)
}

/// Recompute a downloaded file's chunk-tree root (spec 001 §8), for
/// manifests whose `Media::chunk_root` is `Some` (required once a blob
/// exceeds one chunk — [`evermesh_kernel::kinds::content::Media::parse`]'s
/// 1 MiB rule). `Ok(None)` for the empty file (no chunks, no root) — the
/// same case [`blob::ChunkTree::root`] reports for zero-length input.
pub fn chunk_root_of_file(path: &Path) -> std::io::Result<Option<[u8; 32]>> {
    let file = File::open(path)?;
    let tree = blob::ChunkTree::build(file).map_err(|e| std::io::Error::other(e.to_string()))?;
    Ok(tree.root())
}

/// Verify a downloaded file's content-address integrity against what a
/// manifest claims for it: whole-file hash must match `expected_blob`,
/// and — when `expected_chunk_root` is `Some` — the chunk-tree root must
/// match too. This is the check
/// [`crate::pinning::PinStore::pin`] MUST run before persisting a pin;
/// a manifest signature proves *authorship* of the claim, not that any
/// particular gateway actually served the claimed bytes.
pub fn verify_downloaded_blob(
    path: &Path,
    expected_blob: BlobId,
    expected_chunk_root: Option<[u8; 32]>,
) -> Result<(), String> {
    let actual =
        rehash_blob_file(path).map_err(|e| format!("could not re-hash downloaded file: {e}"))?;
    if actual != expected_blob {
        return Err(format!(
            "content-address mismatch: downloaded bytes hash to {}, manifest claims {}",
            actual.to_hex(),
            expected_blob.to_hex()
        ));
    }
    if let Some(expected_root) = expected_chunk_root {
        let actual_root = chunk_root_of_file(path)
            .map_err(|e| format!("could not recompute chunk-tree root: {e}"))?
            .ok_or_else(|| {
                "manifest declares a chunk_root but the downloaded file has zero chunks".to_string()
            })?;
        if actual_root != expected_root {
            return Err(
                "chunk-tree root mismatch: downloaded bytes do not match the manifest's chunk_root"
                    .to_string(),
            );
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use evermesh_kernel::identity::Keypair;
    use evermesh_kernel::record::RecordBuilder;
    use evermesh_kernel::{codec::Value, IdentityId};
    use std::io::Write;

    fn kp() -> Keypair {
        Keypair::from_secret_bytes(&[9u8; 32])
    }

    #[test]
    fn verify_record_cbor_accepts_a_freshly_signed_record() {
        let record = RecordBuilder::new(1)
            .created_at(1000)
            .body(Value::Map(vec![(
                Value::Text("text".into()),
                Value::Text("hi".into()),
            )]))
            .sign_as(&kp(), IdentityId::ZERO)
            .unwrap();
        let cbor = record.to_canonical_cbor();
        match verify_record_cbor(&cbor) {
            VerifyVerdict::Verified { record_id, .. } => {
                assert_eq!(record_id, record.id().to_hex())
            }
            VerifyVerdict::Failed { reason } => panic!("expected verified, got failed: {reason}"),
        }
    }

    #[test]
    fn verify_record_cbor_rejects_garbage() {
        match verify_record_cbor(b"not cbor at all") {
            VerifyVerdict::Failed { .. } => {}
            VerifyVerdict::Verified { .. } => panic!("garbage bytes must not verify"),
        }
    }

    #[test]
    fn verify_record_cbor_rejects_tampered_signature() {
        let record = RecordBuilder::new(1)
            .created_at(1000)
            .body(Value::Map(vec![]))
            .sign_as(&kp(), IdentityId::ZERO)
            .unwrap();
        let mut cbor = record.to_canonical_cbor();
        let last = cbor.len() - 1;
        cbor[last] ^= 0xff;
        match verify_record_cbor(&cbor) {
            VerifyVerdict::Failed { .. } => {}
            VerifyVerdict::Verified { .. } => panic!("tampered bytes must not verify"),
        }
    }

    fn write_temp_file(bytes: &[u8]) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "evermesh-node-verify-test-{}-{}",
            std::process::id(),
            fastrand_seed()
        ));
        let mut f = File::create(&path).unwrap();
        f.write_all(bytes).unwrap();
        path
    }

    fn fastrand_seed() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64
    }

    #[test]
    fn rehash_blob_file_matches_kernel_hash_blob() {
        let bytes = b"hello evermesh".to_vec();
        let path = write_temp_file(&bytes);
        let expected = blob::hash_blob(&bytes);
        assert_eq!(rehash_blob_file(&path).unwrap(), expected);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn verify_downloaded_blob_rejects_wrong_content() {
        let path = write_temp_file(b"actual bytes on disk");
        let wrong_expected = BlobId([0xAB; 32]);
        let result = verify_downloaded_blob(&path, wrong_expected, None);
        assert!(result.is_err());
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn verify_downloaded_blob_accepts_matching_content() {
        let bytes = b"exactly these bytes".to_vec();
        let path = write_temp_file(&bytes);
        let expected = blob::hash_blob(&bytes);
        assert!(verify_downloaded_blob(&path, expected, None).is_ok());
        std::fs::remove_file(&path).ok();
    }
}
