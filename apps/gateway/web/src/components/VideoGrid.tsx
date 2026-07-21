import type { VideoSummary } from "../lib/api-types.js";
import { VideoCard } from "./VideoCard.js";

export interface VideoGridProps {
  videos: VideoSummary[];
  emptyLabel?: string;
}

export function VideoGrid({ videos, emptyLabel = "No videos here yet." }: VideoGridProps): JSX.Element {
  if (videos.length === 0) {
    return (
      <p role="status" className="vm-card px-6 py-14 text-center text-sm text-muted">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="vm-fade-up grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((video) => (
        <li key={video.id}>
          <VideoCard video={video} />
        </li>
      ))}
    </ul>
  );
}
