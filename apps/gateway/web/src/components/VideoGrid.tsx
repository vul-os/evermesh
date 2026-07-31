import type { VideoSummary } from "../lib/api-types.js";
import { MediaCard } from "./MediaCard.js";

export interface VideoGridProps {
  videos: VideoSummary[];
  emptyLabel?: string;
}

/** The one grid rhythm every media grid in this app uses — kept here so a
 *  card and its skeleton (below) can never drift out of sync with each
 *  other's column count or gap. */
export const GRID_CLASS = "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function VideoGrid({ videos, emptyLabel = "No videos here yet." }: VideoGridProps): JSX.Element {
  if (videos.length === 0) {
    return (
      <div role="status" className="vm-card flex flex-col items-center gap-2 px-6 py-16 text-center">
        <svg viewBox="0 0 40 40" aria-hidden="true" className="h-9 w-9 text-faint">
          <rect x="4" y="9" width="32" height="22" rx="4" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path d="M16 15.5v9l9-4.5-9-4.5Z" fill="currentColor" />
        </svg>
        <p className="text-sm text-muted">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <ul className={"vm-fade-up " + GRID_CLASS}>
      {videos.map((video) => (
        <li key={video.id}>
          <MediaCard video={video} />
        </li>
      ))}
    </ul>
  );
}

/**
 * A loading placeholder shaped like the grid it stands in for (card
 * outline, thumbnail block, two text bars) rather than a lone "Loading…"
 * line — the latter collapses the page to almost nothing while data is in
 * flight, which reads as broken more than a shimmering outline of what's
 * coming does. `aria-hidden` because the `role="status"` text label a
 * caller renders alongside this (see Home.tsx/SearchResults) is the
 * actual accessible loading announcement.
 */
export function SkeletonGrid({ count = 8 }: { count?: number }): JSX.Element {
  return (
    <ul aria-hidden="true" className={GRID_CLASS}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="animate-pulse">
          <div className="aspect-video w-full rounded-card border border-line-strong bg-surface-2" />
          <div className="mt-2.5 flex gap-2.5">
            <div className="h-7 w-7 shrink-0 rounded-full bg-surface-2" />
            <div className="mt-0.5 flex-1 space-y-2">
              <div className="h-3 w-[85%] rounded-full bg-surface-2" />
              <div className="h-2.5 w-[45%] rounded-full bg-surface-2" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
