import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { addCheck } from "@/server/services/manuscripts";

export const POST = mutation<{ id: string }>(async (req, input, { id }) => {
  const actor = await requireActor(req.headers, ["admin"]);
  const r = await addCheck(actor, id, input.label ?? "");
  return { ok: true, ...r, notice: "check_updated" };
});
