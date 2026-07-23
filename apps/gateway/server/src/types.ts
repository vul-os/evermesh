/**
 * Shared response shapes mirroring apps/gateway/web/API.md exactly. Kept
 * separate from the DB row types (db.ts) so API modules can compose
 * responses without every route re-declaring the contract.
 */

export interface AuthorRef {
  identityId: string;
  name: string;
  avatarUrl?: string;
}

export type MediaKind = "video" | "audio";

export interface VideoSummary {
  id: string;
  title: string;
  author: AuthorRef;
  thumbnailUrl: string | null;
  /** video: both `original.width`/`height` present; audio: both absent
   *  (spec 004 §2, DMTAP §24.4.2) — derived at index time, not restated
   *  per row from `body_json`. */
  mediaKind: MediaKind;
  /** Cover art for an audio manifest — currently the same blob as
   *  `thumbnailUrl` (a user-supplied image, or absent), exposed under its
   *  own name so audio-facing UI doesn't have to know it's reusing the
   *  video thumbnail slot. */
  coverArtUrl?: string;
  durationMs: number;
  createdAt: number;
  channelId?: string;
}

export interface RenditionView {
  height: number;
  hlsUrl: string;
}

export interface CaptionView {
  language: string;
  url: string;
}

export interface SponsorView {
  startMs: number;
  endMs: number;
  label: string;
}

export interface Video extends VideoSummary {
  description: string;
  tags: string[];
  language?: string;
  record: Record<string, unknown>;
  recordCborUrl: string;
  playback: {
    hlsUrl: string | null;
    mp4Url: string | null;
    renditions: RenditionView[];
  };
  captions: CaptionView[];
  license: string;
  payment: [number, string][];
  sponsorship: SponsorView[];
  counts: { comments: number; reactions: Record<string, number> };
}

export interface Comment {
  id: string;
  author: { identityId: string; name: string };
  text: string;
  createdAt: number;
  parent: string | null;
  record: Record<string, unknown>;
}

export interface ClaimView {
  id: string;
  kind: number;
  kindName: string;
  author: string;
  createdAt: number;
  body: Record<string, unknown>;
  targetRecordId: string;
}

export interface ReceiptView {
  id: string;
  author: string;
  createdAt: number;
  amount: number;
  currency: string;
  rail: number;
  payee: string;
  message?: string;
  proof?: string;
}

export interface PlaylistView {
  id: string;
  title: string;
  description: string;
  author: AuthorRef;
  createdAt: number;
  /** Total entries the playlist record lists, including any this gateway
   *  can't currently resolve (retracted/denylisted/unknown manifest) —
   *  `entries.length` may be smaller. */
  entryCount: number;
  /** Resolved manifests, in the playlist's order; unresolvable entries are
   *  silently omitted rather than breaking the whole list. */
  entries: VideoSummary[];
}

export interface Channel {
  identityId: string;
  profile: { name: string; about?: string; avatarUrl?: string } | null;
  channels: { id: string; title: string; description?: string; avatarUrl?: string; bannerUrl?: string }[];
  videos: VideoSummary[];
}

export interface PolicyPageData {
  name: string;
  description: string;
  moderationPolicyHtml: string;
  feeds: { feed: string; publisher: string }[];
  stats: { videos: number; deindexed: number; policyLogEntries: number };
}

export interface InfoResponse {
  gateway: string;
  version: string;
  relays: string[];
  uploadEnabled: boolean;
}
