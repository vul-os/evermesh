import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MediaCard } from "../components/MediaCard.js";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews.js";
import { useGateways } from "../lib/GatewayContext.js";
import { fetchCatalog } from "../lib/tauri.js";
import type { MediaKind, VideoSummary } from "../lib/types.js";

type MediaFilter = MediaKind | "all";

/**
 * The remote catalog: `fetch_catalog()` (Rust → the active gateway's
 * `GET /api/videos`) rendered as a `MediaCard` grid, video and audio
 * side by side (spec 004 §2 / DMTAP §24.4.2). The node-app counterpart
 * of `apps/gateway/web/src/routes/Home.tsx`'s `LatestVideos`.
 *
 * Pagination is accumulated by hand (append each page's items, track the
 * opaque `next` cursor) rather than through `useAsync` — "load more"
 * appends to what's on screen instead of replacing it, which a
 * dependency-keyed re-fetch hook isn't shaped for.
 */
export function Browse(): JSX.Element {
  const { current } = useGateways();
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [items, setItems] = useState<VideoSummary[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const loadPage = useCallback(
    (cursor: string | undefined, replace: boolean) => {
      if (!current) return;
      setLoading(true);
      setError(undefined);
      fetchCatalog(current, cursor, filter === "all" ? undefined : filter)
        .then((page) => {
          setItems((prev) => (replace ? page.items : [...prev, ...page.items]));
          setNext(page.next);
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
        .finally(() => setLoading(false));
    },
    [current, filter],
  );

  // Fresh load whenever the gateway or the media-kind filter changes.
  useEffect(() => {
    setItems([]);
    setNext(null);
    loadPage(undefined, true);
    // `loadPage` is recreated exactly when `current`/`filter` change, so
    // depending on it alone captures both.
  }, [loadPage]);

  if (!current) {
    return (
      <EmptyState>
        No gateway selected yet.{" "}
        <Link to="/settings" className="font-medium text-signal hover:underline">
          Add one in Settings
        </Link>{" "}
        to start browsing.
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">Browsing</p>
          <h1 className="mt-1 break-all text-2xl font-bold tracking-tight text-ink sm:text-3xl">{current}</h1>
        </div>
        <div className="flex gap-2" role="group" aria-label="Filter by media kind">
          {(["all", "video", "audio"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              className={filter === k ? "vm-btn vm-btn-primary text-xs" : "vm-btn vm-btn-secondary text-xs"}
            >
              {k === "all" ? "All" : k === "video" ? "Video" : "Audio"}
            </button>
          ))}
        </div>
      </div>

      {loading && items.length === 0 ? (
        <LoadingState label="Loading catalog…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState>This gateway hasn&rsquo;t published anything yet.</EmptyState>
      ) : (
        <>
          <ul className="vm-fade-up grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((video) => (
              <li key={video.id}>
                <MediaCard video={video} gatewayUrl={current} />
              </li>
            ))}
          </ul>
          {next && (
            <div className="mt-9 flex justify-center">
              <button type="button" onClick={() => loadPage(next, false)} disabled={loading} className="vm-btn vm-btn-primary">
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
