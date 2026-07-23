/**
 * Response/request shapes for the node app's Tauri commands, hand-typed
 * from `crates/evermesh-node/src/{main,gateway_client,pinning,verify}.rs`
 * — the Rust side is authoritative (every struct here derives
 * `serde::Serialize`/`Deserialize` with `rename_all = "camelCase"`), the
 * same "one hand-typed contract, no runtime schema" tradeoff
 * `apps/gateway/web/src/lib/api-types.ts` makes for the gateway's REST
 * API.
 */

export interface AuthorRef {
  identityId: string;
  name: string;
  avatarUrl?: string;
}

export type MediaKind = "video" | "audio";

export interface VideoSummary {
  id: string;
  title: string;
  author: AuthorRef;
  thumbnailUrl: string | null;
  mediaKind: MediaKind;
  coverArtUrl?: string;
  durationMs: number;
  createdAt: number;
  channelId?: string;
}

export interface CatalogPage {
  items: VideoSummary[];
  next: string | null;
}

export interface RenditionView {
  height: number;
  hlsUrl: string;
}

export interface CaptionView {
  language: string;
  url: string;
}

export interface Playback {
  hlsUrl: string | null;
  mp4Url: string | null;
  renditions: RenditionView[];
}

export interface VideoCounts {
  comments: number;
  reactions: Record<string, number>;
}

export interface VideoDetail extends VideoSummary {
  description: string;
  tags: string[];
  language?: string;
  record: Record<string, unknown>;
  recordCborUrl: string;
  playback: Playback;
  captions: CaptionView[];
  license: string;
  payment: unknown[];
  sponsorship: unknown[];
  counts: VideoCounts;
}

export interface PlaylistView {
  id: string;
  title: string;
  description: string;
  author: AuthorRef;
  createdAt: number;
  entryCount: number;
  entries: VideoSummary[];
}

/** `src/verify.rs`'s `VerifyVerdict` — the outcome of a native
 *  signature + kind-validity check, run in Rust before any bytes reach
 *  this app. There is no `"verifying"` member here (unlike
 *  `@evermesh/ui`'s browser-side `VerifiedState`): by the time this type
 *  exists on the JS side, the check has already completed. */
export type VerifyVerdict =
  | { status: "verified"; recordId: string; shortId: string; kind: number; kindName: string | null }
  | { status: "failed"; reason: string };

export interface ManifestFetchResult {
  detail: VideoDetail;
  verdict: VerifyVerdict;
  /** The manifest's original media blob id, hex — present whenever
   *  `verdict.status === "verified"` and the record parsed as a
   *  manifest. Pass to `localMediaPath()` to check for an offline copy. */
  originalBlobId: string | null;
}

export interface PinOutcome {
  blobId: string;
  bytesWritten: number;
  verdict: VerifyVerdict;
}

export type PinReason = "explicit" | "subscription";

export interface PinnedItem {
  blobId: string;
  manifestId: string | null;
  reason: PinReason;
  pinnedAt: number;
}

/** One row of the offline library (`pinning.rs`'s `manifest_cache`
 *  table): a manifest this node has fetched and verified, whether or not
 *  its media blob is pinned (`pinned` says which). `bodyJson` is the
 *  gateway's full `VideoDetail` response captured at cache time, parsed
 *  lazily by callers that want offline-renderable detail
 *  (`Library.tsx`). */
export interface ManifestCacheEntry {
  recordId: string;
  author: string;
  title: string;
  mediaKind: MediaKind;
  durationMs: number;
  coverOrThumbBlob: string | null;
  /** The manifest's playable media blob id, hex — pass to
   *  `localMediaPath()` to resolve offline playback without a gateway
   *  round-trip. `null` only for rows cached before this field existed. */
  originalBlobId: string | null;
  bodyJson: string;
  cachedAt: number;
  pinned: boolean;
}

export interface Budget {
  diskGb: number;
  bandwidthMbps: number;
}

export interface NodeStatus {
  version: string;
  pinnedCount: number;
  seeding: boolean;
  dbPath: string;
}
