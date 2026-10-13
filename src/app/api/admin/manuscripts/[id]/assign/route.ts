import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { assign } from "@/server/services/manuscripts";

export const POST = mutation<{ id: string }>(async (req, input, { id }) => {
  const actor = await requireActor(req.headers, ["admin"]);
  await assign(actor, id, input.editorId ?? "");
  return { ok: true, notice: "assigned" };
});
