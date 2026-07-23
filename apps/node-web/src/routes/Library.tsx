import { convertFileSrc } from "@tauri-apps/api/core";
import { formatClockTime, MusicNoteIcon, PlayIcon } from "@evermesh/ui";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../components/StateViews.js";
import { listLibrary, localMediaPath, unpinBlob } from "../lib/tauri.js";
import type { ManifestCacheEntry } from "../lib/types.js";
import { useAsync } from "../lib/useAsync.js";

/**
 * The offline library: `list_library()` (Rust → `manifest_cache`, joined
 * against `pins`) — every manifest this node has fetched-and-verified,
 * whether or not its media blob is pinned. Fully offline: nothing here
 * makes a network call.
 *
 * One real gap, called out rather than hidden: cache rows don't record
 * which gateway they were fetched from (spec: content is
 * content-addressed and gateway-independent, so this wasn't part of the
 * cache key) — a *cached-but-unpinned* entry opened from here has no
 * remote URL to stream from until you happen to browse it again from a
 * live gateway session. A *pinned* entry always plays, from disk,
 * regardless.
 */
export function Library(): JSX.Element {
  const state = useAsync(listLibrary, []);
  const [busy, setBusy] = useState<string>();

  const onUnpin = async (entry: ManifestCacheEntry) => {
    if (!entry.originalBlobId) return;
    setBusy(entry.recordId);
    try {
      await unpinBlob(entry.originalBlobId);
      state.reload();
    } catch (err) {
      console.error("failed to unpin blob", err);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div>
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-signal">This device</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Library</h1>
      </div>

      {state.loading ? (
        <LoadingState label="Reading local library…" />
      ) : state.error ? (
        <ErrorState message={state.error} />
      ) : !state.data || state.data.length === 0 ? (
        <EmptyState>
          Nothing here yet. Browse a gateway and open something — every manifest you view gets a verified, offline
          record here; pin it to keep the media itself on disk too.
        </EmptyState>
      ) : (
        <ul className="vm-fade-up flex flex-col gap-3">
          {state.data.map((entry) => (
            <LibraryRow key={entry.recordId} entry={entry} busy={busy === entry.recordId} onUnpin={() => void onUnpin(entry)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LibraryRow({ entry, busy, onUnpin }: { entry: ManifestCacheEntry; busy: boolean; onUnpin: () => void }): JSX.Element {
  const [thumbSrc, setThumbSrc] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const blobId = entry.coverOrThumbBlob;
    if (!blobId) return undefined;
    localMediaPath(blobId)
      .then((path) => {
        if (!cancelled && path) setThumbSrc(convertFileSrc(path));
      })
      .catch(() => {
        /* no local thumbnail — the placeholder icon is fine */
      });
    return () => {
      cancelled = true;
    };
  }, [entry.coverOrThumbBlob]);

  const target = (entry.mediaKind === "audio" ? "/listen/" : "/watch/") + encodeURIComponent(entry.recordId);

  return (
    <li className="vm-card flex items-center gap-4 p-3">
      <Link to={target} state={{ cached: entry }} className="flex min-w-0 flex-1 items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-control bg-surface-2">
          {thumbSrc ? (
            <img src={thumbSrc} alt="" className="h-full w-full object-cover" />
          ) : entry.mediaKind === "audio" ? (
            <MusicNoteIcon size={20} className="text-muted" />
          ) : (
            <PlayIcon size={20} className="text-muted" />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">{entry.title}</h3>
          <p className="mt-0.5 truncate font-mono text-xs text-faint">{entry.author.slice(0, 16)}…</p>
          <p className="mt-0.5 text-xs text-muted">{formatClockTime(entry.durationMs / 1000)}</p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <span className={entry.pinned ? "vm-chip text-verified" : "vm-chip"}>{entry.pinned ? "Pinned" : "Cached only"}</span>
        {entry.pinned && (
          <button type="button" onClick={onUnpin} disabled={busy} className="vm-btn vm-btn-secondary text-xs">
            {busy ? "Removing…" : "Remove from device"}
          </button>
        )}
      </div>
    </li>
  );
}
