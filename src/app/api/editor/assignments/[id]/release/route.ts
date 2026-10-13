import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { release } from "@/server/services/manuscripts";

export const POST = mutation<{ id: string }>(async (req, _input, { id }) => {
  const actor = await requireActor(req.headers, ["editor", "admin"]);
  await release(actor, id);
  return { ok: true, notice: "released" };
});
