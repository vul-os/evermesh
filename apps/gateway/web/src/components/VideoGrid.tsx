import type { VideoSummary } from "../lib/api-types.js";
import { VideoCard } from "./VideoCard.js";

export interface VideoGridProps {
  videos: VideoSummary[];
  emptyLabel?: string;
}

export function VideoGrid({ videos, emptyLabel = "No videos here yet." }: VideoGridProps): JSX.Element {
  if (videos.length === 0) {
    return (
      <p role="status" className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((video) => (
        <li key={video.id}>
          <VideoCard video={video} />
        </li>
      ))}
    </ul>
  );
}
