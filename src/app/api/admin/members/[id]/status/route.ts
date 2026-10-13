import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { setStatus } from "@/server/services/members";

export const POST = mutation<{ id: string }>(async (req, input, { id }) => {
  const actor = await requireActor(req.headers, ["admin"]);
  await setStatus(actor, id, input.status ?? "", input.reason ?? "");
  return { ok: true, notice: "status_changed" };
});
