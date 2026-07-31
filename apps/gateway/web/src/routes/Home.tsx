import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { MusicNoteIcon, PlayIcon, WarningIcon } from "@evermesh/ui";
import { useSearchParams } from "react-router-dom";
import { getVideos, search } from "../api.js";
import type { MediaKind } from "../lib/api-types.js";
import { QueryBoundary } from "../components/QueryState.js";
import { SkeletonGrid, VideoGrid } from "../components/VideoGrid.js";

export function Home(): JSX.Element {
  const [params] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";

  return (
    <>
      <StatusStrip />
      {q ? <SearchResults q={q} /> : <LatestMedia />}
    </>
  );
}

/**
 * A slim capability/status strip — not a marketing hero. This is a media
 * browser: the catalogue below is the point, so the tagline that used to
 * headline this space ("Many gateways. One substrate. Media that outlives
 * its platforms.") moved to the footer, where it already lived a second
 * time, and the whole thing collapsed from a two-column display-type block
 * to one row of small print. What has to stay did: the honest capability
 * list (spec 009 §7 says a gateway operator re-skins accents, never
 * invents claims) and the experimental/DMTAP notice, required verbatim and
 * still first-class — not a dismissible toast — just no longer sized like
 * a hero competing with the grid for attention.
 */
function StatusStrip(): JSX.Element {
  return (
    <section
      aria-label="About this gateway"
      className="mb-6 flex flex-col gap-3 rounded-control border border-line bg-surface px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5"
    >
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-muted" aria-label="What this gateway serves">
        <li className="inline-flex items-center gap-1.5 font-medium text-ink">
          <PlayIcon size={13} /> Video
        </li>
        <li className="inline-flex items-center gap-1.5 font-medium text-ink">
          <MusicNoteIcon size={13} /> Music &amp; playlists
        </li>
        <li>Client-side verification</li>
        <li>
          <a href="https://github.com/vul-os/evermesh/tree/main/crates/evermesh-node" className="hover:text-signal">
            Desktop client ↗
          </a>
        </li>
      </ul>

      <p role="note" className="flex items-start gap-1.5 leading-relaxed text-muted sm:max-w-sm">
        <WarningIcon size={14} className="mt-0.5 shrink-0 text-live" />
        <span>
          <span className="font-semibold text-live">Experimental.</span>{" "}
          Evermesh is early-stage software, not production-ready. It optionally distributes over{" "}
          <a
            href="https://vulos.org/projects/evermesh/docs.html#dmtap-convergence"
            className="underline decoration-dotted underline-offset-2 hover:text-ink"
          >
            DMTAP-PUB (§22)
          </a>{" "}
          &mdash; additive, default-off, never a dependency.
        </span>
      </p>
    </section>
  );
}

const MEDIA_TABS: Array<{ value: MediaKind | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Music" },
];

function LatestMedia(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const kindParam = params.get("kind");
  const activeKind: MediaKind | "all" = kindParam === "video" || kindParam === "audio" ? kindParam : "all";

  const query = useInfiniteQuery({
    queryKey: ["videos", activeKind],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      getVideos({ cursor: pageParam, mediaKind: activeKind === "all" ? undefined : activeKind }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next ?? undefined,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  const setKind = (kind: MediaKind | "all") => {
    const next = new URLSearchParams(params);
    if (kind === "all") next.delete("kind");
    else next.set("kind", kind);
    setParams(next, { replace: true });
  };

  const emptyLabel =
    activeKind === "video"
      ? "This gateway hasn't published any video yet."
      : activeKind === "audio"
        ? "This gateway hasn't published any music yet."
        : "This gateway hasn't published any videos yet.";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">On this gateway</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Latest</h1>
        </div>
        <div role="tablist" aria-label="Filter by media kind" className="flex gap-1 rounded-control border border-line bg-surface-2 p-1">
          {MEDIA_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activeKind === tab.value}
              onClick={() => setKind(tab.value)}
              className={
                "rounded-[0.4rem] px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 " +
                (activeKind === tab.value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {query.isLoading ? (
        <>
          <p role="status" className="sr-only">
            Loading…
          </p>
          <SkeletonGrid />
        </>
      ) : query.isError ? (
        <p role="alert" className="vm-card border-red-300 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:text-red-300">
          {query.error instanceof Error ? query.error.message : "Could not load the catalogue."}
        </p>
      ) : (
        <>
          <VideoGrid videos={items} emptyLabel={emptyLabel} />
          {query.hasNextPage && (
            <div className="mt-9 flex justify-center">
              <button type="button" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage} className="vm-btn vm-btn-primary">
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SearchResults({ q }: { q: string }): JSX.Element {
  const query = useQuery({ queryKey: ["search", q], queryFn: () => search(q) });

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">Search</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Results for &ldquo;{q}&rdquo;
        </h1>
      </div>
      <QueryBoundary
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data}
        loading={<SkeletonGrid />}
        isEmpty={(d) => d.items.length === 0}
        emptyLabel={`Nothing on this gateway matches "${q}".`}
      >
        {(data) => <VideoGrid videos={data.items} />}
      </QueryBoundary>
    </div>
  );
}
