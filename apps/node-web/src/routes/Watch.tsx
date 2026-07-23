import { Player, VerifiedBadge, type VerifiedState } from "@evermesh/ui";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/StateViews.js";
import { pinManifest } from "../lib/tauri.js";
import { useManifest } from "../lib/useManifest.js";

/**
 * Video playback: a thin wrapper around `@evermesh/ui`'s `Player`. Source
 * selection is the one thing that differs from
 * `apps/gateway/web/src/routes/Watch.tsx` — this app prefers a pinned
 * local file (`localSrc`, via `convertFileSrc`) over the gateway's
 * HLS/mp4 URLs, and never renders a player at all until
 * `useManifest`/`fetch_and_verify_manifest` has already run its native
 * verification.
 */
export function Watch(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, gatewayUrl, reload } = useManifest(id);
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState<string>();

  if (loading) return <LoadingState label="Fetching and verifying…" />;
  if (error || !data || !id) return <ErrorState message={error ?? "Could not load this item."} />;

  const { detail, verdict, localSrc, pinned: isPinned, remoteHlsUrl, remoteMp4Url } = data;
  const badgeState: VerifiedState = verdict.status === "verified" ? "verified" : "failed";
  const canPlay = Boolean(localSrc || remoteHlsUrl || remoteMp4Url);

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
        {canPlay ? (
          <Player
            hls={localSrc ? undefined : (remoteHlsUrl ?? undefined)}
            mp4={localSrc ?? remoteMp4Url ?? undefined}
            poster={detail.thumbnailUrl ?? undefined}
            captions={detail.captions}
          />
        ) : (
          <p className="vm-card px-6 py-10 text-sm text-muted">
            Not available offline.{" "}
            {gatewayUrl ? "" : "Open this from Browse (with a gateway selected) to stream it."}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-semibold text-ink">{detail.title}</h1>
          <VerifiedBadge
            state={badgeState}
            shortId={verdict.status === "verified" ? verdict.shortId : undefined}
            failureReason={verdict.status === "failed" ? verdict.reason : undefined}
          />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
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

        {detail.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tags">
            {detail.tags.map((tag) => (
              <li key={tag} className="vm-chip">
                {tag}
              </li>
            ))}
          </ul>
        )}
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
        {!gatewayUrl && !isPinned && (
          <p className="text-xs text-muted">Pinning needs a gateway to download from — open this item from Browse.</p>
        )}
      </aside>
    </div>
  );
}
