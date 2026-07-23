//! Pin store: what a Evermesh node persists.
//!
//! ## Design (spec 000 §4)
//!
//! - Backing store: a single SQLite database, one file per node install, at
//!   `<app-data-dir>/pins.sqlite3` (see [`PinStore::DB_FILE_NAME`]).
//! - Three tables: `pins` (blob_id, manifest_id, reason, pinned_at),
//!   `budget` (disk_gb, bandwidth_mbps, updated_at), and `manifest_cache`
//!   (record_id, author, title, media_kind, duration_ms,
//!   cover_or_thumb_blob, original_blob_id, body_json, cached_at) — the
//!   offline library index: every manifest this node has
//!   fetched-and-verified, whether or not its media blob is pinned, so
//!   `list_library` has something to show immediately after a
//!   `fetch_and_verify_manifest` and doesn't have to wait on a full blob
//!   download.
//! - `reason` is one of [`PinReason::Explicit`] (spec 000 §4: nodes "pin
//!   chosen content") or [`PinReason::Subscription`] (nodes "seed watched
//!   content").
//! - Pin priority: explicit pins are never evicted by budget pressure;
//!   subscription pins are evicted oldest-first once over budget. Eviction
//!   itself is not implemented yet (no seeding/swarm participation exists
//!   to make room for) — see the crate README.
//! - Everything here is content-addressed against `evermesh-kernel` ids
//!   ([`BlobId`] for the bytes, [`RecordId`] for the manifest that named
//!   them) — the node never invents its own identifiers.
//!
//! `PinStore::open` now does real I/O (creates the app-data directory,
//! opens/migrates the sqlite file) and every accessor is fallible — this
//! is the promotion promised by the Phase 8 scaffold's doc comments ("the
//! real implementation will run migrations and return a `Result`").

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use evermesh_kernel::{BlobId, IdentityId, RecordId};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

/// Every way the pin store can fail. Never panics on caller input; I/O and
/// sqlite failures are surfaced here instead.
#[derive(Debug)]
pub enum PinError {
    /// Could not create/access the app-data directory.
    Io(std::io::Error),
    /// The underlying sqlite database rejected an operation.
    Sqlite(rusqlite::Error),
}

impl std::fmt::Display for PinError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PinError::Io(e) => write!(f, "pin store i/o error: {e}"),
            PinError::Sqlite(e) => write!(f, "pin store database error: {e}"),
        }
    }
}

impl std::error::Error for PinError {}

impl From<std::io::Error> for PinError {
    fn from(e: std::io::Error) -> Self {
        PinError::Io(e)
    }
}

impl From<rusqlite::Error> for PinError {
    fn from(e: rusqlite::Error) -> Self {
        PinError::Sqlite(e)
    }
}

/// Pin store result alias.
pub type Result<T> = std::result::Result<T, PinError>;

/// Why a piece of content is pinned (spec 000 §4: "pins chosen content;
/// seeds watched content").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PinReason {
    /// The node owner explicitly chose to pin this content.
    Explicit,
    /// Pinned because it belongs to a followed/subscribed channel.
    Subscription,
}

impl PinReason {
    fn as_db_str(self) -> &'static str {
        match self {
            PinReason::Explicit => "explicit",
            PinReason::Subscription => "subscription",
        }
    }

    fn from_db_str(s: &str) -> Option<PinReason> {
        match s {
            "explicit" => Some(PinReason::Explicit),
            "subscription" => Some(PinReason::Subscription),
            _ => None,
        }
    }
}

/// A single pinned item as persisted.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PinnedItem {
    /// The pinned blob's content hash, `b3-256:<hex>` text form.
    pub blob_id: String,
    /// The manifest record that named this blob, if known (hex).
    pub manifest_id: Option<String>,
    /// Why this item is pinned.
    pub reason: PinReason,
    /// Unix seconds this pin was created.
    pub pinned_at: i64,
}

/// This node's disk/bandwidth budget (spec 000 §4: "honors its own
/// budgets").
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Budget {
    /// Disk space reserved for pinned/seeded content, in gigabytes.
    pub disk_gb: u64,
    /// Upload bandwidth ceiling while seeding, in megabits per second.
    pub bandwidth_mbps: u64,
}

/// A video or audio work (DMTAP §24.4.2: presence of width/height on the
/// manifest's `original` is the discriminator, restated here for the
/// offline-library index rather than re-deriving it on every read).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MediaKind {
    Video,
    Audio,
}

impl MediaKind {
    fn as_db_str(self) -> &'static str {
        match self {
            MediaKind::Video => "video",
            MediaKind::Audio => "audio",
        }
    }

    fn from_db_str(s: &str) -> MediaKind {
        // Forward-compatible default: an unrecognized token (should not
        // happen; media_kind is derived, not user input) is treated as
        // audio rather than panicking, matching the kernel's
        // "unknown must not crash the reader" convention.
        if s == "video" {
            MediaKind::Video
        } else {
            MediaKind::Audio
        }
    }
}

/// An entry in the offline-library cache: a manifest this node has
/// fetched and verified, whether or not its media blob is pinned.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestCacheEntry {
    /// Manifest record id, hex.
    pub record_id: String,
    /// Author identity id, hex.
    pub author: String,
    pub title: String,
    pub media_kind: MediaKind,
    pub duration_ms: u64,
    /// Cover/thumbnail blob id, hex, if any.
    pub cover_or_thumb_blob: Option<String>,
    /// The manifest's playable media blob id, hex — stored here (not just
    /// derivable from a playback URL) so a purely offline read of the
    /// library can go straight to `local_media_path` without a gateway
    /// round-trip. `None` only for pre-existing rows from before this
    /// column existed.
    pub original_blob_id: Option<String>,
    /// The full gateway detail response, as JSON text, for offline
    /// rendering without re-fetching.
    pub body_json: String,
    /// Unix seconds this entry was cached (or last refreshed).
    pub cached_at: i64,
    /// True when this entry's media blob is currently pinned — computed at
    /// read time by joining against `pins`, not stored redundantly.
    pub pinned: bool,
}

/// Fields needed to write one `manifest_cache` row. Kept separate from
/// [`ManifestCacheEntry`] (the read shape) because `pinned` is derived,
/// never written directly.
#[derive(Debug, Clone)]
pub struct ManifestCacheWrite {
    pub record_id: RecordId,
    pub author: IdentityId,
    pub title: String,
    pub media_kind: MediaKind,
    pub duration_ms: u64,
    pub cover_or_thumb_blob: Option<BlobId>,
    pub original_blob_id: BlobId,
    pub body_json: String,
}

/// Handle to the node's pin database. Cheap to clone-by-reference: the
/// sqlite connection is behind a [`Mutex`] so every accessor takes `&self`
/// and can be called from any Tauri command handler.
pub struct PinStore {
    db_path: PathBuf,
    conn: Mutex<Connection>,
}

impl std::fmt::Debug for PinStore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PinStore")
            .field("db_path", &self.db_path)
            .finish_non_exhaustive()
    }
}

const MIGRATIONS: &str = "
CREATE TABLE IF NOT EXISTS pins (
    blob_id     TEXT PRIMARY KEY,
    manifest_id TEXT,
    reason      TEXT NOT NULL,
    pinned_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS budget (
    id             INTEGER PRIMARY KEY CHECK (id = 0),
    disk_gb        INTEGER NOT NULL,
    bandwidth_mbps INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS manifest_cache (
    record_id           TEXT PRIMARY KEY,
    author               TEXT NOT NULL,
    title                TEXT NOT NULL,
    media_kind           TEXT NOT NULL,
    duration_ms          INTEGER NOT NULL,
    cover_or_thumb_blob  TEXT,
    original_blob_id     TEXT,
    body_json            TEXT NOT NULL,
    cached_at            INTEGER NOT NULL
);
";

fn now_unix() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

impl PinStore {
    /// The database file name within the node's app-data directory.
    pub const DB_FILE_NAME: &'static str = "pins.sqlite3";

    /// Open (creating and migrating if needed) the pin store rooted at
    /// `data_dir`. Creates `data_dir` if it does not exist.
    pub fn open(data_dir: impl AsRef<Path>) -> Result<PinStore> {
        let data_dir = data_dir.as_ref();
        std::fs::create_dir_all(data_dir)?;
        let db_path = data_dir.join(Self::DB_FILE_NAME);
        let conn = Connection::open(&db_path)?;
        conn.execute_batch(MIGRATIONS)?;
        Ok(PinStore {
            db_path,
            conn: Mutex::new(conn),
        })
    }

    /// Open an in-memory store — used by tests so they never touch disk.
    #[cfg(test)]
    fn open_in_memory() -> Result<PinStore> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(MIGRATIONS)?;
        Ok(PinStore {
            db_path: PathBuf::from(":memory:"),
            conn: Mutex::new(conn),
        })
    }

    /// The resolved database file path.
    pub fn db_path(&self) -> &Path {
        &self.db_path
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// List every currently pinned item, most recently pinned first.
    pub fn list_pins(&self) -> Result<Vec<PinnedItem>> {
        let conn = self.lock();
        let mut stmt = conn.prepare(
            "SELECT blob_id, manifest_id, reason, pinned_at FROM pins ORDER BY pinned_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            let reason_str: String = row.get(2)?;
            Ok(PinnedItem {
                blob_id: row.get(0)?,
                manifest_id: row.get(1)?,
                reason: PinReason::from_db_str(&reason_str).unwrap_or(PinReason::Subscription),
                pinned_at: row.get(3)?,
            })
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(PinError::from)
    }

    /// Number of pinned items.
    pub fn pinned_count(&self) -> Result<u64> {
        let conn = self.lock();
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM pins", [], |row| row.get(0))?;
        Ok(n as u64)
    }

    /// Pin a blob by explicit user choice or subscription membership.
    /// Idempotent: pinning an already-pinned blob updates its reason and
    /// manifest association rather than erroring.
    pub fn pin(
        &self,
        blob_id: BlobId,
        manifest_id: Option<RecordId>,
        reason: PinReason,
    ) -> Result<()> {
        let conn = self.lock();
        conn.execute(
            "INSERT INTO pins (blob_id, manifest_id, reason, pinned_at) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(blob_id) DO UPDATE SET manifest_id = excluded.manifest_id, reason = excluded.reason",
            params![
                blob_id.to_hex(),
                manifest_id.map(|id| id.to_hex()),
                reason.as_db_str(),
                now_unix(),
            ],
        )?;
        Ok(())
    }

    /// Unpin a blob. Returns whether a row existed.
    pub fn unpin(&self, blob_id: &BlobId) -> Result<bool> {
        let conn = self.lock();
        let n = conn.execute(
            "DELETE FROM pins WHERE blob_id = ?1",
            params![blob_id.to_hex()],
        )?;
        Ok(n > 0)
    }

    /// Whether a given blob is currently pinned.
    pub fn is_pinned(&self, blob_id: &BlobId) -> Result<bool> {
        let conn = self.lock();
        let found: Option<i64> = conn
            .query_row(
                "SELECT 1 FROM pins WHERE blob_id = ?1",
                params![blob_id.to_hex()],
                |row| row.get(0),
            )
            .optional()?;
        Ok(found.is_some())
    }

    /// This node's current budget configuration; the zero/unconfigured
    /// default on first run (no row yet).
    pub fn budget(&self) -> Result<Budget> {
        let conn = self.lock();
        let row: Option<(u64, u64)> = conn
            .query_row(
                "SELECT disk_gb, bandwidth_mbps FROM budget WHERE id = 0",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        Ok(match row {
            Some((disk_gb, bandwidth_mbps)) => Budget {
                disk_gb,
                bandwidth_mbps,
            },
            None => Budget::default(),
        })
    }

    /// Update the node's budget configuration.
    pub fn set_budget(&self, budget: Budget) -> Result<()> {
        let conn = self.lock();
        conn.execute(
            "INSERT INTO budget (id, disk_gb, bandwidth_mbps, updated_at) VALUES (0, ?1, ?2, ?3)
             ON CONFLICT(id) DO UPDATE SET disk_gb = excluded.disk_gb, bandwidth_mbps = excluded.bandwidth_mbps, updated_at = excluded.updated_at",
            params![budget.disk_gb, budget.bandwidth_mbps, now_unix()],
        )?;
        // TODO(future): once seeding/swarm participation exists, re-evaluate
        // subscription-pin eviction against the new disk_gb ceiling here
        // (explicit pins are never auto-evicted — see module docs).
        Ok(())
    }

    /// Upsert a manifest into the offline-library cache (spec 000 §4's
    /// node has "no public-facing duties" but does keep its own view of
    /// what it has verified — this is that view).
    pub fn cache_manifest(&self, entry: &ManifestCacheWrite) -> Result<()> {
        let conn = self.lock();
        conn.execute(
            "INSERT INTO manifest_cache
                (record_id, author, title, media_kind, duration_ms, cover_or_thumb_blob, original_blob_id, body_json, cached_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(record_id) DO UPDATE SET
                author = excluded.author,
                title = excluded.title,
                media_kind = excluded.media_kind,
                duration_ms = excluded.duration_ms,
                cover_or_thumb_blob = excluded.cover_or_thumb_blob,
                original_blob_id = excluded.original_blob_id,
                body_json = excluded.body_json,
                cached_at = excluded.cached_at",
            params![
                entry.record_id.to_hex(),
                entry.author.to_hex(),
                entry.title,
                entry.media_kind.as_db_str(),
                entry.duration_ms,
                entry.cover_or_thumb_blob.map(|b| b.to_hex()),
                entry.original_blob_id.to_hex(),
                entry.body_json,
                now_unix(),
            ],
        )?;
        Ok(())
    }

    /// List every cached manifest (the offline library), most recently
    /// cached first, joined against `pins` so callers can tell pinned
    /// (offline-playable) entries from merely-seen ones.
    pub fn list_cached_manifests(&self) -> Result<Vec<ManifestCacheEntry>> {
        let conn = self.lock();
        let mut stmt = conn.prepare(
            "SELECT m.record_id, m.author, m.title, m.media_kind, m.duration_ms,
                    m.cover_or_thumb_blob, m.original_blob_id, m.body_json, m.cached_at,
                    EXISTS(SELECT 1 FROM pins p WHERE p.manifest_id = m.record_id) AS pinned
             FROM manifest_cache m
             ORDER BY m.cached_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            let media_kind_str: String = row.get(3)?;
            let pinned: i64 = row.get(9)?;
            Ok(ManifestCacheEntry {
                record_id: row.get(0)?,
                author: row.get(1)?,
                title: row.get(2)?,
                media_kind: MediaKind::from_db_str(&media_kind_str),
                duration_ms: row.get(4)?,
                cover_or_thumb_blob: row.get(5)?,
                original_blob_id: row.get(6)?,
                body_json: row.get(7)?,
                cached_at: row.get(8)?,
                pinned: pinned != 0,
            })
        })?;
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(PinError::from)
    }

    /// Look up one cached manifest by record id (hex).
    pub fn get_cached_manifest(&self, record_id_hex: &str) -> Result<Option<ManifestCacheEntry>> {
        Ok(self
            .list_cached_manifests()?
            .into_iter()
            .find(|e| e.record_id.eq_ignore_ascii_case(record_id_hex)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_creates_and_migrates_and_starts_empty() {
        let store = PinStore::open_in_memory().unwrap();
        assert!(store.db_path().to_string_lossy().contains("memory"));
        assert_eq!(store.pinned_count().unwrap(), 0);
        assert!(store.list_pins().unwrap().is_empty());
        assert_eq!(store.budget().unwrap(), Budget::default());
        assert!(store.list_cached_manifests().unwrap().is_empty());
    }

    #[test]
    fn open_on_a_real_directory_persists_across_reopen() {
        let dir = tempfile_dir();
        {
            let store = PinStore::open(&dir).unwrap();
            store
                .pin(
                    BlobId([1u8; 32]),
                    Some(RecordId([2u8; 32])),
                    PinReason::Explicit,
                )
                .unwrap();
        }
        // Reopen: the file must have actually been written.
        let store = PinStore::open(&dir).unwrap();
        assert_eq!(store.pinned_count().unwrap(), 1);
        assert!(store.db_path().exists());
        std::fs::remove_dir_all(&dir).ok();
    }

    fn tempfile_dir() -> PathBuf {
        let mut dir = std::env::temp_dir();
        let unique = format!(
            "evermesh-node-pinstore-test-{}-{}",
            std::process::id(),
            now_unix()
        );
        dir.push(unique);
        dir
    }

    #[test]
    fn pin_unpin_and_is_pinned_round_trip() {
        let store = PinStore::open_in_memory().unwrap();
        let blob = BlobId([7u8; 32]);
        assert!(!store.is_pinned(&blob).unwrap());

        store.pin(blob, None, PinReason::Explicit).unwrap();
        assert!(store.is_pinned(&blob).unwrap());
        assert_eq!(store.pinned_count().unwrap(), 1);

        let pins = store.list_pins().unwrap();
        assert_eq!(pins.len(), 1);
        assert_eq!(pins[0].blob_id, blob.to_hex());
        assert_eq!(pins[0].reason, PinReason::Explicit);

        assert!(store.unpin(&blob).unwrap());
        assert!(!store.is_pinned(&blob).unwrap());
        assert!(!store.unpin(&blob).unwrap()); // already gone
    }

    #[test]
    fn pinning_twice_upserts_reason_rather_than_erroring() {
        let store = PinStore::open_in_memory().unwrap();
        let blob = BlobId([3u8; 32]);
        store.pin(blob, None, PinReason::Subscription).unwrap();
        store.pin(blob, None, PinReason::Explicit).unwrap();
        assert_eq!(store.pinned_count().unwrap(), 1);
        assert_eq!(store.list_pins().unwrap()[0].reason, PinReason::Explicit);
    }

    #[test]
    fn budget_round_trips_and_defaults_to_zero() {
        let store = PinStore::open_in_memory().unwrap();
        assert_eq!(store.budget().unwrap(), Budget::default());
        store
            .set_budget(Budget {
                disk_gb: 50,
                bandwidth_mbps: 10,
            })
            .unwrap();
        assert_eq!(
            store.budget().unwrap(),
            Budget {
                disk_gb: 50,
                bandwidth_mbps: 10
            }
        );
        // Setting again must update, not insert a second row.
        store
            .set_budget(Budget {
                disk_gb: 5,
                bandwidth_mbps: 1,
            })
            .unwrap();
        assert_eq!(
            store.budget().unwrap(),
            Budget {
                disk_gb: 5,
                bandwidth_mbps: 1
            }
        );
    }

    #[test]
    fn manifest_cache_round_trips_and_reports_pinned_state() {
        let store = PinStore::open_in_memory().unwrap();
        let record_id = RecordId([9u8; 32]);
        let blob_id = BlobId([9u8; 32]);
        store
            .cache_manifest(&ManifestCacheWrite {
                record_id,
                author: IdentityId([1u8; 32]),
                title: "A title".into(),
                media_kind: MediaKind::Video,
                duration_ms: 60_000,
                cover_or_thumb_blob: Some(BlobId([2u8; 32])),
                original_blob_id: blob_id,
                body_json: "{}".into(),
            })
            .unwrap();

        let items = store.list_cached_manifests().unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].record_id, record_id.to_hex());
        assert_eq!(items[0].title, "A title");
        assert!(!items[0].pinned);

        store
            .pin(blob_id, Some(record_id), PinReason::Explicit)
            .unwrap();
        let items = store.list_cached_manifests().unwrap();
        assert!(items[0].pinned);

        let one = store.get_cached_manifest(&record_id.to_hex()).unwrap();
        assert!(one.is_some());
        assert!(store.get_cached_manifest("00").unwrap().is_none());
    }

    #[test]
    fn cache_manifest_upserts_by_record_id() {
        let store = PinStore::open_in_memory().unwrap();
        let record_id = RecordId([4u8; 32]);
        let base = ManifestCacheWrite {
            record_id,
            author: IdentityId([1u8; 32]),
            title: "First".into(),
            media_kind: MediaKind::Audio,
            duration_ms: 1000,
            cover_or_thumb_blob: None,
            original_blob_id: BlobId([4u8; 32]),
            body_json: "{}".into(),
        };
        store.cache_manifest(&base).unwrap();
        store
            .cache_manifest(&ManifestCacheWrite {
                title: "Updated".into(),
                ..base
            })
            .unwrap();
        let items = store.list_cached_manifests().unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "Updated");
    }
}
