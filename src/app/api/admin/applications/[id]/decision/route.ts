import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { decideApplication } from "@/server/services/applications";

export const POST = mutation<{ id: string }>(async (req, input, { id }) => {
  const actor = await requireActor(req.headers, ["admin"]);
  await decideApplication(actor, id, input.decision ?? "", input.note ?? "");
  return { ok: true, notice: "application_decided" };
});
