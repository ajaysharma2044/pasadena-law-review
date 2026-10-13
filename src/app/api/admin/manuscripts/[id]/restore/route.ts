import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { restoreVersion } from "@/server/services/manuscripts";

export const POST = mutation<{ id: string }>(async (req, input, { id }) => {
  const actor = await requireActor(req.headers, ["admin"]);
  await restoreVersion(actor, id, input.versionId ?? "");
  return { ok: true, notice: "restored" };
});
