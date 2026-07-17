import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getVideos, search } from "../api.js";
import { QueryBoundary } from "../components/QueryState.js";
import { VideoGrid } from "../components/VideoGrid.js";

export function Home(): JSX.Element {
  const [params] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";

  return q ? <SearchResults q={q} /> : <LatestVideos />;
}

function LatestVideos(): JSX.Element {
  const query = useInfiniteQuery({
    queryKey: ["videos"],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => getVideos({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next ?? undefined,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Latest on this gateway</h1>
      {query.isLoading ? (
        <p role="status" className="py-6 text-sm text-slate-500 dark:text-slate-400">
          Loading…
        </p>
      ) : query.isError ? (
        <p role="alert" className="py-6 text-sm text-red-700 dark:text-red-300">
          {query.error instanceof Error ? query.error.message : "Could not load videos."}
        </p>
      ) : (
        <>
          <VideoGrid videos={items} emptyLabel="This gateway hasn't published any videos yet." />
          {query.hasNextPage && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-slate-700"
              >
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
      <h1 className="mb-4 text-xl font-semibold">Results for &ldquo;{q}&rdquo;</h1>
      <QueryBoundary
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data}
        isEmpty={(d) => d.items.length === 0}
        emptyLabel={`No videos on this gateway match "${q}".`}
      >
        {(data) => <VideoGrid videos={data.items} />}
      </QueryBoundary>
    </div>
  );
}
