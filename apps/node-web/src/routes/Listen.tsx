import { PlayIcon, QueueIcon, useQueuePlayback, VerifiedBadge, type VerifiedState } from "@evermesh/ui";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/StateViews.js";
import { pinManifest } from "../lib/tauri.js";
import { useManifest } from "../lib/useManifest.js";

/**
 * The audio counterpart of `Watch` (spec 004 §2 / DMTAP §24.4.2), styled
 * after `apps/gateway/web/src/routes/Album.tsx`: playback happens in the
 * shared `NowPlayingBar` (mounted in `Layout.tsx`) via the queue, not an
 * inline player, so a track keeps playing across route changes.
 */
export function Listen(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, gatewayUrl, reload } = useManifest(id);
  const queue = useQueuePlayback();
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState<string>();

  if (loading) return <LoadingState label="Fetching and verifying…" />;
  if (error || !data || !id) return <ErrorState message={error ?? "Could not load this item."} />;

  const { detail, verdict, localSrc, pinned: isPinned, remoteMp4Url } = data;
  const badgeState: VerifiedState = verdict.status === "verified" ? "verified" : "failed";
  const src = localSrc ?? remoteMp4Url;
  const isCurrent = queue.current?.id === id;
  const coverUrl = detail.coverArtUrl ?? detail.thumbnailUrl ?? undefined;
  const track = { id, title: detail.title, subtitle: detail.author.name, src: src ?? "", coverArtUrl: coverUrl };

  const onPin = async () => {
    if (!gatewayUrl) return;
    setPinning(true);
    setPinError(undefined);
    try {
      await pinManifest(gatewayUrl, id);
      reload();
    } catch (err) {
      setPinError(err instanceof Error ? err.message : String(err));
    } finally {
      setPinning(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        <div className="flex gap-4">
          <div className="aspect-square w-32 shrink-0 overflow-hidden rounded-card border border-line-strong bg-surface-2 shadow-card sm:w-44">
            {coverUrl ? (
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted">
                <PlayIcon size={32} />
              </div>
            )}
          </div>
          <div className="flex flex-col justify-end gap-3">
            <div className="flex flex-wrap items-start gap-2">
              <h1 className="text-xl font-semibold text-ink">{detail.title}</h1>
              <VerifiedBadge
                state={badgeState}
                shortId={verdict.status === "verified" ? verdict.shortId : undefined}
                failureReason={verdict.status === "failed" ? verdict.reason : undefined}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => src && queue.playNow([track])} disabled={!src} className="vm-btn vm-btn-primary">
                {isCurrent ? "Playing" : "Play"}
              </button>
              <button
                type="button"
                aria-label="Add to queue"
                onClick={() => src && queue.enqueue(track)}
                disabled={!src}
                className="vm-icon-btn"
              >
                <QueueIcon size={18} />
              </button>
            </div>
            {!src && (
              <p className="text-xs text-muted">
                Not available offline{gatewayUrl ? "" : " — open this from Browse to stream it"}.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span className="font-medium text-ink">{detail.author.name}</span>
          <span aria-hidden="true" className="text-faint">
            ·
          </span>
          <span>License: {detail.license}</span>
          {isPinned && (
            <>
              <span aria-hidden="true" className="text-faint">
                ·
              </span>
              <span className="text-verified">Pinned — playing from disk</span>
            </>
          )}
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm text-ink">{detail.description || "No description provided."}</p>
      </div>

      <aside className="space-y-3">
        <button
          type="button"
          onClick={() => void onPin()}
          disabled={isPinned || pinning || !gatewayUrl}
          className="vm-btn vm-btn-accent w-full"
        >
          {isPinned ? "Pinned for offline playback" : pinning ? "Downloading and verifying…" : "Pin for offline playback"}
        </button>
        {pinError && (
          <p role="alert" className="text-xs text-red-700 dark:text-red-300">
            {pinError}
          </p>
        )}
      </aside>
    </div>
  );
}
