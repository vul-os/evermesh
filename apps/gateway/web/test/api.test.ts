import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, getInfo, getVideos, login, upload } from "../src/api.js";

function jsonResponse(status: number, body: unknown, ok = status < 400): Response {
  return {
    ok,
    status,
    statusText: "status text",
    json: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
  } as unknown as Response;
}

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GETs /api/videos with query params and returns the parsed page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], next: null }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getVideos({ limit: 10, cursor: "abc" });

    expect(result).toEqual({ items: [], next: null });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/videos?");
    expect(url).toContain("limit=10");
    expect(url).toContain("cursor=abc");
    expect(init.credentials).toBe("include");
  });

  it("throws an ApiError carrying the code/message/status from the {error} envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(404, { error: { code: "not_found", message: "no such video" } }, false)),
    );

    await expect(getInfo()).rejects.toMatchObject({
      code: "not_found",
      message: "no such video",
      status: 404,
    });
    await expect(getInfo()).rejects.toBeInstanceOf(ApiError);
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(getInfo()).rejects.toMatchObject({ code: "unknown", status: 500 });
  });

  it("sends a JSON body with a content-type header for POSTs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { handle: "alice", identityId: "id", profile: null, exportAvailable: true }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await login("alice", "hunter2");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ handle: "alice", password: "hunter2" });
  });

  it("sends multipart form data with no content-type header for uploads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { uploadId: "u1" }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["hi"], "clip.mp4", { type: "video/mp4" });

    const result = await upload(file, { title: "t", license: "cc0" });

    expect(result).toEqual({ uploadId: "u1" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers["content-type"]).toBeUndefined();
  });
});
