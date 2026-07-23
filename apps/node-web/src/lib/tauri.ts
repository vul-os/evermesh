/**
 * Typed wrapper around `@tauri-apps/api`'s `invoke()` for every command
 * `crates/evermesh-node/src/main.rs` registers. One function per command,
 * mirroring `apps/gateway/web/src/api.ts`'s "one function per endpoint"
 * shape — except every one of these calls Rust, never a gateway
 * directly: browsing, verification, downloading, and pinning all happen
 * natively (see that crate's module docs), so this file's job is just to
 * give the IPC boundary a typed, discoverable surface.
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  Budget,
  CatalogPage,
  ManifestCacheEntry,
  ManifestFetchResult,
  MediaKind,
  NodeStatus,
  PinOutcome,
  PinnedItem,
  PlaylistView,
} from "./types.js";

export function getNodeStatus(): Promise<NodeStatus> {
  return invoke("node_status");
}

export function getBudgets(): Promise<Budget> {
  return invoke("get_budgets");
}

export function setBudget(budget: Budget): Promise<Budget> {
  return invoke("set_budget", { budget });
}

/** The offline library: every manifest fetched-and-verified so far. */
export function listLibrary(): Promise<ManifestCacheEntry[]> {
  return invoke("list_library");
}

export function listPins(): Promise<PinnedItem[]> {
  return invoke("list_pins");
}

/** Look up one offline-library entry by record id, no network involved
 *  — the fallback `useManifest` uses to resolve a deep link (a reload,
 *  or a link opened without React Router navigation state) against the
 *  local cache. */
export function getCachedEntry(recordId: string): Promise<ManifestCacheEntry | null> {
  return invoke("get_cached_entry", { recordId });
}

/** `Browse.tsx`'s data source: a page of a gateway's public catalog. */
export function fetchCatalog(gatewayUrl: string, cursor?: string, mediaKind?: MediaKind): Promise<CatalogPage> {
  return invoke("fetch_catalog", { gatewayUrl, cursor: cursor ?? null, mediaKind: mediaKind ?? null });
}

/**
 * Fetch a manifest's detail view and independently, natively verify its
 * signed record bytes. `Watch`/`Listen` call this before ever handing a
 * URL to a player — nothing plays without having been checked first.
 */
export function fetchAndVerifyManifest(gatewayUrl: string, id: string): Promise<ManifestFetchResult> {
  return invoke("fetch_and_verify_manifest", { gatewayUrl, id });
}

/** Download, re-verify (chunked BLAKE3 against the manifest's own
 *  claim), and pin a manifest's media blob for offline playback. */
export function pinManifest(gatewayUrl: string, id: string): Promise<PinOutcome> {
  return invoke("pin_manifest", { gatewayUrl, id });
}

export function unpinBlob(blobId: string): Promise<boolean> {
  return invoke("unpin_blob", { blobId });
}

/** Whether a blob is currently pinned (protected long-term), distinct
 *  from `localMediaPath` returning non-null (a file merely existing on
 *  disk, e.g. a cached thumbnail) — see the Rust command's docs. */
export function isBlobPinned(blobId: string): Promise<boolean> {
  return invoke("is_blob_pinned", { blobId });
}

/** Resolve a blob id to a local file path (feed to `convertFileSrc()`),
 *  or `null` if this node doesn't have that blob cached — callers fall
 *  back to the gateway's remote URL in that case. */
export function localMediaPath(blobId: string): Promise<string | null> {
  return invoke("local_media_path", { blobId });
}

export function fetchPlaylist(gatewayUrl: string, id: string): Promise<PlaylistView> {
  return invoke("fetch_playlist", { gatewayUrl, id });
}

/** Validates (in Rust) that `gatewayUrl` parses as an absolute
 *  `http(s)` URL, returning its normalized origin. Throws (the invoke
 *  rejects) on anything else — used by `Settings.tsx` to reject a bad
 *  allow-list entry before it's ever dialed. */
export function validateGatewayUrl(gatewayUrl: string): Promise<string> {
  return invoke("validate_gateway_url", { gatewayUrl });
}
