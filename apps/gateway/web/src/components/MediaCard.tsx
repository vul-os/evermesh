import { Avatar, formatClockTime, PlayIcon, QueueIcon, TimeAgo, useQueuePlayback } from "@evermesh/ui";
import type { CSSProperties, MouseEvent } from "react";
import { Link } from "react-router-dom";
import { getVideo } from "../api.js";
import type { VideoSummary } from "../lib/api-types.js";

export interface MediaCardProps {
  video: VideoSummary;
}

/** FNV-1a-ish string hash — small, fast, stable across runs (that's the
 *  point: the same record id always paints the same placeholder). */
function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash;
}

/**
 * A deterministic, no-image placeholder for media without a
 * thumbnail/cover. Every gateway starts with some fraction of
 * unthumbnailed uploads, and a grid where they're all the *same* flat
 * tile reads as broken images, not a design choice — so this derives a
 * genuinely distinct card from the record id: a hue (0-360, so a full
 * spin of colour, not a tint of one brand swatch), a second hue for
 * contrast, and one of four different compositions. Two ids landing on
 * the same composition still land on different colours, and vice versa,
 * so a full grid of unthumbnailed media reads as "a catalogue of
 * different things" rather than N repeats of one tile.
 *
 * This is deliberately generated cover art, not UI chrome: it does not
 * read from --bo-* tokens, the same way a channel's fallback avatar tint
 * isn't a brand colour either. Re-skinning a gateway's accents must not
 * be able to make every unthumbnailed item the same colour as the
 * "Upload" button.
 */
function placeholderStyle(id: string): CSSProperties {
  const hash = hashId(id);
  const hue = hash % 360;
  const hue2 = (hue + 130 + ((hash >>> 4) % 100)) % 360;
  const variant = hash % 4;
  const angle = (hash >>> 8) % 360;
  const x = 15 + (hash % 60);
  const y = 15 + ((hash >>> 6) % 60);

  switch (variant) {
    case 0: // diagonal duotone split
      return { backgroundImage: `linear-gradient(${angle}deg, hsl(${hue} 58% 28%), hsl(${hue2} 52% 46%))` };
    case 1: // off-centre spotlight
      return {
        backgroundImage: `radial-gradient(circle at ${x}% ${y}%, hsl(${hue} 75% 58%), hsl(${hue2} 55% 20%) 72%)`,
      };
    case 2: // concentric rings
      return {
        backgroundImage: `repeating-radial-gradient(circle at ${x}% ${y}%, hsl(${hue} 50% 34%) 0 16px, hsl(${hue2} 46% 24%) 16px 32px)`,
      };
    default: // two soft fields
      return {
        backgroundImage: `radial-gradient(circle at 18% 24%, hsl(${hue} 70% 52%), transparent 60%), radial-gradient(circle at 82% 76%, hsl(${hue2} 65% 46%), transparent 60%)`,
        backgroundColor: `hsl(${hue} 30% 15%)`,
      };
  }
}

/**
 * A media-kind-aware card (spec 004 §2 / DMTAP §24.4.2's audio manifests):
 * video keeps its original 16:9 thumbnail and links to `/watch/{id}`;
 * audio uses a square cover-art tile, links to `/album/{id}` (the audio
 * counterpart of Watch), and gets an "add to queue" affordance the video
 * card doesn't need (a video has nowhere to queue to in v1).
 */
export function MediaCard({ video }: MediaCardProps): JSX.Element {
  const isAudio = video.mediaKind === "audio";
  const queue = useQueuePlayback();
  const coverUrl = video.coverArtUrl ?? video.thumbnailUrl;

  const onAddToQueue = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // VideoSummary (the list-endpoint shape) has no playable URL — only
    // the detail endpoint's `playback.mp4Url` does (API.md) — so queueing
    // from a grid card means one extra fetch. Fire-and-forget: nothing in
    // the card's own UI is waiting on this beyond the queue updating once
    // it resolves.
    void getVideo(video.id).then((detail) => {
      if (!detail.playback.mp4Url) return;
      queue.enqueue({
        id: video.id,
        title: video.title,
        subtitle: video.author.name,
        src: detail.playback.mp4Url,
        coverArtUrl: coverUrl ?? undefined,
      });
    });
  };

  return (
    <Link
      to={isAudio ? `/album/${encodeURIComponent(video.id)}` : `/watch/${encodeURIComponent(video.id)}`}
      className="group block rounded-card focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-accent-600 dark:focus-visible:outline-brand-300"
    >
      <div
        className={
          "relative w-full overflow-hidden rounded-card border border-line-strong bg-surface-2 shadow-card transition-all duration-200 group-hover:border-signal/60 group-hover:shadow-elevated " +
          (isAudio ? "aspect-square" : "aspect-video")
        }
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 ease-vm group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div
            className="relative h-full w-full transition-transform duration-300 ease-vm group-hover:scale-[1.02]"
            style={placeholderStyle(video.id)}
            aria-hidden="true"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/5" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-black/70 shadow-elevated transition-transform duration-200 group-hover:scale-110">
                <PlayIcon size={18} className="translate-x-0.5" />
              </span>
            </div>
          </div>
        )}
        {!isAudio && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white backdrop-blur-sm">
            {formatClockTime(video.durationMs / 1000)}
          </span>
        )}
        {isAudio && (
          <button
            type="button"
            aria-label="Add to queue"
            onClick={onAddToQueue}
            className="absolute bottom-1.5 right-1.5 rounded-full bg-black/75 p-1.5 text-white opacity-0 backdrop-blur-sm transition-opacity duration-150 hover:bg-black/90 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <QueueIcon size={14} />
          </button>
        )}
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
