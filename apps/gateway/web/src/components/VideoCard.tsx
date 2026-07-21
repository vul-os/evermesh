import { Avatar, formatClockTime, PlayIcon, TimeAgo } from "@vidmesh/ui";
import { Link } from "react-router-dom";
import type { VideoSummary } from "../lib/api-types.js";

export interface VideoCardProps {
  video: VideoSummary;
}

/**
 * A deterministic, no-image placeholder for videos without a thumbnail: a
 * faint diagonal lattice (the same motif as the landing hero — one point in
 * a mesh) at a hash-picked angle so a grid of unthumbnailed videos doesn't
 * read as N copies of the same empty box.
 */
function placeholderAngle(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % 360;
}

export function VideoCard({ video }: VideoCardProps): JSX.Element {
  return (
    <Link
      to={`/watch/${encodeURIComponent(video.id)}`}
      className="group block rounded-card focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:focus-visible:outline-brand-300"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-card border border-line bg-surface-2 shadow-card transition-shadow duration-200 group-hover:shadow-elevated">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 ease-vm group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              backgroundImage: `repeating-linear-gradient(${placeholderAngle(video.id)}deg, transparent 0 22px, var(--vm-border) 22px 23px)`,
            }}
            aria-hidden="true"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-base/80 text-muted shadow-card transition-transform duration-200 group-hover:scale-110 group-hover:text-signal">
              <PlayIcon size={18} className="translate-x-0.5" />
            </span>
          </div>
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white backdrop-blur-sm">
          {formatClockTime(video.durationMs / 1000)}
        </span>
      </div>
      <div className="mt-2.5 flex gap-2.5">
        <Avatar name={video.author.name} src={video.author.avatarUrl} size="sm" />
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink decoration-brand-600 decoration-2 underline-offset-2 group-hover:underline dark:decoration-brand-400">
            {video.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted">{video.author.name}</p>
          {/* API.md's createdAt fields are Unix seconds (unlike the Ms-suffixed
              duration/sponsorship fields), matching the kernel record's native
              createdAt unit — see README.md "API.md gaps". */}
          <TimeAgo unixMs={video.createdAt * 1000} className="text-xs text-faint" />
        </div>
      </div>
    </Link>
  );
}
