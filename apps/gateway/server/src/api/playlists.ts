/**
 * `GET /api/playlists/{id}`, `POST /api/playlists` (API.md) — the
 * `playlist` kind (35, spec 003 §5.4) is fully kernel-validated but was,
 * until now, never surfaced through the gateway's read/write API (the
 * same shape as `POST /api/videos/{id}/comments` et al. in social.ts:
 * sign as the caller's custodied identity, index locally, publish out).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppDeps } from "../app-deps.ts";
import { invalid, notFound, policyDenied } from "../errors.ts";
import { requireUserId } from "../session.ts";
import { processRecord } from "../ingest.ts";
import { isRecordDenylisted, playlistRowToView, type PlaylistRow } from "./view-helpers.ts";

const CreatePlaylistSchema = z.object({
  title: z.string().min(1).max(512),
  description: z.string().max(16384).optional(),
  entries: z.array(z.string().regex(/^[0-9a-f]{64}$/i)).min(1),
});

export function registerPlaylistRoutes(app: FastifyInstance, deps: AppDeps): void {
  const { db } = deps;

  app.get("/api/playlists/:recordId", async (request) => {
    const { recordId } = request.params as { recordId: string };
    const row = db.prepare("SELECT * FROM playlists WHERE record_id = ?").get(recordId) as
      | (PlaylistRow & { retracted: number })
      | undefined;
    if (!row || row.retracted) throw notFound("playlist not found");
    if (isRecordDenylisted(db, recordId)) throw policyDenied();
    return playlistRowToView(db, row);
  });

  app.post("/api/playlists", async (request) => {
    const userId = requireUserId(request, db);
    const parsed = CreatePlaylistSchema.safeParse(request.body);
    if (!parsed.success) throw invalid(parsed.error.message);

    const body: Record<string, unknown> = {
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      entries: parsed.data.entries.map((id) => `hex:${id}`),
    };
    const record = await deps.custody.signRecord(userId, { kind: 35, refs: [], body });
    const result = await processRecord(deps.ingest, record);
    if (!result.stored || !result.recordId) throw invalid(`playlist rejected: ${result.reason}`);
    deps.relays.publish(record);

    const row = db.prepare("SELECT * FROM playlists WHERE record_id = ?").get(result.recordId) as PlaylistRow | undefined;
    if (!row) {
      // Should be unreachable: processRecord just reported this playlist as
      // stored. Fail loudly rather than throw a raw TypeError below.
      throw invalid("playlist was indexed but could not be re-read");
    }
    return playlistRowToView(db, row);
  });
}
