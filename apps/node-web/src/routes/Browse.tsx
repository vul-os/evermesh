import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MediaCard } from "../components/MediaCard.js";
import { EmptyState, ErrorState, GRID_CLASS, LoadingState } from "../components/StateViews.js";
import { useGateways } from "../lib/GatewayContext.js";
import { fetchCatalog } from "../lib/tauri.js";
import type { MediaKind, VideoSummary } from "../lib/types.js";

type MediaFilter = MediaKind | "all";

const FILTERS: Array<{ value: MediaFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
];

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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">Browsing</p>
          <h1 className="mt-1 break-all text-2xl font-bold tracking-tight text-ink sm:text-3xl">{current}</h1>
        </div>
        <div role="tablist" aria-label="Filter by media kind" className="flex gap-1 rounded-control border border-line bg-surface-2 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={
                "rounded-[0.4rem] px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 " +
                (filter === f.value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")
              }
            >
              {f.label}
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
          <ul className={"vm-fade-up " + GRID_CLASS}>
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
