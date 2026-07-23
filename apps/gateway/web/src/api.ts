/**
 * Typed fetch client for the gateway REST API (apps/gateway/API.md).
 * One function per endpoint, hand-typed (no zod — see api-types.ts),
 * every call routed through `request()`/`requestBuffer()` so the
 * `{error:{code,message}}` envelope is handled consistently in exactly
 * one place. Relative paths only: the dev server proxies `/api` and
 * `/media` to the gateway backend (vite.config.ts); production builds
 * are served from the same origin as the API.
 */
import type {
  Channel,
  ClaimView,
  Comment,
  ComplianceAck,
  ComplianceCounterInput,
  ComplianceNoticeInput,
  CreatePlaylistInput,
  ExportResponse,
  InfoResponse,
  MediaKind,
  MeResponse,
  Page,
  PlaylistView,
  PolicyPageData,
  RawRecord,
  ReceiptView,
  UploadFields,
  UploadStarted,
  UploadStatusResponse,
  Video,
  VideoSummary,
} from "./lib/api-types.js";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseErrorBody(res: Response): Promise<{ code: string; message: string }> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    return { code: body.error?.code ?? "unknown", message: body.error?.message ?? res.statusText };
  } catch {
    return { code: "unknown", message: res.statusText || `HTTP ${res.status}` };
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const { code, message } = await parseErrorBody(res);
    throw new ApiError(code, message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function requestBuffer(path: string): Promise<ArrayBuffer> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) {
    const { code, message } = await parseErrorBody(res);
    throw new ApiError(code, message, res.status);
  }
  return res.arrayBuffer();
}

function query(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

// ---------- Public read API ----------

export function getVideos(
  params: { limit?: number; cursor?: string; channel?: string; author?: string; mediaKind?: MediaKind } = {},
): Promise<Page<VideoSummary>> {
  return request(`/api/videos${query(params)}`);
}

export function getVideo(manifestId: string): Promise<Video> {
  return request(`/api/videos/${encodeURIComponent(manifestId)}`);
}

export function getVideoComments(manifestId: string): Promise<{ items: Comment[] }> {
  return request(`/api/videos/${encodeURIComponent(manifestId)}/comments`);
}

export function getVideoClaims(manifestId: string): Promise<{ items: ClaimView[] }> {
  return request(`/api/videos/${encodeURIComponent(manifestId)}/claims`);
}

export function getVideoReceipts(manifestId: string): Promise<{ items: ReceiptView[] }> {
  return request(`/api/videos/${encodeURIComponent(manifestId)}/receipts`);
}

export function getChannel(identityId: string): Promise<Channel> {
  return request(`/api/channels/${encodeURIComponent(identityId)}`);
}

export function getChannelVideos(identityId: string, params: { limit?: number; cursor?: string } = {}): Promise<Page<VideoSummary>> {
  return request(`/api/channels/${encodeURIComponent(identityId)}/videos${query(params)}`);
}

export function getRecord(recordId: string): Promise<RawRecord> {
  return request(`/api/records/${encodeURIComponent(recordId)}`);
}

export function getRecordCbor(recordId: string): Promise<ArrayBuffer> {
  return requestBuffer(`/api/records/${encodeURIComponent(recordId)}/cbor`);
}

export function search(q: string, limit?: number): Promise<{ items: VideoSummary[] }> {
  return request(`/api/search${query({ q, limit })}`);
}

export function getPolicy(): Promise<PolicyPageData> {
  return request("/api/policy");
}

export function getInfo(): Promise<InfoResponse> {
  return request("/api/info");
}

// ---------- Authenticated API ----------

// GAP: API.md does not document the response body of register/login
// beyond "sets session"; we type it as MeResponse since that is what
// the app needs immediately after either call, and re-fetch /api/me
// regardless (see routes/Auth.tsx) rather than trust this shape.
export function register(handle: string, password: string): Promise<MeResponse> {
  return request("/api/auth/register", { method: "POST", body: JSON.stringify({ handle, password }) });
}

export function login(handle: string, password: string): Promise<MeResponse> {
  return request("/api/auth/login", { method: "POST", body: JSON.stringify({ handle, password }) });
}

export function logout(): Promise<void> {
  return request("/api/auth/logout", { method: "POST" });
}

export function getMe(): Promise<MeResponse> {
  return request("/api/me");
}

// GAP: API.md doesn't specify the request body for the password
// re-confirm; assumed `{ password }` (matches "password re-confirmed").
export function exportIdentity(password: string): Promise<ExportResponse> {
  return request("/api/me/export", { method: "POST", body: JSON.stringify({ password }) });
}

export function updateProfile(fields: { name: string; about?: string; avatarBlobId?: string }): Promise<void> {
  return request("/api/me/profile", { method: "PUT", body: JSON.stringify(fields) });
}

export function upload(file: File, fields: UploadFields): Promise<UploadStarted> {
  const form = new FormData();
  form.set("file", file);
  if (fields.coverArt) form.set("coverArt", fields.coverArt);
  form.set("title", fields.title);
  if (fields.description) form.set("description", fields.description);
  if (fields.tags?.length) form.set("tags", fields.tags.join(","));
  if (fields.channelId) form.set("channelId", fields.channelId);
  form.set("license", fields.license);
  return request("/api/upload", { method: "POST", body: form });
}

export function getUploadStatus(uploadId: string): Promise<UploadStatusResponse> {
  return request(`/api/upload/${encodeURIComponent(uploadId)}`);
}

// GAP: API.md doesn't specify the response body of posting a comment;
// treated as fire-and-forget, caller invalidates the comments query.
export function postComment(manifestId: string, fields: { text: string; parent?: string }): Promise<void> {
  return request(`/api/videos/${encodeURIComponent(manifestId)}/comments`, { method: "POST", body: JSON.stringify(fields) });
}

export function postReaction(manifestId: string, reaction: string): Promise<void> {
  return request(`/api/videos/${encodeURIComponent(manifestId)}/reactions`, { method: "POST", body: JSON.stringify({ reaction }) });
}

export function follow(identityId: string): Promise<void> {
  return request("/api/follow", { method: "POST", body: JSON.stringify({ identityId }) });
}

export function unfollow(identityId: string): Promise<void> {
  return request(`/api/follow/${encodeURIComponent(identityId)}`, { method: "DELETE" });
}

// ---------- Compliance API ----------

export function postComplianceNotice(input: ComplianceNoticeInput): Promise<ComplianceAck> {
  return request("/api/compliance/notice", { method: "POST", body: JSON.stringify(input) });
}

export function postComplianceCounter(input: ComplianceCounterInput): Promise<ComplianceAck> {
  return request("/api/compliance/counter", { method: "POST", body: JSON.stringify(input) });
}

export function getComplianceNotice(id: string): Promise<RawRecord> {
  return request(`/api/compliance/notices/${encodeURIComponent(id)}`);
}

// ---------- Playlists ----------

export function getPlaylist(recordId: string): Promise<PlaylistView> {
  return request(`/api/playlists/${encodeURIComponent(recordId)}`);
}

export function createPlaylist(input: CreatePlaylistInput): Promise<PlaylistView> {
  return request("/api/playlists", { method: "POST", body: JSON.stringify(input) });
}
