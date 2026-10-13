import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { publishPageVersion } from "@/server/services/cms";

export const POST = mutation<{ versionId: string }>(async (req, _input, { versionId }) => {
  const actor = await requireActor(req.headers, ["admin"]);
  await publishPageVersion(actor, versionId);
  return { ok: true, notice: "page_published" };
});
