import { useMutation, useQuery } from "@tanstack/react-query";
import { PlayIcon, useQueuePlayback, type QueueTrack } from "@evermesh/ui";
import { useParams } from "react-router-dom";
import { getPlaylist, getVideo } from "../api.js";
import { QueryBoundary } from "../components/QueryState.js";
import { VideoGrid } from "../components/VideoGrid.js";
import type { VideoSummary } from "../lib/api-types.js";

/**
 * `playlist` (35, spec 003 §5.4) — kernel-validated and fully specified
 * since launch, but never surfaced through a gateway UI until now (the
 * gap this whole audio push closes on the read side too, not just
 * upload/playback). Entries are manifest ids; the playlist endpoint
 * (API.md) resolves the ones this gateway can currently serve and
 * reports the total separately, since a playlist can legitimately
 * outlive some of its entries here (retracted, denylisted, or just
 * never seen by this gateway — partition tolerance, not an error).
 */
export function Playlist(): JSX.Element {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <p role="alert" className="vm-card px-6 py-10 text-sm text-red-700 dark:text-red-300">
        No playlist id in the URL.
      </p>
    );
  }

  const query = useQuery({ queryKey: ["playlist", id], queryFn: () => getPlaylist(id) });
  const queue = useQueuePlayback();

  // "Play all" needs each entry's playable URL, which only the detail
  // endpoint carries (VideoSummary — the playlist's own shape — doesn't;
  // see API.md). Fetched in parallel; entries this gateway can't resolve
  // to a playable URL are silently dropped rather than failing the whole
  // queue-up.
  const playAllMutation = useMutation({
    mutationFn: async (entries: VideoSummary[]): Promise<QueueTrack[]> => {
      const details = await Promise.all(entries.map((e) => getVideo(e.id).catch(() => null)));
      const tracks: QueueTrack[] = [];
      for (const d of details) {
        if (!d?.playback.mp4Url) continue;
        tracks.push({
          id: d.id,
          title: d.title,
          subtitle: d.author.name,
          src: d.playback.mp4Url,
          coverArtUrl: d.coverArtUrl ?? d.thumbnailUrl ?? undefined,
        });
      }
      return tracks;
    },
    onSuccess: (tracks) => {
      if (tracks.length > 0) queue.playNow(tracks);
    },
  });

  return (
    <QueryBoundary
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      data={query.data}
      loadingLabel="Loading playlist…"
      emptyLabel="This playlist is not available on this gateway."
    >
      {(playlist) => (
        <div>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">Playlist</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{playlist.title}</h1>
              <p className="mt-1 text-sm text-muted">
                By {playlist.author.name} · {playlist.entries.length} of {playlist.entryCount} track
                {playlist.entryCount === 1 ? "" : "s"} available on this gateway
              </p>
              {playlist.description && <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-ink">{playlist.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => playAllMutation.mutate(playlist.entries)}
              disabled={playlist.entries.length === 0 || playAllMutation.isPending}
              className="vm-btn vm-btn-primary shrink-0"
            >
              <PlayIcon size={16} className="mr-1.5 inline -translate-x-0.5 align-[-2px]" />
              {playAllMutation.isPending ? "Loading…" : "Play all"}
            </button>
          </div>
          <VideoGrid videos={playlist.entries} emptyLabel="None of this playlist's tracks are available on this gateway." />
        </div>
      )}
    </QueryBoundary>
  );
}
