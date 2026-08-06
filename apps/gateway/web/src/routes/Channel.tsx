import { useMutation, useQuery } from "@tanstack/react-query";
import { Avatar } from "@evermesh/ui";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { follow, getChannel, unfollow } from "../api.js";
import { QueryBoundary } from "../components/QueryState.js";
import { VideoGrid } from "../components/VideoGrid.js";
import { useMe } from "../hooks/useMe.js";

export function Channel(): JSX.Element {
  const { identityId } = useParams<{ identityId: string }>();

  // Hooks must run unconditionally on every render (react-hooks/
  // rules-of-hooks) — the previous early `return` above these calls meant
  // none of them ran at all on a missing id. enabled: Boolean(identityId)
  // keeps the query inert until there's a real id; the `identityId!` inside
  // queryFn is safe precisely because enabled guarantees it never runs
  // while identityId is falsy.
  const { data: me } = useMe();
  const query = useQuery({
    queryKey: ["channel", identityId],
    queryFn: () => getChannel(identityId!),
    enabled: Boolean(identityId),
  });

  // GAP: API.md's /api/follow endpoints have no way to read the
  // caller's current follow state for a given identity (no `following`
  // field on Channel, no per-identity check on /api/me). Tracked
  // locally and optimistically; resets on reload until the contract
  // grows a source of truth for it.
  const [following, setFollowing] = useState(false);
  // mutationFn only ever runs from the button's onClick below, which is
  // unreachable while identityId is falsy (the early return beneath this
  // still guards the whole render), so identityId! here is safe too.
  const followMutation = useMutation({
    mutationFn: () => (following ? unfollow(identityId!) : follow(identityId!)),
    onSuccess: () => setFollowing((v) => !v),
  });

  if (!identityId) {
    return (
      <p role="alert" className="vm-card px-6 py-10 text-sm text-red-700 dark:text-red-300">
        No channel id in the URL.
      </p>
    );
  }

  return (
    <QueryBoundary
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      data={query.data}
      loadingLabel="Loading channel…"
      emptyLabel="This channel is not available on this gateway."
    >
      {(channel) => (
        <div>
          <div className="vm-card flex flex-wrap items-center gap-4 p-5">
            <Avatar name={channel.profile?.name ?? identityId} src={channel.profile?.avatarUrl} size="lg" />
            <div>
              <h1 className="text-xl font-semibold text-ink">{channel.profile?.name ?? "Unnamed channel"}</h1>
              {channel.profile?.about && <p className="mt-0.5 text-sm text-muted">{channel.profile.about}</p>}
            </div>
            {me && me.identityId !== identityId && (
              <button
                type="button"
                onClick={() => followMutation.mutate()}
                disabled={followMutation.isPending}
                aria-pressed={following}
                className={following ? "vm-btn vm-btn-secondary ml-auto" : "vm-btn vm-btn-primary ml-auto"}
              >
                {following ? "Following" : "Follow"}
              </button>
            )}
          </div>

          <h2 className="mb-4 mt-8 text-lg font-semibold text-ink">Videos</h2>
          <VideoGrid videos={channel.videos} emptyLabel="This channel hasn't published any videos on this gateway yet." />
        </div>
      )}
    </QueryBoundary>
  );
}
