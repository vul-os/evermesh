import { useQuery } from "@tanstack/react-query";
import { Player, VerifiedBadge, type VerifiedState } from "@vidmesh/ui";
import { Link, useParams } from "react-router-dom";
import { getVideo, getVideoClaims, getVideoComments, getVideoReceipts } from "../api.js";
import { ClaimsPanel } from "../components/ClaimsPanel.js";
import { CommentThread } from "../components/CommentThread.js";
import { QueryBoundary } from "../components/QueryState.js";
import { ReactionBar } from "../components/ReactionBar.js";
import { TipPanel } from "../components/TipPanel.js";
import { useVerification } from "../hooks/useVerification.js";

export function Watch(): JSX.Element {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <p role="alert" className="py-10 text-sm text-red-700 dark:text-red-300">
        No video id in the URL.
      </p>
    );
  }

  const videoQuery = useQuery({ queryKey: ["video", id], queryFn: () => getVideo(id) });
  const commentsQuery = useQuery({ queryKey: ["comments", id], queryFn: () => getVideoComments(id) });
  const claimsQuery = useQuery({ queryKey: ["claims", id], queryFn: () => getVideoClaims(id) });
  const receiptsQuery = useQuery({ queryKey: ["receipts", id], queryFn: () => getVideoReceipts(id) });
  const verification = useVerification(id);

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
      loadingLabel="Loading video…"
      emptyLabel="This video is not available on this gateway."
    >
      {(video) => (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            <Player
              hls={video.playback.hlsUrl}
              mp4={video.playback.mp4Url}
              poster={video.thumbnailUrl ?? undefined}
              captions={video.captions}
              sponsorSegments={video.sponsorship}
            />

            <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
              <h1 className="text-xl font-semibold">{video.title}</h1>
              <VerifiedBadge state={badgeState} shortId={shortId} failureReason={failureReason} />
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <Link to={`/channel/${encodeURIComponent(video.author.identityId)}`} className="font-medium hover:underline">
                {video.author.name}
              </Link>
              <span>{video.counts.comments} comments on this gateway</span>
              <span>License: {video.license}</span>
            </div>

            <div className="mt-3">
              <ReactionBar videoId={video.id} reactions={video.counts.reactions} />
            </div>

            <p className="mt-3 whitespace-pre-wrap text-sm">{video.description || "No description provided."}</p>

            {video.tags.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Tags">
                {video.tags.map((tag) => (
                  <li key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
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
      )}
    </QueryBoundary>
  );
}
