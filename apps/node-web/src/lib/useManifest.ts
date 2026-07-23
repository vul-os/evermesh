import { convertFileSrc } from "@tauri-apps/api/core";
import { useLocation, useSearchParams } from "react-router-dom";
import { useGateways } from "./GatewayContext.js";
import { resolveGatewayUrl } from "./resolveUrl.js";
import { fetchAndVerifyManifest, getCachedEntry, isBlobPinned, localMediaPath } from "./tauri.js";
import type { ManifestCacheEntry, VerifyVerdict, VideoDetail } from "./types.js";
import { type AsyncState, useAsync } from "./useAsync.js";

export interface ManifestView {
  detail: VideoDetail;
  verdict: VerifyVerdict;
  /** `convertFileSrc()`-ready local path, when a file exists on disk for
   *  this blob (usually because it's pinned — see `pinned` for the
   *  authoritative, budget-relevant signal). */
  localSrc: string | null;
  /** Whether the media blob is pinned (protected long-term), from the
   *  `pins` table — not merely inferred from `localSrc` being non-null. */
  pinned: boolean;
  /** Resolved absolute HLS/mp4 URLs against the gateway this manifest was
   *  fetched from — `null` when playing an offline library entry with no
   *  known origin gateway (see `Library.tsx`'s docs on that limitation). */
  remoteHlsUrl: string | null;
  remoteMp4Url: string | null;
}

interface WatchLocationState {
  /** Set by `Library.tsx` when opening an entry straight from the
   *  offline cache — skips the network entirely. */
  cached?: ManifestCacheEntry;
}

/** Build a `ManifestView` from an already-cached, already-verified
 *  library entry — no network call, since caching only ever happens
 *  after `fetch_and_verify_manifest` succeeded. The origin gateway isn't
 *  recorded (content is content-addressed and gateway-independent), so
 *  remote URLs are unavailable here: this view can only ever play from a
 *  pinned local file. */
async function viewFromCacheEntry(entry: ManifestCacheEntry): Promise<ManifestView> {
  const detail = JSON.parse(entry.bodyJson) as VideoDetail;
  const verdict: VerifyVerdict = {
    status: "verified",
    recordId: entry.recordId,
    shortId: entry.recordId.slice(0, 12),
    kind: 16,
    kindName: "manifest",
  };
  const localPath = entry.originalBlobId ? await localMediaPath(entry.originalBlobId) : null;
  return {
    detail,
    verdict,
    localSrc: localPath ? convertFileSrc(localPath) : null,
    // `entry.pinned` already reflects the `pins` table join
    // (`list_cached_manifests`/`get_cached_entry` both compute it the
    // same way) — no extra round-trip needed here.
    pinned: entry.pinned,
    remoteHlsUrl: null,
    remoteMp4Url: null,
  };
}

/**
 * Resolve one manifest for `Watch`/`Listen`, from whichever source is
 * available: an offline `Library` entry (`location.state.cached`, no
 * network at all) or a live gateway fetch-and-verify
 * (`?gateway=` query param, falling back to the currently selected
 * gateway). Either way, playback never starts before
 * [`fetchAndVerifyManifest`]/the cached entry's already-verified state is
 * resolved — see that function's docs.
 */
export function useManifest(id: string | undefined): AsyncState<ManifestView> & { gatewayUrl: string | undefined } {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { current } = useGateways();
  const cached = (location.state as WatchLocationState | null)?.cached;
  const gatewayUrl = searchParams.get("gateway") ?? current;

  const state = useAsync<ManifestView>(async () => {
    if (!id) throw new Error("No id in the URL.");

    // Path 1: opened straight from Library — already verified, no network.
    if (cached) return viewFromCacheEntry(cached);

    // Path 2: a gateway is selected — fetch-and-verify live.
    if (gatewayUrl) {
      const { detail, verdict, originalBlobId } = await fetchAndVerifyManifest(gatewayUrl, id);
      const [localPath, pinned] = await Promise.all([
        originalBlobId ? localMediaPath(originalBlobId) : Promise.resolve(null),
        originalBlobId ? isBlobPinned(originalBlobId) : Promise.resolve(false),
      ]);
      return {
        detail,
        verdict,
        localSrc: localPath ? convertFileSrc(localPath) : null,
        pinned,
        remoteHlsUrl: resolveGatewayUrl(gatewayUrl, detail.playback.hlsUrl),
        remoteMp4Url: resolveGatewayUrl(gatewayUrl, detail.playback.mp4Url),
      };
    }

    // Path 3: no router state, no gateway (a reload, or a link opened
    // outside this session's navigation) — try the offline cache by id
    // before giving up.
    const entry = await getCachedEntry(id);
    if (entry) return viewFromCacheEntry(entry);

    throw new Error("No gateway selected. Add one in Settings, or open this item from your Library.");
  }, [id, gatewayUrl, cached?.recordId]);

  return { ...state, gatewayUrl };
}
