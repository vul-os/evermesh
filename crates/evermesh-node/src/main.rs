//! Evermesh node app: a Tauri 2 desktop media client.
//!
//! Browses a user-configured gateway's public catalog, verifies every
//! manifest natively (no WASM — `evermesh-kernel` is a native dependency
//! of this binary, see `src/verify.rs`), and pins chosen content for
//! offline playback (`src/pinning.rs`). All network I/O happens in Rust
//! (`src/gateway_client.rs`) — the webview never talks to a gateway
//! directly, so playback and browsing are never blocked by that
//! gateway's CORS policy, and verification always runs on bytes before
//! they reach the UI.
//!
//! P2P retrieval (swarm participation, seeding to other nodes) is out of
//! scope for this pass: every read here goes gateway-HTTP, and "pinning"
//! means "kept as a local, re-verified cache" — see the crate README for
//! what is and isn't implemented.

#![forbid(unsafe_code)]

mod gateway_client;
mod pinning;
mod verify;

use std::path::PathBuf;

use evermesh_kernel::{BlobId, IdentityId};
use gateway_client::{CatalogPage, GatewayClient, PlaylistView, VideoDetail};
use pinning::{
    Budget, ManifestCacheEntry, ManifestCacheWrite, MediaKind, PinReason, PinStore, PinnedItem,
};
use serde::Serialize;
use tauri::{Manager, State};
use verify::VerifyVerdict;

/// Shared app state: the pin store (one sqlite connection for the whole
/// app lifetime) and one reusable HTTP transport (cheap to clone into a
/// per-call [`GatewayClient`] — see that module's docs).
struct AppState {
    pins: PinStore,
    http: reqwest::Client,
    data_dir: PathBuf,
}

impl AppState {
    fn blobs_dir(&self) -> PathBuf {
        self.data_dir.join("blobs")
    }

    fn blob_path(&self, blob_id: &BlobId) -> PathBuf {
        self.blobs_dir().join(blob_id.to_hex())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NodeStatus {
    version: &'static str,
    pinned_count: u64,
    seeding: bool,
    /// Where `pins.sqlite3` lives, for the Settings view's "this device"
    /// diagnostics — also exercises [`PinStore::db_path`] outside tests.
    db_path: String,
}

#[tauri::command]
fn node_status(state: State<AppState>) -> Result<NodeStatus, String> {
    let pinned_count = state.pins.pinned_count().map_err(|e| e.to_string())?;
    Ok(NodeStatus {
        version: env!("CARGO_PKG_VERSION"),
        pinned_count,
        // No seeding/swarm participation exists yet (P2P retrieval is out
        // of scope for this pass — see module docs), so this is always
        // false rather than a claim the node cannot back up.
        seeding: false,
        db_path: state.pins.db_path().to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn get_budgets(state: State<AppState>) -> Result<Budget, String> {
    state.pins.budget().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_budget(state: State<AppState>, budget: Budget) -> Result<Budget, String> {
    state.pins.set_budget(budget).map_err(|e| e.to_string())?;
    state.pins.budget().map_err(|e| e.to_string())
}

/// The node's own offline library: every manifest fetched-and-verified so
/// far, pinned or not (spec 000 §4: what this node has chosen to keep a
/// verified view of).
#[tauri::command]
fn list_library(state: State<AppState>) -> Result<Vec<ManifestCacheEntry>, String> {
    state
        .pins
        .list_cached_manifests()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn list_pins(state: State<AppState>) -> Result<Vec<PinnedItem>, String> {
    state.pins.list_pins().map_err(|e| e.to_string())
}

/// Look up one offline-library entry by record id, with no network
/// involved. Lets `Watch`/`Listen` resolve a deep link (a reload, or a
/// link opened outside this session's navigation state) against the
/// local cache before falling back to a live gateway fetch.
#[tauri::command]
fn get_cached_entry(
    state: State<AppState>,
    record_id: String,
) -> Result<Option<ManifestCacheEntry>, String> {
    state
        .pins
        .get_cached_manifest(&record_id)
        .map_err(|e| e.to_string())
}

/// `GET /api/videos` on a user-configured gateway — the remote catalog
/// (`Browse.tsx`'s data source). Filters by `mediaKind` server-side
/// (video and audio share one feed, spec 004 §2 / DMTAP §24.4.2).
#[tauri::command]
async fn fetch_catalog(
    state: State<'_, AppState>,
    gateway_url: String,
    cursor: Option<String>,
    media_kind: Option<String>,
) -> Result<CatalogPage, String> {
    let client = GatewayClient::new(state.http.clone(), &gateway_url).map_err(|e| e.to_string())?;
    client
        .list_videos(cursor.as_deref(), media_kind.as_deref())
        .await
        .map_err(|e| e.to_string())
}

/// Response shape for [`fetch_and_verify_manifest`]: the gateway's
/// (untrusted) detail view, paired with the verdict of independently
/// verifying its record bytes.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManifestFetchResult {
    detail: VideoDetail,
    verdict: VerifyVerdict,
    /// The manifest's `original.blob`, hex, when `verdict` is `Verified`
    /// and the record parses as a well-formed manifest. Lets the caller
    /// go straight to [`local_media_path`] to check for an offline copy,
    /// instead of parsing a blob id back out of a `/media/blob/<hex>`
    /// playback URL string.
    original_blob_id: Option<String>,
}

/// Fetch a manifest's detail view and its canonical record bytes, verify
/// the bytes natively (signature + kind-validity, spec 001/003), and —
/// only on success — cache the manifest into the offline library
/// (`manifest_cache`) so it shows up in `Library.tsx` even before its
/// media blob is pinned. `Watch`/`Listen` call this before ever handing a
/// gateway URL to a `<video>`/`<audio>` element, so nothing plays without
/// having been checked first.
#[tauri::command]
async fn fetch_and_verify_manifest(
    state: State<'_, AppState>,
    gateway_url: String,
    id: String,
) -> Result<ManifestFetchResult, String> {
    let client = GatewayClient::new(state.http.clone(), &gateway_url).map_err(|e| e.to_string())?;
    let detail = client.get_video(&id).await.map_err(|e| e.to_string())?;
    let cbor = client
        .get_record_cbor(&id)
        .await
        .map_err(|e| e.to_string())?;

    let verdict = verify::verify_record_cbor(&cbor);
    let mut original_blob_id = None;

    if let VerifyVerdict::Verified { .. } = &verdict {
        if let Ok((record, manifest)) = verify::verify_and_parse_manifest(&cbor) {
            original_blob_id = Some(manifest.original.blob.to_hex());
            let media_kind = if manifest.original.width.is_some() {
                MediaKind::Video
            } else {
                MediaKind::Audio
            };
            let body_json = serde_json::to_string(&detail).unwrap_or_default();
            let entry = ManifestCacheWrite {
                record_id: record.id(),
                author: IdentityId(record.author_identity_id()),
                title: manifest.title.clone(),
                media_kind,
                duration_ms: manifest.original.duration_ms,
                cover_or_thumb_blob: manifest.thumbnail,
                original_blob_id: manifest.original.blob,
                body_json,
            };
            // Best-effort: a cache-write failure must not fail the fetch
            // the user is actively waiting on (they can still watch/listen
            // now; only "shows up in Library later" is at risk).
            let _ = state.pins.cache_manifest(&entry);
        }
    }

    Ok(ManifestFetchResult {
        detail,
        verdict,
        original_blob_id,
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PinOutcome {
    blob_id: String,
    bytes_written: u64,
    verdict: VerifyVerdict,
}

/// Download, natively re-verify, and pin a manifest's original media blob
/// for offline playback. Order matters and is fixed, not a caller option:
/// 1. fetch + verify the manifest record (signature, kind-validity,
///    per-rendition derivation signatures);
/// 2. download the claimed `original.blob` to the node's app-data dir;
/// 3. re-hash the downloaded bytes (chunked BLAKE3 when the file spans
///    more than one chunk) and compare against the manifest's own claim;
/// 4. only then record the pin.
///
/// A gateway that serves the wrong bytes for a correctly-signed manifest
/// (misconfiguration, a compromised or lying server, transit corruption)
/// is caught at step 3 — signature validity alone never proves *these
/// particular bytes* are the ones the author signed for.
#[tauri::command]
async fn pin_manifest(
    state: State<'_, AppState>,
    gateway_url: String,
    id: String,
) -> Result<PinOutcome, String> {
    let client = GatewayClient::new(state.http.clone(), &gateway_url).map_err(|e| e.to_string())?;
    let cbor = client
        .get_record_cbor(&id)
        .await
        .map_err(|e| e.to_string())?;
    let verdict = verify::verify_record_cbor(&cbor);
    let (record, manifest) = verify::verify_and_parse_manifest(&cbor)?;

    let blob_id = manifest.original.blob;
    let dest = state.blob_path(&blob_id);
    let download_url = format!("{}/media/blob/{}", client.origin(), blob_id.to_hex());
    let bytes_written = client
        .download_to_file(&download_url, &dest)
        .await
        .map_err(|e| e.to_string())?;

    let dest_for_check = dest.clone();
    let chunk_root = manifest.original.chunk_root;
    tokio::task::spawn_blocking(move || {
        verify::verify_downloaded_blob(&dest_for_check, blob_id, chunk_root)
    })
    .await
    .map_err(|e| format!("verification task panicked: {e}"))?
    .inspect_err(|_reason| {
        // Do not leave an unverified file behind under a
        // content-address name — a later `local_media_path` lookup
        // must never resolve to bytes that failed this check.
        let _ = std::fs::remove_file(&dest);
    })?;

    state
        .pins
        .pin(blob_id, Some(record.id()), PinReason::Explicit)
        .map_err(|e| e.to_string())?;

    // Best-effort thumbnail cache alongside the pin, so the library can
    // show cover art fully offline; a failure here does not fail the pin.
    if let Some(thumb) = manifest.thumbnail {
        let thumb_dest = state.blob_path(&thumb);
        if !thumb_dest.exists() {
            let thumb_url = format!("{}/media/thumb/{}", client.origin(), thumb.to_hex());
            if client
                .download_to_file(&thumb_url, &thumb_dest)
                .await
                .is_ok()
            {
                let check_path = thumb_dest.clone();
                let ok = tokio::task::spawn_blocking(move || {
                    verify::verify_downloaded_blob(&check_path, thumb, None)
                })
                .await
                .unwrap_or(Err("panicked".into()))
                .is_ok();
                if !ok {
                    let _ = std::fs::remove_file(&thumb_dest);
                }
            }
        }
    }

    let media_kind = if manifest.original.width.is_some() {
        MediaKind::Video
    } else {
        MediaKind::Audio
    };
    // Prefer the full gateway detail view (playback URLs, description,
    // tags) for the cached body when reachable; fall back to just the
    // verified manifest body so a pin still lands in the library even if
    // this one extra, non-critical fetch fails.
    let body_json = match client.get_video(&id).await {
        Ok(detail) => serde_json::to_string(&detail).unwrap_or_default(),
        Err(_) => evermesh_kernel::codec::to_json(&manifest.to_body()),
    };
    let entry = ManifestCacheWrite {
        record_id: record.id(),
        author: IdentityId(record.author_identity_id()),
        title: manifest.title.clone(),
        media_kind,
        duration_ms: manifest.original.duration_ms,
        cover_or_thumb_blob: manifest.thumbnail,
        original_blob_id: blob_id,
        body_json,
    };
    let _ = state.pins.cache_manifest(&entry);

    Ok(PinOutcome {
        blob_id: blob_id.to_hex(),
        bytes_written,
        verdict,
    })
}

/// Unpin a blob by hex id, deleting its cached bytes from disk. Returns
/// whether a pin existed (matches `PinStore::unpin`'s contract).
#[tauri::command]
fn unpin_blob(state: State<AppState>, blob_id: String) -> Result<bool, String> {
    let blob =
        BlobId::from_hex(&blob_id).ok_or_else(|| format!("not a valid blob id: {blob_id}"))?;
    let existed = state.pins.unpin(&blob).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(state.blob_path(&blob));
    Ok(existed)
}

/// Whether a blob is currently pinned (the `pins` table, not merely "a
/// file happens to exist at that content address" — see
/// [`local_media_path`], which answers the latter). Distinct on purpose:
/// pinned means "kept indefinitely, protected from any future budget
/// eviction"; a cached-but-unpinned file (e.g. a thumbnail fetched
/// alongside a pin) can exist on disk without this being true for it.
#[tauri::command]
fn is_blob_pinned(state: State<AppState>, blob_id: String) -> Result<bool, String> {
    let blob =
        BlobId::from_hex(&blob_id).ok_or_else(|| format!("not a valid blob id: {blob_id}"))?;
    state.pins.is_pinned(&blob).map_err(|e| e.to_string())
}

/// Resolve a blob id to a local file path suitable for
/// `convertFileSrc()`, if this node has that blob cached (pinned, or
/// cached alongside a pin — e.g. a thumbnail). `None` means the caller
/// must fall back to the gateway's remote URL for that blob.
#[tauri::command]
fn local_media_path(state: State<AppState>, blob_id: String) -> Result<Option<String>, String> {
    let blob =
        BlobId::from_hex(&blob_id).ok_or_else(|| format!("not a valid blob id: {blob_id}"))?;
    let path = state.blob_path(&blob);
    Ok(if path.is_file() {
        Some(path.to_string_lossy().into_owned())
    } else {
        None
    })
}

#[tauri::command]
async fn fetch_playlist(
    state: State<'_, AppState>,
    gateway_url: String,
    id: String,
) -> Result<PlaylistView, String> {
    let client = GatewayClient::new(state.http.clone(), &gateway_url).map_err(|e| e.to_string())?;
    client.get_playlist(&id).await.map_err(|e| e.to_string())
}

/// Read-only helper for the Settings view: does `gateway_url` parse as an
/// absolute `http(s)` URL? Lets the UI reject a bad allow-list entry
/// before it is ever passed to a command that would actually dial it.
#[tauri::command]
fn validate_gateway_url(gateway_url: String) -> Result<String, String> {
    let client =
        GatewayClient::new(reqwest::Client::new(), &gateway_url).map_err(|e| e.to_string())?;
    Ok(client.origin())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("could not resolve app data directory: {e}"))?;
            std::fs::create_dir_all(&data_dir)?;
            let pins =
                PinStore::open(&data_dir).map_err(|e| format!("could not open pin store: {e}"))?;
            app.manage(AppState {
                pins,
                http: reqwest::Client::new(),
                data_dir,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            node_status,
            get_budgets,
            set_budget,
            list_library,
            list_pins,
            get_cached_entry,
            fetch_catalog,
            fetch_and_verify_manifest,
            pin_manifest,
            unpin_blob,
            is_blob_pinned,
            local_media_path,
            fetch_playlist,
            validate_gateway_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running evermesh-node");
}
