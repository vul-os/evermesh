/**
 * Response/request shapes for the gateway REST API, hand-typed from
 * apps/gateway/API.md (the locked contract) and cross-checked against
 * apps/gateway/server/src/types.ts so both sides of the contract agree
 * on field names. No zod / runtime validation by design (API.md is
 * authoritative and both processes are built from it in lockstep) —
 * see README.md "API.md gaps" for the handful of shapes API.md leaves
 * unspecified, marked below with a `// GAP:` comment at the point of
 * use in api.ts rather than here.
 */

export interface AuthorRef {
  identityId: string;
  name: string;
  avatarUrl?: string;
}

export interface VideoSummary {
  id: string;
  title: string;
  author: AuthorRef;
  thumbnailUrl: string | null;
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

export interface ChannelProfile {
  id: string;
  title: string;
  description?: string;
  avatarUrl?: string;
  bannerUrl?: string;
}

export interface Channel {
  identityId: string;
  profile: { name: string; about?: string; avatarUrl?: string } | null;
  channels: ChannelProfile[];
  videos: VideoSummary[];
}

export interface PolicyFeed {
  feed: string;
  publisher: string;
}

export interface PolicyPageData {
  name: string;
  description: string;
  moderationPolicyHtml: string;
  feeds: PolicyFeed[];
  stats: { videos: number; deindexed: number; policyLogEntries: number };
}

export interface InfoResponse {
  gateway: string;
  version: string;
  relays: string[];
  uploadEnabled: boolean;
}

export interface Page<T> {
  items: T[];
  next: string | null;
}

export interface RawRecord {
  record: Record<string, unknown>;
  id: string;
  kind: number;
}

/** `GET /api/me` (API.md "Authenticated API"). */
export interface MeResponse {
  handle: string;
  identityId: string;
  profile: { name: string; about?: string; avatarUrl?: string } | null;
  exportAvailable: true;
}

/** `POST /api/me/export`. */
export interface ExportResponse {
  identity: Record<string, unknown>;
  secretKeys: string[];
}

/** `POST /api/upload` -> async pipeline handle. */
export interface UploadStarted {
  uploadId: string;
}

export type UploadStatus = "processing" | "published" | "failed";

/** `GET /api/upload/{uploadId}`. */
export interface UploadStatusResponse {
  status: UploadStatus;
  manifestId?: string;
  progress?: number;
  error?: string;
}

export interface UploadFields {
  title: string;
  description?: string;
  tags?: string[];
  channelId?: string;
  license: string;
}

export interface ComplianceNoticeInput {
  subjectRecordId?: string;
  subjectBlobId?: string;
  reason: string;
  claimant: string;
  contact: string;
  statement: string;
}

export interface ComplianceCounterInput {
  noticeId: string;
  statement: string;
  contact: string;
}

export interface ComplianceAck {
  noticeId: string;
}
