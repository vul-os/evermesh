import { useQuery } from "@tanstack/react-query";
import { PlayIcon, QueueIcon, VerifiedBadge, useQueuePlayback, type VerifiedState } from "@evermesh/ui";
import { Link, useParams } from "react-router-dom";
import { getVideo, getVideoClaims, getVideoComments, getVideoReceipts } from "../api.js";
import { ClaimsPanel } from "../components/ClaimsPanel.js";
import { CommentThread } from "../components/CommentThread.js";
import { QueryBoundary } from "../components/QueryState.js";
import { ReactionBar } from "../components/ReactionBar.js";
import { TipPanel } from "../components/TipPanel.js";
import { useVerification } from "../hooks/useVerification.js";

/**
 * The audio counterpart of `Watch` (spec 004 §2 / DMTAP §24.4.2: a
 * manifest whose `original` omits `width`/`height`). Shares every
 * verification/claims/comments/tip surface with `Watch` — only the
 * player differs: rather than an inline `<video>`, playback happens in
 * the persistent `NowPlayingBar` (`Layout.tsx`), so "Play" here starts
 * (or resumes) the shared queue instead of a page-local player that
 * would stop the moment the visitor navigates away.
 */
export function Album(): JSX.Element {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <p role="alert" className="vm-card px-6 py-10 text-sm text-red-700 dark:text-red-300">
        No track id in the URL.
      </p>
    );
  }

  const videoQuery = useQuery({ queryKey: ["video", id], queryFn: () => getVideo(id) });
  const commentsQuery = useQuery({ queryKey: ["comments", id], queryFn: () => getVideoComments(id) });
  const claimsQuery = useQuery({ queryKey: ["claims", id], queryFn: () => getVideoClaims(id) });
  const receiptsQuery = useQuery({ queryKey: ["receipts", id], queryFn: () => getVideoReceipts(id) });
  const verification = useVerification(id);
  const queue = useQueuePlayback();

  const badgeState: VerifiedState = verification.isLoading
    ? "verifying"
    : verification.isError || verification.data?.status === "failed"
      ? "failed"
      : "verified";
  const failureReason =
    verification.data?.status === "failed"
      ? verification.data.reason
      : verification.error instanceof Error
        ? verification.error.message
        : undefined;
  const shortId = verification.data?.status === "verified" ? verification.data.shortId : undefined;

  return (
    <QueryBoundary
      isLoading={videoQuery.isLoading}
      isError={videoQuery.isError}
      error={videoQuery.error}
      data={videoQuery.data}
      loadingLabel="Loading track…"
      emptyLabel="This track is not available on this gateway."
    >
      {(video) => {
        const coverUrl = video.coverArtUrl ?? video.thumbnailUrl ?? undefined;
        const isCurrent = queue.current?.id === video.id;
        const track = {
          id: video.id,
          title: video.title,
          subtitle: video.author.name,
          src: video.playback.mp4Url ?? "",
          coverArtUrl: coverUrl,
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
                    <h1 className="text-xl font-semibold text-ink">{video.title}</h1>
                    <VerifiedBadge state={badgeState} shortId={shortId} failureReason={failureReason} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => video.playback.mp4Url && queue.playNow([track])}
                      disabled={!video.playback.mp4Url}
                      className="vm-btn vm-btn-primary"
                    >
                      {isCurrent ? "Playing" : "Play"}
                    </button>
                    <button
                      type="button"
                      aria-label="Add to queue"
                      onClick={() => video.playback.mp4Url && queue.enqueue(track)}
                      disabled={!video.playback.mp4Url}
                      className="vm-icon-btn"
                    >
                      <QueueIcon size={18} />
                    </button>
                  </div>
                  {!video.playback.mp4Url && <p className="text-xs text-muted">Audio for this track isn&rsquo;t available on this gateway.</p>}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <Link to={`/channel/${encodeURIComponent(video.author.identityId)}`} className="font-medium text-ink hover:text-signal hover:underline">
                  {video.author.name}
                </Link>
                <span aria-hidden="true" className="text-faint">·</span>
                <span>{video.counts.comments} comments on this gateway</span>
                <span aria-hidden="true" className="text-faint">·</span>
                <span>License: {video.license}</span>
              </div>

              <div className="mt-4">
                <ReactionBar videoId={video.id} reactions={video.counts.reactions} />
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm text-ink">{video.description || "No description provided."}</p>

              {video.tags.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tags">
                  {video.tags.map((tag) => (
                    <li key={tag} className="vm-chip">
                      {tag}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6">
                <QueryBoundary
                  isLoading={commentsQuery.isLoading}
                  isError={commentsQuery.isError}
                  error={commentsQuery.error}
                  data={commentsQuery.data}
                  loadingLabel="Loading comments…"
                >
                  {(data) => <CommentThread videoId={video.id} comments={data.items} />}
                </QueryBoundary>
              </div>
            </div>

            <aside className="space-y-6">
              <TipPanel payment={video.payment} receipts={receiptsQuery.data?.items ?? []} />
              <QueryBoundary
                isLoading={claimsQuery.isLoading}
                isError={claimsQuery.isError}
                error={claimsQuery.error}
                data={claimsQuery.data}
                loadingLabel="Loading claims…"
              >
                {(data) => <ClaimsPanel claims={data.items} />}
              </QueryBoundary>
            </aside>
          </div>
        );
      }}
    </QueryBoundary>
  );
}
