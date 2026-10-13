import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { unpublish } from "@/server/services/manuscripts";

export const POST = mutation<{ id: string }>(async (req, _input, { id }) => {
  const actor = await requireActor(req.headers, ["admin"]);
  await unpublish(actor, id);
  return { ok: true, notice: "unpublished" };
});
