import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { rejectPageVersion } from "@/server/services/cms";

export const POST = mutation<{ versionId: string }>(async (req, _input, { versionId }) => {
  const actor = await requireActor(req.headers, ["admin"]);
  await rejectPageVersion(actor, versionId);
  return { ok: true, notice: "page_rejected" };
});
