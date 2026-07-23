import { cn } from "../cn.js";
import { CloseIcon, RepeatIcon, ShuffleIcon } from "../Icon.js";
import { AudioPlayer } from "./AudioPlayer.js";
import { useQueuePlayback } from "./useQueue.js";

export interface NowPlayingBarProps {
  className?: string;
}

/**
 * The persistent audio bar — mount once, outside the router's
 * `<Outlet>` (see `Layout.tsx`), so a track keeps playing across route
 * changes exactly like a native music app's mini-player. Reads its
 * state from `useQueuePlayback`'s context rather than props: an "add to
 * queue" button on a card several routes away and this bar have to
 * share one queue instance, which only a context (not prop drilling
 * through the router) can do here.
 *
 * Renders nothing when the queue is empty — there's no "now playing"
 * without a track, and an empty transport bar would just be chrome.
 */
export function NowPlayingBar({ className }: NowPlayingBarProps): JSX.Element | null {
  const queue = useQueuePlayback();
  if (!queue.current) return null;

  return (
    <div
      className={cn(
        "sticky bottom-0 z-40 border-t border-line bg-surface-base/95 backdrop-blur supports-[backdrop-filter]:bg-surface-base/80",
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2">
        <div className="min-w-0 flex-1">
          <AudioPlayer
            src={queue.current.src}
            coverArtUrl={queue.current.coverArtUrl}
            title={queue.current.title}
            subtitle={queue.current.subtitle}
            onNext={queue.tracks.length > 1 ? queue.next : undefined}
            onPrev={queue.tracks.length > 1 ? queue.prev : undefined}
            hasNext={queue.hasNext}
            hasPrev={queue.hasPrev}
            onEnded={queue.onEnded}
            loop={queue.repeat === "one"}
          />
        </div>

        <button
          type="button"
          aria-label="Toggle shuffle"
          aria-pressed={queue.shuffle}
          onClick={queue.toggleShuffle}
          className={cn("vm-icon-btn", queue.shuffle && "text-signal")}
        >
          <ShuffleIcon size={16} />
        </button>
        <button
          type="button"
          aria-label={`Repeat: ${queue.repeat}`}
          aria-pressed={queue.repeat !== "off"}
          onClick={queue.cycleRepeat}
          className={cn("vm-icon-btn", queue.repeat !== "off" && "text-signal")}
        >
          <RepeatIcon size={16} />
        </button>
        <button type="button" aria-label="Close player" onClick={queue.clear} className="vm-icon-btn">
          <CloseIcon size={16} />
        </button>
      </div>
    </div>
  );
}
