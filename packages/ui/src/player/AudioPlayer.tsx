import { useEffect, useReducer, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { cn } from "../cn.js";
import { MusicNoteIcon } from "../Icon.js";
import { TransportBar } from "./TransportBar.js";
import { INITIAL_PLAYER_STATE, keyToAction, playerReducer } from "./playerLogic.js";

export interface AudioPlayerProps {
  /** Whole-file audio blob URL — a manifest's `playback.mp4Url` doubles
   *  as this (API.md: the field name predates audio, the URL doesn't
   *  care). `null` while nothing is queued. */
  src: string | null;
  coverArtUrl?: string;
  title?: string;
  /** Typically the author/channel name. */
  subtitle?: string;
  /** Track navigation, wired to a queue (`useQueue`) by the caller —
   *  omit both to hide the prev/next buttons (a standalone player with
   *  no queue, e.g. a single track embedded in a page). */
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  /** Fires on the underlying `<audio>`'s native `ended` event, except
   *  when `loop` is set (a looping element never fires `ended`). Wire
   *  to a queue's `onEnded` for v1's instant-sequential auto-advance. */
  onEnded?: () => void;
  /** Repeat-one: native `<audio loop>` rather than JS-driven replay, so
   *  looping never has to round-trip through `onEnded`. */
  loop?: boolean;
  className?: string;
}

/**
 * The audio counterpart to `Player` (spec 004 §2 / DMTAP §24.4.2's
 * audio-only manifests): same reducer, same keymap, same `TransportBar`,
 * swapping the `<video>` surface for cover art. Used both inline (an
 * album/track page) and inside `NowPlayingBar` (the persistent queue
 * player).
 */
export function AudioPlayer({
  src,
  coverArtUrl,
  title,
  subtitle,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  onEnded,
  loop = false,
  className,
}: AudioPlayerProps): JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(playerReducer, INITIAL_PLAYER_STATE);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = src ?? "";
    if (src) dispatch({ type: "seek-to", time: 0 });
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state.playing && audio.paused) void audio.play().catch(() => dispatch({ type: "sync-playing", playing: false }));
    if (!state.playing && !audio.paused) audio.pause();
  }, [state.playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = state.volume;
    audio.muted = state.muted;
  }, [state.volume, state.muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Math.abs(audio.currentTime - state.currentTime) > 0.25) {
      audio.currentTime = state.currentTime;
    }
  }, [state.currentTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const onTime = () => dispatch({ type: "sync-time", time: audio.currentTime });
    const onDuration = () => dispatch({ type: "sync-duration", duration: audio.duration });
    const onPlay = () => dispatch({ type: "sync-playing", playing: true });
    const onPause = () => dispatch({ type: "sync-playing", playing: false });
    const onEndedEvent = () => onEnded?.();
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEndedEvent);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEndedEvent);
    };
  }, [onEnded]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const action = keyToAction(event.key);
    if (!action) return;
    if (action.type === "toggle-fullscreen") return; // no fullscreen surface to toggle
    if (action.type === "next") {
      if (onNext) {
        event.preventDefault();
        onNext();
      }
      return;
    }
    if (action.type === "prev") {
      if (onPrev) {
        event.preventDefault();
        onPrev();
      }
      return;
    }
    event.preventDefault();
    dispatch(action);
  };

  return (
    <div
      ref={containerRef}
      className={cn("flex items-center gap-3 rounded-card bg-black p-3 text-white shadow-card outline-none", className)}
      tabIndex={0}
      role="group"
      aria-label="Audio player"
      onKeyDown={handleKeyDown}
    >
      {/* No native <track>: lyrics are a Caption (format "lrc", spec 004
          §2) — wiring a lyrics display is a separate future surface. */}
      <audio ref={audioRef} loop={loop} />

      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-control bg-surface-2/20">
        {coverArtUrl ? (
          <img src={coverArtUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <MusicNoteIcon size={22} className="text-white/50" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {(title || subtitle) && (
          <div className="mb-1 min-w-0">
            {title && <p className="truncate text-sm font-medium">{title}</p>}
            {subtitle && <p className="truncate text-xs text-white/60">{subtitle}</p>}
          </div>
        )}
        <TransportBar
          className="flex flex-col gap-1.5"
          playing={state.playing}
          currentTime={state.currentTime}
          duration={state.duration}
          muted={state.muted}
          volume={state.volume}
          onTogglePlay={() => dispatch({ type: "toggle-play" })}
          onSeek={(time) => dispatch({ type: "seek-to", time })}
          onToggleMute={() => dispatch({ type: "toggle-mute" })}
          onSetVolume={(volume) => dispatch({ type: "set-volume", volume })}
          onNext={onNext}
          onPrev={onPrev}
          hasNext={hasNext}
          hasPrev={hasPrev}
        />
      </div>
    </div>
  );
}
