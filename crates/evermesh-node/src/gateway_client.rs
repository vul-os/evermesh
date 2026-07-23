//! HTTP client for a gateway's public JSON API (`apps/gateway/API.md`).
//!
//! Every network call the node app makes happens here, in Rust, rather
//! than from the webview: doing HTTP natively means (a) no browser CORS
//! policy to fight — the gateway's read API was written for same-origin
//! browser fetches, not an arbitrary desktop app origin — and (b) raw
//! bytes (record CBOR, media blobs) pass through [`crate::verify`]'s
//! native verification *before* anything reaches the UI layer, so a
//! compromised or buggy webview can never skip the check by racing a
//! `fetch()` ahead of it.
//!
//! Response shapes below are hand-typed from
//! `apps/gateway/server/src/api/view-helpers.ts` (camelCase on the wire,
//! matching `apps/gateway/web/src/lib/api-types.ts`) — no schema
//! validation beyond serde's, same tradeoff the reference web frontend
//! makes (API.md is the authoritative contract for both).

use std::path::Path;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;

/// Every way a gateway call can fail.
#[derive(Debug)]
pub enum GatewayError {
    /// `gateway_url` is not an absolute `http(s)` URL.
    InvalidUrl(String),
    /// The request could not be sent, or the response could not be read.
    Transport(reqwest::Error),
    /// The gateway responded with a non-2xx status.
    Api { status: u16, message: String },
    /// A local filesystem error while streaming a download to disk.
    Io(std::io::Error),
}

impl std::fmt::Display for GatewayError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GatewayError::InvalidUrl(u) => write!(f, "invalid gateway URL: {u}"),
            GatewayError::Transport(e) => write!(f, "gateway request failed: {e}"),
            GatewayError::Api { status, message } => {
                write!(f, "gateway returned {status}: {message}")
            }
            GatewayError::Io(e) => write!(f, "local i/o error: {e}"),
        }
    }
}

impl std::error::Error for GatewayError {}

impl From<reqwest::Error> for GatewayError {
    fn from(e: reqwest::Error) -> Self {
        GatewayError::Transport(e)
    }
}

impl From<std::io::Error> for GatewayError {
    fn from(e: std::io::Error) -> Self {
        GatewayError::Io(e)
    }
}

/// Gateway API result alias.
pub type Result<T> = std::result::Result<T, GatewayError>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorRef {
    pub identity_id: String,
    pub name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoSummary {
    pub id: String,
    pub title: String,
    pub author: AuthorRef,
    pub thumbnail_url: Option<String>,
    /// `"video"` or `"audio"` (DMTAP §24.4.2: derived server-side from
    /// whether the manifest's `original` carries width/height).
    pub media_kind: String,
    pub cover_art_url: Option<String>,
    pub duration_ms: u64,
    pub created_at: i64,
    pub channel_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogPage {
    pub items: Vec<VideoSummary>,
    pub next: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenditionView {
    pub height: u32,
    pub hls_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptionView {
    pub language: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Playback {
    pub hls_url: Option<String>,
    pub mp4_url: Option<String>,
    #[serde(default)]
    pub renditions: Vec<RenditionView>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoCounts {
    pub comments: u64,
    #[serde(default)]
    pub reactions: serde_json::Map<String, serde_json::Value>,
}

/// `GET /api/videos/{id}` (API.md): a manifest's full detail view,
/// including the playback URLs the [`crate::verify`]-checked record
/// itself does not carry (those are a gateway-serving-layer convenience,
/// not substrate state — see `apps/gateway/server/src/media.ts`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoDetail {
    pub id: String,
    pub title: String,
    pub author: AuthorRef,
    pub thumbnail_url: Option<String>,
    pub media_kind: String,
    pub cover_art_url: Option<String>,
    pub duration_ms: u64,
    pub created_at: i64,
    pub channel_id: Option<String>,
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub language: Option<String>,
    /// The record's JSON interchange form (spec 001 §11) — informational
    /// only; the node never trusts this over the CBOR it verifies itself.
    pub record: serde_json::Value,
    pub record_cbor_url: String,
    pub playback: Playback,
    #[serde(default)]
    pub captions: Vec<CaptionView>,
    pub license: String,
    #[serde(default)]
    pub payment: Vec<serde_json::Value>,
    #[serde(default)]
    pub sponsorship: Vec<serde_json::Value>,
    pub counts: VideoCounts,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistView {
    pub id: String,
    pub title: String,
    pub description: String,
    pub author: AuthorRef,
    pub created_at: i64,
    pub entry_count: u64,
    pub entries: Vec<VideoSummary>,
}

/// A thin, cloneable client bound to one gateway origin. Cheap to
/// construct per call: `reqwest::Client` is `Arc`-backed internally, so
/// cloning the shared transport into a new `GatewayClient` allocates
/// nothing but the base URL string.
#[derive(Debug, Clone)]
pub struct GatewayClient {
    http: reqwest::Client,
    base: reqwest::Url,
}

fn validate_base_url(gateway_url: &str) -> Result<reqwest::Url> {
    let url = reqwest::Url::parse(gateway_url)
        .map_err(|_| GatewayError::InvalidUrl(gateway_url.to_string()))?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(GatewayError::InvalidUrl(gateway_url.to_string()));
    }
    if url.host_str().is_none() {
        return Err(GatewayError::InvalidUrl(gateway_url.to_string()));
    }
    Ok(url)
}

async fn read_error_body(resp: reqwest::Response) -> String {
    #[derive(Deserialize)]
    struct ErrEnvelope {
        error: Option<ErrBody>,
    }
    #[derive(Deserialize)]
    struct ErrBody {
        message: Option<String>,
    }
    let status = resp.status();
    match resp.text().await {
        Ok(body) => serde_json::from_str::<ErrEnvelope>(&body)
            .ok()
            .and_then(|e| e.error)
            .and_then(|e| e.message)
            .unwrap_or_else(|| {
                if body.is_empty() {
                    status.to_string()
                } else {
                    body
                }
            }),
        Err(_) => status.to_string(),
    }
}

impl GatewayClient {
    /// Bind a client to `gateway_url`, which MUST be an absolute `http(s)`
    /// URL — rejecting anything else here (before a single request is
    /// made) is the node's one SSRF guard for user-supplied gateway
    /// origins: no `file:`, no schemeless host, no relative path.
    pub fn new(http: reqwest::Client, gateway_url: &str) -> Result<GatewayClient> {
        let base = validate_base_url(gateway_url)?;
        Ok(GatewayClient { http, base })
    }

    /// The validated origin this client is bound to (`scheme://host[:port]`).
    pub fn origin(&self) -> String {
        self.base.origin().unicode_serialization()
    }

    fn url(&self, path: &str) -> reqwest::Url {
        // `path` is always a fixed API route this module builds (never
        // pass-through user input), so join() failing would be a bug, not
        // untrusted input — fall back to the base URL rather than panic.
        self.base.join(path).unwrap_or_else(|_| self.base.clone())
    }

    /// Resolve a gateway-relative URL (e.g. `/media/blob/<hex>` from a
    /// `VideoDetail.playback` field) against this client's origin. Already
    /// absolute URLs are returned unchanged.
    pub fn resolve(&self, maybe_relative: &str) -> String {
        match reqwest::Url::parse(maybe_relative) {
            Ok(absolute) => absolute.to_string(),
            Err(_) => self.url(maybe_relative).to_string(),
        }
    }

    async fn get_json<T: for<'de> Deserialize<'de>>(&self, path: &str) -> Result<T> {
        let resp = self.http.get(self.url(path)).send().await?;
        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let message = read_error_body(resp).await;
            return Err(GatewayError::Api { status, message });
        }
        Ok(resp.json::<T>().await?)
    }

    /// `GET /api/videos` — the catalog page (video **and** audio; API.md's
    /// `mediaKind` filter, `videos.ts`).
    pub async fn list_videos(
        &self,
        cursor: Option<&str>,
        media_kind: Option<&str>,
    ) -> Result<CatalogPage> {
        let mut path = "/api/videos?limit=30".to_string();
        if let Some(c) = cursor {
            path.push_str("&cursor=");
            path.push_str(&urlencode(c));
        }
        if let Some(k) = media_kind {
            path.push_str("&mediaKind=");
            path.push_str(&urlencode(k));
        }
        self.get_json(&path).await
    }

    /// `GET /api/videos/{id}` — full manifest detail, including playback
    /// URLs and the `recordCborUrl` [`Self::get_record_cbor`] fetches.
    pub async fn get_video(&self, manifest_id: &str) -> Result<VideoDetail> {
        self.get_json(&format!("/api/videos/{}", urlencode(manifest_id)))
            .await
    }

    /// `GET /api/playlists/{id}`.
    pub async fn get_playlist(&self, record_id: &str) -> Result<PlaylistView> {
        self.get_json(&format!("/api/playlists/{}", urlencode(record_id)))
            .await
    }

    /// `GET /api/records/{id}/cbor` — the canonical signed bytes
    /// [`crate::verify`] checks. Never trust `VideoDetail.record` (the
    /// JSON interchange form) in its place: verification must run against
    /// exactly the bytes the signature covers.
    pub async fn get_record_cbor(&self, record_id: &str) -> Result<Vec<u8>> {
        let resp = self
            .http
            .get(self.url(&format!("/api/records/{}/cbor", urlencode(record_id))))
            .send()
            .await?;
        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let message = read_error_body(resp).await;
            return Err(GatewayError::Api { status, message });
        }
        Ok(resp.bytes().await?.to_vec())
    }

    /// Stream a blob (`/media/blob/{id}` or any absolute media URL the
    /// gateway returned) to a local file, returning the number of bytes
    /// written. Does not verify anything itself — see
    /// [`crate::verify::rehash_blob_file`], which the caller MUST run on
    /// `dest` before trusting or pinning it.
    pub async fn download_to_file(&self, url_or_path: &str, dest: &Path) -> Result<u64> {
        let url = self.resolve(url_or_path);
        let resp = self.http.get(&url).send().await?;
        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let message = read_error_body(resp).await;
            return Err(GatewayError::Api { status, message });
        }
        if let Some(parent) = dest.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        let mut file = tokio::fs::File::create(dest).await?;
        let mut total: u64 = 0;
        let mut stream = resp.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk).await?;
            total += chunk.len() as u64;
        }
        file.flush().await?;
        Ok(total)
    }
}

fn urlencode(s: &str) -> String {
    // Path/query segments here are always hex record/blob ids or short
    // cursor tokens (base64url) — percent-encode conservatively rather
    // than pull in a full form-urlencoded crate for this one call site.
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_base_url_accepts_http_and_https() {
        assert!(validate_base_url("https://gateway.example").is_ok());
        assert!(validate_base_url("http://localhost:8600").is_ok());
    }

    #[test]
    fn validate_base_url_rejects_non_http_schemes() {
        assert!(validate_base_url("file:///etc/passwd").is_err());
        assert!(validate_base_url("ftp://example.com").is_err());
        assert!(validate_base_url("not a url").is_err());
        assert!(validate_base_url("javascript:alert(1)").is_err());
    }

    #[test]
    fn resolve_joins_relative_paths_against_the_bound_origin() {
        let http = reqwest::Client::new();
        let client = GatewayClient::new(http, "https://gateway.example").unwrap();
        assert_eq!(
            client.resolve("/media/blob/abcd"),
            "https://gateway.example/media/blob/abcd"
        );
        // Already-absolute URLs pass through unchanged.
        assert_eq!(
            client.resolve("https://other.example/x"),
            "https://other.example/x"
        );
    }

    #[test]
    fn urlencode_leaves_hex_ids_untouched() {
        let hex = "a".repeat(64);
        assert_eq!(urlencode(&hex), hex);
    }
}
