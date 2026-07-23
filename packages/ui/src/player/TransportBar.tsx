import type { ReactNode } from "react";
import { PauseIcon, PlayIcon, SkipNextIcon, SkipPrevIcon, MuteIcon, VolumeIcon } from "../Icon.js";
import { formatClockTime } from "./playerLogic.js";

export interface TransportBarSponsorMark {
  leftPct: number;
  widthPct: number;
  label: string;
}

export interface TransportBarProps {
  playing: boolean;
  currentTime: number;
  duration: number;
  muted: boolean;
  volume: number;
  /** Buffered ranges, video only — `AudioPlayer` doesn't track them (a
   *  browser preloads a whole audio file readily enough that a buffer
   *  bar hasn't been worth the extra listener wiring for v1). */
  buffered?: [number, number][];
  /** Sponsorship-segment markers, video only (spec 010 §5). */
  sponsorMarks?: TransportBarSponsorMark[];
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onToggleMute: () => void;
  onSetVolume: (volume: number) => void;
  /** Track navigation (audio queues only) — omit both to hide the
   *  prev/next buttons entirely, which is what `Player` (video) does to
   *  keep its transport bar exactly as it was before this component was
   *  factored out. */
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  /** Extra controls after the volume slider (video: `CaptionsMenu`). */
  before?: ReactNode;
  /** Extra controls at the very end (video: the fullscreen button). */
  after?: ReactNode;
  className?: string;
}

/**
 * The scrubber + control row shared by `Player` (video) and `AudioPlayer`
 * (audio): seek bar with buffered/sponsor overlays, play/pause, elapsed
 * time, mute/volume, optional prev/next, and slots for whatever's
 * media-kind-specific (captions + fullscreen for video; nothing extra
 * for audio, since the queue lives in `NowPlayingBar`, not in-line here).
 */
export function TransportBar({
  playing,
  currentTime,
  duration,
  muted,
  volume,
  buffered = [],
  sponsorMarks = [],
  onTogglePlay,
  onSeek,
  onToggleMute,
  onSetVolume,
  onNext,
  onPrev,
  hasNext = true,
  hasPrev = true,
  before,
  after,
  className,
}: TransportBarProps): JSX.Element {
  return (
    <div className={className}>
      <div className="relative h-1.5 w-full">
        <div className="absolute inset-0 rounded-full bg-white/20" />
        {buffered.map(([start, end], i) => (
          <div
            key={i}
            className="absolute inset-y-0 rounded-full bg-white/35"
            style={{ left: `${(start / (duration || 1)) * 100}%`, width: `${((end - start) / (duration || 1)) * 100}%` }}
          />
        ))}
        <div
          className="pointer-events-none absolute inset-y-0 rounded-full bg-brand-400"
          style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
        />
        {sponsorMarks.map((seg, i) => (
          <div
            key={i}
            title={`Sponsored: ${seg.label}`}
            className="absolute inset-y-0 rounded-full bg-accent-300"
            style={{ left: `${seg.leftPct}%`, width: `${Math.max(seg.widthPct, 0.5)}%` }}
          />
        ))}
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="absolute inset-0 h-4 w-full -translate-y-[5px] cursor-pointer appearance-none bg-transparent accent-brand-400"
        />
      </div>

      <div className="flex items-center gap-1">
        {onPrev && (
          <button
            type="button"
            aria-label="Previous track"
            disabled={!hasPrev}
            onClick={onPrev}
            className="rounded-full p-1.5 transition-colors hover:bg-white/15 disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-brand-300"
          >
            <SkipPrevIcon />
          </button>
        )}

        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={onTogglePlay}
          className="rounded-full p-1.5 transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-brand-300"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        {onNext && (
          <button
            type="button"
            aria-label="Next track"
            disabled={!hasNext}
            onClick={onNext}
            className="rounded-full p-1.5 transition-colors hover:bg-white/15 disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-brand-300"
          >
            <SkipNextIcon />
          </button>
        )}

        <span className="min-w-[5.5rem] px-1 font-mono text-xs tabular-nums text-white/85">
          {formatClockTime(currentTime)} / {formatClockTime(duration)}
        </span>

        <button
          type="button"
          aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
          aria-pressed={muted}
          onClick={onToggleMute}
          className="rounded-full p-1.5 transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-brand-300"
        >
          {muted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}
        </button>
        <input
          type="range"
          aria-label="Volume"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => onSetVolume(Number(e.target.value))}
          className="h-2 w-16 cursor-pointer accent-brand-400"
        />

        <div className="relative ml-auto flex items-center gap-1">
          {before}
          {after}
        </div>
      </div>
    </div>
  );
}
